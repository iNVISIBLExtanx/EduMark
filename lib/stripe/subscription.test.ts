import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../__mocks__/supabase';
import { mockStripe } from '../../__mocks__/stripe';
import { createOrGetStripeCustomer } from './subscription';

beforeEach(() => {
  vi.clearAllMocks();

  // Re-establish mock chain after clearAllMocks resets implementations
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
});

describe('createOrGetStripeCustomer', () => {
  it('returns existing stripe_customer_id when tutor already has one', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: 'cus_existing' },
      error: null,
    });

    const result = await createOrGetStripeCustomer('user-1', 'test@test.com');

    expect(result).toBe('cus_existing');
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
  });

  it('creates new Stripe customer when tutor has no stripe_customer_id', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: null },
      error: null,
    });
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new123' });

    const result = await createOrGetStripeCustomer('user-1', 'test@test.com');

    expect(result).toBe('cus_new123');
    expect(mockStripe.customers.create).toHaveBeenCalledOnce();
  });

  it('creates new Stripe customer when tutor record not found', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      error: null,
    });
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new456' });

    const result = await createOrGetStripeCustomer('user-1', 'test@test.com');

    expect(result).toBe('cus_new456');
    expect(mockStripe.customers.create).toHaveBeenCalledOnce();
  });

  it('passes correct email and supabase_user_id to Stripe', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: null },
      error: null,
    });
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_meta' });

    await createOrGetStripeCustomer('user-42', 'tutor@edu.lk');

    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'tutor@edu.lk',
      metadata: { supabase_user_id: 'user-42' },
    });
  });

  it('persists new customer_id to the correct tutor row', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: null },
      error: null,
    });
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_persist' });

    await createOrGetStripeCustomer('user-1', 'test@test.com');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutors');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({
      stripe_customer_id: 'cus_persist',
    });
  });

  it('throws when Stripe customer creation fails', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: null },
      error: null,
    });
    mockStripe.customers.create.mockRejectedValue(new Error('Stripe API rate limit'));

    await expect(
      createOrGetStripeCustomer('user-1', 'test@test.com'),
    ).rejects.toThrow('Stripe API rate limit');

    // Should NOT have tried to persist anything to Supabase
    expect(mockSupabaseClient.update).not.toHaveBeenCalled();
  });

  it('returns customer ID even if Supabase update fails to persist it', async () => {
    // This tests a subtle issue: if we create the Stripe customer but fail to
    // save the ID to Supabase, the function still returns the ID (no error check).
    // Next call would create a DUPLICATE Stripe customer.
    mockSupabaseClient.single.mockResolvedValue({
      data: { stripe_customer_id: null },
      error: null,
    });
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_orphan' });

    // First .eq() call is from SELECT chain (returns this for chaining to .single())
    // Second .eq() call is from UPDATE chain (returns error)
    mockSupabaseClient.eq
      .mockReturnValueOnce(mockSupabaseClient) // SELECT chain -> continues to .single()
      .mockResolvedValueOnce({ error: { message: 'DB write failed' } }); // UPDATE chain

    // Fixed: Source now throws when Supabase update fails,
    // preventing orphaned Stripe customers.
    await expect(
      createOrGetStripeCustomer('user-1', 'test@test.com'),
    ).rejects.toThrow('Failed to persist Stripe customer ID');
  });
});
