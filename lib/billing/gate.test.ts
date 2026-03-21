import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../__mocks__/supabase';
import { isActive, hasMinutes, getBillingStatus, type BillingStatus } from './gate';

const baseBilling: BillingStatus = {
  plan: 'starter',
  ai_minutes_used: 10,
  ai_minutes_limit: 50,
  subscription_status: 'active',
  billing_period_end: '2026-04-19T00:00:00Z',
};

describe('isActive', () => {
  it('returns true for active subscription', () => {
    expect(isActive({ ...baseBilling, subscription_status: 'active' })).toBe(true);
  });

  it('returns true for trialing subscription', () => {
    expect(isActive({ ...baseBilling, subscription_status: 'trialing' })).toBe(true);
  });

  it('returns false for past_due subscription', () => {
    expect(isActive({ ...baseBilling, subscription_status: 'past_due' })).toBe(false);
  });

  it('returns false for canceled subscription', () => {
    expect(isActive({ ...baseBilling, subscription_status: 'canceled' })).toBe(false);
  });
});

describe('hasMinutes', () => {
  it('returns true when enough minutes available', () => {
    expect(hasMinutes(baseBilling, 5)).toBe(true);
  });

  it('returns true when exactly enough minutes', () => {
    expect(hasMinutes(baseBilling, 40)).toBe(true);
  });

  it('returns false when not enough minutes', () => {
    expect(hasMinutes(baseBilling, 41)).toBe(false);
  });

  it('returns false when all minutes used', () => {
    const exhausted = { ...baseBilling, ai_minutes_used: 50 };
    expect(hasMinutes(exhausted, 1)).toBe(false);
  });
});

describe('getBillingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();
  });

  it('returns billing data for valid userId', async () => {
    const billingData = {
      plan: 'pro',
      ai_minutes_used: 100,
      ai_minutes_limit: 350,
      subscription_status: 'active',
      billing_period_end: '2026-04-19T00:00:00Z',
    };
    mockSupabaseClient.single.mockResolvedValue({ data: billingData, error: null });

    const result = await getBillingStatus('user-1');

    expect(result).toEqual(billingData);
  });

  it('throws when database returns an error', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      error: { message: 'DB connection failed' },
    });

    await expect(getBillingStatus('user-1')).rejects.toThrow('Could not fetch billing status');
  });

  it('throws when data is null', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: null });

    await expect(getBillingStatus('user-1')).rejects.toThrow('Could not fetch billing status');
  });

  it('result can be piped through isActive and hasMinutes', async () => {
    // Integration: getBillingStatus result feeds directly into gate functions
    mockSupabaseClient.single.mockResolvedValue({
      data: {
        plan: 'pro',
        ai_minutes_used: 300,
        ai_minutes_limit: 350,
        subscription_status: 'active',
        billing_period_end: '2026-04-19T00:00:00Z',
      },
      error: null,
    });

    const billing = await getBillingStatus('user-1');
    expect(isActive(billing)).toBe(true);
    expect(hasMinutes(billing, 50)).toBe(true);
    expect(hasMinutes(billing, 51)).toBe(false);
  });

  it('past_due billing status blocks at isActive gate', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: {
        plan: 'standard',
        ai_minutes_used: 0,
        ai_minutes_limit: 150,
        subscription_status: 'past_due',
        billing_period_end: '2026-04-19T00:00:00Z',
      },
      error: null,
    });

    const billing = await getBillingStatus('user-1');
    // Even though they have minutes, past_due blocks at isActive
    expect(isActive(billing)).toBe(false);
    expect(hasMinutes(billing, 1)).toBe(true); // has minutes but isActive is false
  });

  it('queries correct table, columns, and userId', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: baseBilling, error: null });

    await getBillingStatus('user-42');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutors');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith(
      'plan, ai_minutes_used, ai_minutes_limit, subscription_status, billing_period_end',
    );
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'user-42');
  });
});
