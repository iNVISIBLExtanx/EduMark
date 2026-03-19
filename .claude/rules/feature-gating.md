# Feature Gating & Subscription Access Control

## Golden Rule
Always read `plan`, `ai_minutes_used`, `ai_minutes_limit`, and `subscription_status`
fresh from the database server-side. NEVER trust JWT claims for access gating.

JWT tokens are issued at login and become stale the moment a plan changes.
A user who downgrades or cancels still holds their old JWT with stale claims.

---

## Server-Side Gate (lib/billing/gate.ts)
Use in every API route that touches AI minutes or gated features.

```typescript
import { createServerClient } from '@/lib/supabase/server';

export interface BillingStatus {
  plan: string;
  ai_minutes_used: number;
  ai_minutes_limit: number;
  subscription_status: string;
  billing_period_end: string | null;
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('tutors')
    .select('plan, ai_minutes_used, ai_minutes_limit, subscription_status, billing_period_end')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('Could not fetch billing status');
  return data;
}

export const isActive = (b: BillingStatus) =>
  b.subscription_status === 'active' || b.subscription_status === 'trialing';

export const hasMinutes = (b: BillingStatus, needed: number) =>
  (b.ai_minutes_limit - b.ai_minutes_used) >= needed;
```

Usage in batch dispatch:
```typescript
// app/api/batches/[id]/dispatch/route.ts
const billing = await getBillingStatus(user.id);

if (!isActive(billing)) {
  return NextResponse.json({ error: 'subscription_inactive' }, { status: 402 });
}
if (!hasMinutes(billing, papersCount)) {
  return NextResponse.json({
    error: 'insufficient_ai_minutes',
    available: billing.ai_minutes_limit - billing.ai_minutes_used,
    needed: papersCount,
  }, { status: 402 });
}
// ... proceed to dispatch
```

---

## SWR Hook (hooks/useSubscription.ts)
```typescript
import useSWR from 'swr';

interface SubscriptionData {
  plan: string;
  ai_minutes_used: number;
  ai_minutes_limit: number;
  subscription_status: string;
  billing_period_end: string | null;
}

export function useSubscription() {
  const { data, error, isLoading, mutate } = useSWR<SubscriptionData>('/api/tutor/subscription');
  const available = data ? data.ai_minutes_limit - data.ai_minutes_used : 0;
  const usagePercent = data ? (data.ai_minutes_used / data.ai_minutes_limit) * 100 : 0;
  const isPastDue = data?.subscription_status === 'past_due';
  const isFree = data?.plan === 'free';
  return { subscription: data, available, usagePercent, isPastDue, isFree, isLoading, error, mutate };
}
```

API endpoint:
```typescript
// app/api/tutor/subscription/route.ts
export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('tutors')
    .select('plan, ai_minutes_used, ai_minutes_limit, subscription_status, billing_period_end')
    .eq('id', user.id)
    .single();

  return NextResponse.json(data);
}
```

---

## AI Minutes Progress Bar (components/billing/AiMinutesBar.tsx)
```tsx
'use client';
import { useSubscription } from '@/hooks/useSubscription';

export function AiMinutesBar() {
  const { subscription, available, usagePercent, isPastDue } = useSubscription();
  if (!subscription) return null;

  const barColor =
    usagePercent > 90 ? 'bg-red-500' :
    usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-gray-600">
        <span>AI Minutes</span>
        <span>{available} remaining / {subscription.ai_minutes_limit}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`}
             style={{ width: `${Math.min(usagePercent, 100)}%` }} />
      </div>
      {isPastDue && (
        <p className="text-red-600 text-xs">
          Payment failed -- update billing to continue marking
        </p>
      )}
      {available < 10 && !isPastDue && (
        <p className="text-yellow-600 text-xs">
          Running low -- consider upgrading or adding a top-up
        </p>
      )}
    </div>
  );
}
```

---

## Past-Due Handling
- Block batch dispatch (402 error)
- Show warning banner on all dashboard pages
- "Update Payment" button calls `POST /api/stripe/portal` then redirects to Stripe Customer Portal
- Do NOT delete data -- tutor retains all previously marked results

## Free Plan Behaviour
- `ai_minutes_limit = 10`, same enforcement as paid plans
- When free tutor hits limit, show upgrade modal with pricing table
- Upgrade calls `POST /api/stripe/checkout` with selected priceId

## Folder Additions to architecture.md
Add these to the file tree:

```
lib/
  stripe/
    client.ts          -- Stripe SDK singleton
    plans.ts           -- plan constants
    subscription.ts    -- createOrGetStripeCustomer
  billing/
    gate.ts            -- getBillingStatus, isActive, hasMinutes
  supabase/
    service.ts         -- createServiceRoleClient (webhook use only)

hooks/
  useSubscription.ts   -- SWR hook for plan + AI minutes

components/
  billing/
    AiMinutesBar.tsx
    UpgradeModal.tsx
    PricingTable.tsx

app/
  api/
    stripe/
      checkout/route.ts
      portal/route.ts
      webhook/route.ts
    tutor/
      subscription/route.ts
  (dashboard)/
    pricing/page.tsx   -- renders <PricingTable />
```
