import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../../__mocks__/supabase';
import { mockStripe } from '../../../../__mocks__/stripe';
import { POST } from './route';

vi.mock('@/lib/stripe/subscription', () => ({
  createOrGetStripeCustomer: vi.fn().mockResolvedValue('cus_test123'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_PRICE_STARTER = 'price_starter';
  process.env.STRIPE_PRICE_STANDARD = 'price_standard';
  process.env.STRIPE_PRICE_PRO = 'price_pro';
  process.env.STRIPE_PRICE_INSTITUTE = 'price_institute';
  process.env.STRIPE_PRICE_TOPUP = 'price_topup';
  process.env.NEXT_PUBLIC_APP_URL = 'https://edumark.lk';
});

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/stripe/checkout', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const res = await POST(makeRequest({ priceId: 'price_starter' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid priceId', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@test.com' } },
    });

    const res = await POST(makeRequest({ priceId: 'price_invalid' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid price');
  });

  it('creates subscription checkout session', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@test.com' } },
    });
    mockStripe.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session123',
    });

    const res = await POST(makeRequest({ priceId: 'price_starter', isTopUp: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://checkout.stripe.com/session123');

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_test123',
      }),
    );
  });

  it('creates payment checkout session for top-up', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@test.com' } },
    });
    mockStripe.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/topup123',
    });

    const res = await POST(makeRequest({ priceId: 'price_topup', isTopUp: true }));
    expect(res.status).toBe(200);

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
      }),
    );
  });
});
