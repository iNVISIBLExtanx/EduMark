import { describe, it, expect } from 'vitest';
import { PLAN_AI_MINUTES, PLAN_PRICES_LKR, TOPUP_MINUTES, TOPUP_PRICE_LKR } from '@/lib/stripe/plans';

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

  it('has correct numeric AI minute values per plan', () => {
    expect(PLAN_AI_MINUTES.starter).toBe(50);
    expect(PLAN_AI_MINUTES.standard).toBe(150);
    expect(PLAN_AI_MINUTES.pro).toBe(350);
    expect(PLAN_AI_MINUTES.institute).toBe(750);
  });

  it('has correct LKR prices per plan', () => {
    expect(PLAN_PRICES_LKR.starter).toBe(2490);
    expect(PLAN_PRICES_LKR.standard).toBe(5490);
    expect(PLAN_PRICES_LKR.pro).toBe(10990);
    expect(PLAN_PRICES_LKR.institute).toBe(21990);
  });

  it('plans have increasing prices', () => {
    expect(PLAN_PRICES_LKR.starter).toBeGreaterThan(PLAN_PRICES_LKR.free);
    expect(PLAN_PRICES_LKR.standard).toBeGreaterThan(PLAN_PRICES_LKR.starter);
    expect(PLAN_PRICES_LKR.pro).toBeGreaterThan(PLAN_PRICES_LKR.standard);
    expect(PLAN_PRICES_LKR.institute).toBeGreaterThan(PLAN_PRICES_LKR.pro);
  });

  it('has exactly 5 plan keys', () => {
    const expectedPlans = ['free', 'starter', 'standard', 'pro', 'institute'];
    expect(Object.keys(PLAN_AI_MINUTES).sort()).toEqual(expectedPlans.sort());
    expect(Object.keys(PLAN_PRICES_LKR).sort()).toEqual(expectedPlans.sort());
  });
});
