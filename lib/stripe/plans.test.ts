import { describe, it, expect } from 'vitest';
import { PLAN_AI_MINUTES, PLAN_PRICES_LKR, TOPUP_MINUTES, TOPUP_PRICE_LKR } from './plans';

describe('plans constants', () => {
  it('has all plan tiers defined', () => {
    const plans = ['free', 'starter', 'standard', 'pro', 'institute'];
    plans.forEach((plan) => {
      expect(PLAN_AI_MINUTES[plan]).toBeDefined();
      expect(PLAN_PRICES_LKR[plan]).toBeDefined();
    });
  });

  it('free plan has 10 minutes and costs 0', () => {
    expect(PLAN_AI_MINUTES.free).toBe(10);
    expect(PLAN_PRICES_LKR.free).toBe(0);
  });

  it('plans have increasing AI minutes', () => {
    expect(PLAN_AI_MINUTES.starter).toBeGreaterThan(PLAN_AI_MINUTES.free);
    expect(PLAN_AI_MINUTES.standard).toBeGreaterThan(PLAN_AI_MINUTES.starter);
    expect(PLAN_AI_MINUTES.pro).toBeGreaterThan(PLAN_AI_MINUTES.standard);
    expect(PLAN_AI_MINUTES.institute).toBeGreaterThan(PLAN_AI_MINUTES.pro);
  });

  it('topup constants are correct', () => {
    expect(TOPUP_MINUTES).toBe(10);
    expect(TOPUP_PRICE_LKR).toBe(990);
  });
});
