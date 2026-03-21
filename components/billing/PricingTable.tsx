'use client';

import { useState } from 'react';
import { PLAN_AI_MINUTES, PLAN_PRICES_LKR, TOPUP_MINUTES, TOPUP_PRICE_LKR } from '@/lib/stripe/plans';
import { useSubscription } from '@/hooks/useSubscription';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

const PLANS = ['free', 'starter', 'standard', 'pro', 'institute'] as const;
type PlanName = (typeof PLANS)[number];

const PLAN_RANK: Record<PlanName, number> = {
  free: 0,
  starter: 1,
  standard: 2,
  pro: 3,
  institute: 4,
};

const PLAN_PRICE_ID_KEYS: Record<Exclude<PlanName, 'free'>, string> = {
  starter: 'starter',
  standard: 'standard',
  pro: 'pro',
  institute: 'institute',
};

export function PricingTable() {
  const { subscription, isLoading, error } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load subscription data. Please try again.
      </div>
    );
  }

  const currentPlan = (subscription?.plan ?? 'free') as PlanName;

  async function handleCheckout(planName: string, isTopUp = false) {
    setCheckoutError(null);
    setLoadingPlan(isTopUp ? 'topup' : planName);
    try {
      const { url } = await apiFetch<{ url: string }>('/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          priceId: planName,
          isTopUp,
        }),
      });
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout failed');
      setLoadingPlan(null);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Pricing</h1>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {PLANS.map((plan) => {
          const isCurrent = plan === currentPlan;
          const isUpgrade = PLAN_RANK[plan] > PLAN_RANK[currentPlan];
          const isDowngrade = PLAN_RANK[plan] < PLAN_RANK[currentPlan] && plan !== 'free';

          return (
            <Card key={plan} className={isCurrent ? 'ring-2 ring-primary' : ''}>
              <CardHeader>
                <CardTitle className="capitalize">{plan}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold">
                  {PLAN_PRICES_LKR[plan] === 0
                    ? 'Free'
                    : `LKR ${PLAN_PRICES_LKR[plan]?.toLocaleString()}`}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {PLAN_AI_MINUTES[plan]} AI minutes/month
                </p>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full">
                    Current Plan
                  </Button>
                ) : plan === 'free' ? null : isUpgrade ? (
                  <Button
                    className="w-full"
                    disabled={loadingPlan !== null}
                    onClick={() => handleCheckout(PLAN_PRICE_ID_KEYS[plan as Exclude<PlanName, 'free'>])}
                  >
                    {loadingPlan === PLAN_PRICE_ID_KEYS[plan as Exclude<PlanName, 'free'>] ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Processing...
                      </span>
                    ) : (
                      'Upgrade'
                    )}
                  </Button>
                ) : isDowngrade ? (
                  <Button variant="outline" className="w-full" disabled>
                    Downgrade via Portal
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Top-up card */}
      <div className="mt-6 max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Top Up</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add {TOPUP_MINUTES} AI minutes for LKR {TOPUP_PRICE_LKR.toLocaleString()} (one-time)
            </p>
          </CardContent>
          <CardFooter>
            <Button
              variant="secondary"
              className="w-full"
              disabled={loadingPlan !== null}
              onClick={() => handleCheckout('topup', true)}
            >
              {loadingPlan === 'topup' ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                  Processing...
                </span>
              ) : (
                `Add ${TOPUP_MINUTES} Minutes`
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {checkoutError && (
        <p className="mt-4 text-sm text-red-600">{checkoutError}</p>
      )}
    </div>
  );
}
