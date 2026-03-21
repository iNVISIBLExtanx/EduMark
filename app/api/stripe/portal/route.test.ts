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
});
