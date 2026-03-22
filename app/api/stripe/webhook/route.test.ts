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
      items: { data: [{ price: { id: 'price_starter' }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
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
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
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
          items: { data: [{ price: { id: 'price_pro' }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
          status: 'active',
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

  it('returns 200 for unhandled event type without DB calls', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'charge.succeeded',
      data: { object: {} },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockSupabaseClient.update).not.toHaveBeenCalled();
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it('skips checkout.session.completed when metadata has no supabase_user_id', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_123',
          customer: 'cus_123',
          metadata: {},
        },
      },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockSupabaseClient.update).not.toHaveBeenCalled();
  });

  it('skips invoice.payment_succeeded when subscription metadata has no supabase_user_id', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: {
        object: { subscription: 'sub_123' },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      metadata: {},
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockSupabaseClient.update).not.toHaveBeenCalled();
  });

  it('skips customer.subscription.updated when metadata has no supabase_user_id', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          metadata: {},
          items: { data: [{ price: { id: 'price_pro' }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
          status: 'active',
        },
      },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockSupabaseClient.update).not.toHaveBeenCalled();
  });

  it('returns 200 even when DB update throws an error', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          metadata: { supabase_user_id: 'user-1' },
        },
      },
    });
    mockSupabaseClient.rpc.mockRejectedValue(new Error('DB connection lost'));

    const res = await POST(makeWebhookRequest('{}'));
    // Error-swallowing design: returns 200 to prevent Stripe retries
    expect(res.status).toBe(200);
  });

  it('maps unknown priceId to free plan', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_unknown',
          customer: 'cus_123',
          metadata: { supabase_user_id: 'user-1' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_unknown',
      items: { data: [{ price: { id: 'price_unknown_xyz' }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);

    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'free',
        ai_minutes_limit: 10,
      }),
    );
  });

  it('sets stripe_customer_id and stripe_subscription_id on subscription checkout', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_full',
          customer: 'cus_full',
          metadata: { supabase_user_id: 'user-1' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_full',
      items: { data: [{ price: { id: 'price_standard' }, current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
    });

    await POST(makeWebhookRequest('{}'));

    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: 'cus_full',
        stripe_subscription_id: 'sub_full',
      }),
    );
  });

  it('converts current_period_end unix timestamp to ISO date string', async () => {
    const periodEnd = 1735689600; // 2025-01-01T00:00:00.000Z
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_date',
          customer: 'cus_date',
          metadata: { supabase_user_id: 'user-1' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_date',
      items: { data: [{ price: { id: 'price_starter' }, current_period_end: periodEnd }] },
    });

    await POST(makeWebhookRequest('{}'));

    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_period_end: new Date(periodEnd * 1000).toISOString(),
      }),
    );
  });

  it('does not check Supabase update errors in webhook (error-swallowing design)', async () => {
    // Webhook handler has a try/catch that logs but returns 200.
    // However, Supabase .update().eq() returning an error object is NOT
    // caught by try/catch — it's a resolved promise with { error }.
    // This means DB update failures are silently ignored in the webhook.
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: { subscription: 'sub_fail_db' },
      },
    });
    mockSupabaseClient.eq.mockResolvedValue({
      error: { message: 'DB constraint violation' },
    });

    const res = await POST(makeWebhookRequest('{}'));
    // Returns 200 — the error is not checked
    expect(res.status).toBe(200);
  });

  it('handles stripe.subscriptions.retrieve failure gracefully', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_broken',
          customer: 'cus_broken',
          metadata: { supabase_user_id: 'user-1' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockRejectedValue(
      new Error('No such subscription'),
    );

    // The outer try/catch should swallow this and return 200
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockSupabaseClient.update).not.toHaveBeenCalled();
  });

  it('skips invoice.payment_succeeded when subscription is null', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: {
        object: { subscription: null },
      },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockSupabaseClient.update).not.toHaveBeenCalled();
  });

  it('skips invoice.payment_failed when subscription is null', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: { subscription: null },
      },
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockSupabaseClient.update).not.toHaveBeenCalled();
  });

  it('updates by stripe_subscription_id for invoice.payment_succeeded', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: {
        object: { subscription: 'sub_renew' },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_renew',
      metadata: { supabase_user_id: 'user-1' },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
    });

    await POST(makeWebhookRequest('{}'));

    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_renew');
  });
});
