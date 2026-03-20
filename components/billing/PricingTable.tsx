'use client';

import { PLAN_AI_MINUTES, PLAN_PRICES_LKR } from '@/lib/stripe/plans';

const PLANS = ['free', 'starter', 'standard', 'pro', 'institute'] as const;

export function PricingTable() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Pricing</h1>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {PLANS.map((plan) => (
          <div key={plan} className="rounded-lg border p-4 space-y-2">
            <h2 className="text-lg font-bold capitalize">{plan}</h2>
            <p className="text-2xl font-bold">
              {PLAN_PRICES_LKR[plan] === 0
                ? 'Free'
                : `LKR ${PLAN_PRICES_LKR[plan]?.toLocaleString()}`}
              <span className="text-sm font-normal text-gray-500">/mo</span>
            </p>
            <p className="text-sm text-gray-600">
              {PLAN_AI_MINUTES[plan]} AI minutes/month
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
