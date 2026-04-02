'use client';

import { useState } from 'react';
import { PLAN_AI_MINUTES, PLAN_PRICES_LKR, TOPUP_MINUTES, TOPUP_PRICE_LKR } from '@/lib/stripe/plans';
import { useSubscription } from '@/hooks/useSubscription';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Check, Zap, Loader2 } from 'lucide-react';

const PLANS = ['free', 'starter', 'standard', 'pro', 'institute'] as const;
type PlanName = (typeof PLANS)[number];

const PLAN_PRICE_ID_KEYS: Record<Exclude<PlanName, 'free'>, string> = {
  starter: 'starter',
  standard: 'standard',
  pro: 'pro',
  institute: 'institute',
};

const FEATURES = [
  'All 6 A/L subjects',
  'Sinhala / Tamil / English',
  'PDF reports',
  'Tutor override',
  'Batch marking',
];

const FAQ_ITEMS = [
  {
    question: 'What is an AI Minute?',
    answer: 'One AI Minute = one student paper marked. Each paper is processed by Claude AI against your uploaded marking scheme.',
  },
  {
    question: 'Do unused minutes roll over?',
    answer: 'No, AI minutes expire at the end of your billing month. Top-ups also expire at month-end.',
  },
  {
    question: 'Can I change my plan?',
    answer: 'Yes, you can upgrade or downgrade anytime from your Settings page. Changes take effect immediately.',
  },
];

export interface PricingTableProps {
  currentPlan?: string;
  onSubscribe?: (priceId: string) => void;
  onTopUp?: () => void;
  isLoading?: boolean;
}

export function PricingTable({
  currentPlan: propCurrentPlan,
  onSubscribe,
  onTopUp,
  isLoading: propIsLoading,
}: PricingTableProps) {
  const { subscription, isLoading: subscriptionLoading, error } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const isLoading = propIsLoading || subscriptionLoading;
  const currentPlan = (propCurrentPlan ?? subscription?.plan ?? 'free') as PlanName;

  async function handleCheckout(planName: string, isTopUp = false) {
    if (onSubscribe && !isTopUp) {
      onSubscribe(planName);
      return;
    }
    if (onTopUp && isTopUp) {
      onTopUp();
      return;
    }

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-slate-600" />
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

  return (
    <div className="min-h-screen bg-[#FAFAF8] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
            Choose Your Plan
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            1 AI Minute = 1 student paper marked. All plans include every feature.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Supports Sinhala &bull; Tamil &bull; English marking
          </p>
        </div>

        {/* Plan Cards */}
        <div className="flex gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-5">
          {PLANS.map((plan) => {
            const isCurrent = plan === currentPlan;
            const isPopular = plan === 'standard';
            const price = PLAN_PRICES_LKR[plan];
            const minutes = PLAN_AI_MINUTES[plan];
            const isPaid = plan !== 'free';
            const isProcessing = loadingPlan === (isPaid ? PLAN_PRICE_ID_KEYS[plan as Exclude<PlanName, 'free'>] : plan);

            return (
              <Card
                key={plan}
                className={`relative min-w-[260px] flex-shrink-0 transition-all hover:ring-2 hover:ring-indigo-200 sm:min-w-0 ${
                  isCurrent ? 'ring-2 ring-green-500' : ''
                } ${isPopular ? 'ring-2 ring-indigo-700' : ''}`}
              >
                {/* Badges */}
                {isPopular && !isCurrent && (
                  <Badge className="absolute right-3 top-3 bg-amber-600 text-white hover:bg-amber-600">
                    Popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute right-3 top-3 bg-green-600 text-white hover:bg-green-600">
                    Current Plan
                  </Badge>
                )}

                <CardHeader className="pt-8">
                  <CardTitle className="text-lg font-semibold capitalize text-slate-800">
                    {plan}
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  {/* Price */}
                  <div>
                    <span className="text-3xl font-bold text-slate-800">
                      {price === 0 ? 'Free' : `LKR ${price.toLocaleString()}`}
                    </span>
                    {price > 0 && (
                      <span className="text-sm font-normal text-slate-500">/mo</span>
                    )}
                  </div>

                  {/* AI Minutes */}
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{minutes}</span> AI minutes/mo
                  </p>

                  {/* Features */}
                  <ul className="flex flex-col gap-2 text-sm text-slate-600">
                    {FEATURES.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="size-4 text-indigo-700" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="mt-auto">
                  {isCurrent ? (
                    <Button variant="outline" disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : plan === 'free' ? (
                    <Button
                      variant="outline"
                      className="w-full border-indigo-700 text-indigo-700 hover:bg-indigo-50"
                      disabled={loadingPlan !== null}
                    >
                      Get Started Free
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-indigo-700 text-white hover:bg-indigo-800"
                      disabled={loadingPlan !== null}
                      onClick={() => handleCheckout(PLAN_PRICE_ID_KEYS[plan as Exclude<PlanName, 'free'>])}
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        'Subscribe'
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Top-Up Section */}
        <div className="mx-auto mt-12 max-w-xl">
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
                <Zap className="size-5 text-amber-600" />
                Need More Minutes?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Add {TOPUP_MINUTES} AI Minutes for{' '}
                <span className="font-semibold">LKR {TOPUP_PRICE_LKR.toLocaleString()}</span> — one-time, no subscription needed.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Top-up minutes are added to your monthly limit and expire at month-end.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-amber-600 text-white hover:bg-amber-700"
                disabled={loadingPlan !== null}
                onClick={() => handleCheckout('topup', true)}
              >
                {loadingPlan === 'topup' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  'Top Up Now'
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {checkoutError && (
          <p className="mt-4 text-center text-sm text-red-600">{checkoutError}</p>
        )}

        {/* FAQ Section */}
        <div className="mx-auto mt-16 max-w-2xl">
          <h2 className="mb-6 text-center text-2xl font-semibold text-slate-800">
            Frequently Asked Questions
          </h2>
          <Accordion>
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="text-left font-medium text-slate-800 hover:text-indigo-700 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
