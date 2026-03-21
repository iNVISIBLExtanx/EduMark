import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../../__mocks__/supabase';
import { mockStripe } from '../../../../__mocks__/stripe';
import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = 'https://edumark.lk';
});

describe('POST /api/stripe/portal', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 404 when no stripe_customer_id', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: null },
      error: null,
    });

    const res = await POST();
    expect(res.status).toBe(404);
  });

  it('returns portal URL on success', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: 'cus_123' },
      error: null,
    });
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/portal/session123',
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://billing.stripe.com/portal/session123');
  });

  it('passes correct return_url to Stripe portal session', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: 'cus_123' },
      error: null,
    });
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/portal/session123',
    });

    await POST();

    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'https://edumark.lk/settings',
      }),
    );
  });

  it('passes correct customer ID to Stripe portal session', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: 'cus_portal' },
      error: null,
    });
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/portal/session123',
    });

    await POST();

    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_portal',
      }),
    );
  });

  it('throws when Stripe API returns error', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: 'cus_123' },
      error: null,
    });
    mockStripe.billingPortal.sessions.create.mockRejectedValue(
      new Error('Stripe API error'),
    );

    // No try/catch in source — unhandled error surfaces as 500
    await expect(POST()).rejects.toThrow('Stripe API error');
  });
});
