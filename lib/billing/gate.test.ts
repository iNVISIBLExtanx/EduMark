import { describe, it, expect } from 'vitest';
import { isActive, hasMinutes, type BillingStatus } from './gate';

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
