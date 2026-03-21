import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../../__mocks__/supabase';
import { mockStripe } from '../../../../__mocks__/stripe';
import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_PRICE_STARTER = 'price_starter';
  process.env.STRIPE_PRICE_STANDARD = 'price_standard';
  process.env.STRIPE_PRICE_PRO = 'price_pro';
  process.env.STRIPE_PRICE_INSTITUTE = 'price_institute';

  mockSupabaseClient.update.mockReturnThis();
  mockSupabaseClient.eq.mockResolvedValue({ error: null });
  mockSupabaseClient.rpc.mockResolvedValue({ error: null });
});

function makeWebhookRequest(body: string, signature = 'sig_test'): Request {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': signature },
  });
}

describe('POST /api/stripe/webhook', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const req = new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature verification fails', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(400);
  });

  it('handles checkout.session.completed for subscription', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_123',
          customer: 'cus_123',
          metadata: { supabase_user_id: 'user-1' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      items: { data: [{ price: { id: 'price_starter' } }] },
      current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutors');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'starter',
        ai_minutes_limit: 50,
        ai_minutes_used: 0,
        subscription_status: 'active',
      }),
    );
  });

  it('handles checkout.session.completed for top-up payment', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          metadata: { supabase_user_id: 'user-1' },
        },
      },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('add_topup_minutes', {
      p_tutor_id: 'user-1',
      p_amount: 10,
    });
  });

  it('handles invoice.payment_succeeded and resets usage', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: {
        object: { subscription: 'sub_123' },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      metadata: { supabase_user_id: 'user-1' },
      current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);

    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ai_minutes_used: 0,
        subscription_status: 'active',
      }),
    );
  });

  it('handles invoice.payment_failed and sets past_due', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: { subscription: 'sub_123' },
      },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);

    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: 'past_due',
      }),
    );
  });

  it('handles customer.subscription.updated', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          metadata: { supabase_user_id: 'user-1' },
          items: { data: [{ price: { id: 'price_pro' } }] },
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        },
      },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);

    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'pro',
        ai_minutes_limit: 350,
      }),
    );
  });

  it('handles customer.subscription.deleted and resets to free', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_123' },
      },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);

    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'free',
        ai_minutes_limit: 10,
        ai_minutes_used: 0,
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        billing_period_end: null,
      }),
    );
  });
});
