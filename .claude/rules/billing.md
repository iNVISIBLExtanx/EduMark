# Billing, Revenue Model & Stripe Integration

## Overview
EduMark AI uses Stripe for subscription billing. Tutors are billed monthly in LKR.
Payouts go to the foreign bank account linked to the Stripe account.
Currency: LKR -- set `currency: 'lkr'` on all Stripe Price objects.

---

## Plans & AI Minutes

1 AI Minute = 1 paper marked (one student PDF processed through Claude).

| Plan       | AI Minutes/mo | Price (LKR/mo) | Stripe Price ID env var           |
|------------|---------------|----------------|-----------------------------------|
| Free       | 10            | 0              | (no Stripe object needed)         |
| Starter    | 50            | 2,490          | `STRIPE_PRICE_STARTER`            |
| Standard   | 150           | 5,490          | `STRIPE_PRICE_STANDARD`           |
| Pro        | 350           | 10,990         | `STRIPE_PRICE_PRO`                |
| Institute  | 750           | 21,990         | `STRIPE_PRICE_INSTITUTE`          |
| Top-up     | +10           | 990            | `STRIPE_PRICE_TOPUP` (one-time)   |

All plans are identical in features. Only AI Minutes differ.
AI Minutes expire at month-end. No rollover.
Top-up is a one-time payment (not a subscription), uses `mode: 'payment'`.

---

## Key Files
- `lib/stripe/client.ts`                  -- Stripe SDK singleton (server-only)
- `lib/stripe/subscription.ts`            -- helpers (create customer, checkout, portal)
- `lib/stripe/plans.ts`                   -- plan constants (AI minutes, prices)
- `lib/billing/gate.ts`                   -- server-side billing enforcement
- `lib/db/billing.ts`                     -- Supabase billing query functions
- `app/api/stripe/checkout/route.ts`      -- POST: create Checkout Session
- `app/api/stripe/portal/route.ts`        -- POST: create Customer Portal session
- `app/api/stripe/webhook/route.ts`       -- POST: handle Stripe events (SECURED)
- `app/api/tutor/subscription/route.ts`   -- GET: current plan + AI minutes
- `hooks/useSubscription.ts`              -- SWR hook for subscription status

---

## Database Additions (billing columns on `tutors` table)

```sql
ALTER TABLE tutors ADD COLUMN stripe_customer_id    text unique;
ALTER TABLE tutors ADD COLUMN stripe_subscription_id text unique;
ALTER TABLE tutors ADD COLUMN plan                  text not null default 'free'
  check (plan in ('free','starter','standard','pro','institute'));
ALTER TABLE tutors ADD COLUMN ai_minutes_used       int not null default 0;
ALTER TABLE tutors ADD COLUMN ai_minutes_limit      int not null default 10;
ALTER TABLE tutors ADD COLUMN subscription_status   text not null default 'active'
  check (subscription_status in ('active','past_due','canceled','trialing'));
ALTER TABLE tutors ADD COLUMN billing_period_end    timestamptz;
```

### Critical RLS: Payment columns WRITE-PROTECTED from client
```sql
-- Only service role (webhook handler) can write to these columns
REVOKE UPDATE (
  stripe_customer_id,
  stripe_subscription_id,
  plan,
  ai_minutes_limit,
  subscription_status,
  billing_period_end
) ON TABLE public.tutors FROM authenticated;

-- Tutors can only update safe profile columns
GRANT UPDATE (full_name, marking_language)
  ON TABLE public.tutors TO authenticated;
```
This ensures even a direct Supabase client call from the browser CANNOT change plan or AI limits.

---

## AI Minutes Enforcement

Every time a batch is dispatched (`POST /api/batches/[id]/dispatch`):
1. Read `ai_minutes_used` and `ai_minutes_limit` fresh from DB server-side (never from JWT)
2. Check: `ai_minutes_limit - ai_minutes_used >= number_of_papers`
3. If insufficient: return 402 with `{ error: 'insufficient_ai_minutes' }`
4. After successful dispatch: atomically increment `ai_minutes_used += n_papers` via SQL function

```typescript
// lib/db/billing.ts
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function checkAndDeductMinutes(tutorId: string, papersCount: number) {
  const supabase = createServiceRoleClient();
  const { data: tutor } = await supabase
    .from('tutors')
    .select('ai_minutes_used, ai_minutes_limit, subscription_status')
    .eq('id', tutorId)
    .single();

  if (tutor.subscription_status === 'past_due') throw new Error('subscription_past_due');
  const available = tutor.ai_minutes_limit - tutor.ai_minutes_used;
  if (available < papersCount) throw new Error('insufficient_ai_minutes');

  // Atomic increment via SQL function to prevent race conditions
  await supabase.rpc('increment_ai_minutes_used', {
    p_tutor_id: tutorId,
    p_amount: papersCount,
  });
}
```

SQL function (atomic, bounds-checked):
```sql
CREATE OR REPLACE FUNCTION increment_ai_minutes_used(p_tutor_id uuid, p_amount int)
RETURNS void AS $$
BEGIN
  UPDATE tutors
  SET ai_minutes_used = LEAST(ai_minutes_used + p_amount, ai_minutes_limit)
  WHERE id = p_tutor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Top-up: adds minutes on top of current limit (not usage)
CREATE OR REPLACE FUNCTION add_topup_minutes(p_tutor_id uuid, p_amount int)
RETURNS void AS $$
BEGIN
  UPDATE tutors
  SET ai_minutes_limit = ai_minutes_limit + p_amount
  WHERE id = p_tutor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
