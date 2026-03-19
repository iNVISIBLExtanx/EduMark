# Stripe Integration -- Security-First Implementation

## Environment Variables (server-only, NO `NEXT_PUBLIC_` prefix)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_STANDARD=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_INSTITUTE=price_...
STRIPE_PRICE_TOPUP=price_...
NEXT_PUBLIC_APP_URL=https://edumark.lk
```
NEVER prefix Stripe vars with NEXT_PUBLIC_. They must never reach the browser.

---

## Stripe Client (lib/stripe/client.ts)
```typescript
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});
```

---

## Plans Constants (lib/stripe/plans.ts)
```typescript
export const PLAN_AI_MINUTES: Record<string, number> = {
  free:      10,
  starter:   50,
  standard:  150,
  pro:       350,
  institute: 750,
};

export const PLAN_PRICES_LKR: Record<string, number> = {
  free:      0,
  starter:   2490,
  standard:  5490,
  pro:       10990,
  institute: 21990,
};

export const TOPUP_MINUTES = 10;
export const TOPUP_PRICE_LKR = 990;
```

---

## Checkout Session (app/api/stripe/checkout/route.ts)
```typescript
import { stripe } from '@/lib/stripe/client';
import { createServerClient } from '@/lib/supabase/server';
import { createOrGetStripeCustomer } from '@/lib/stripe/subscription';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { priceId, isTopUp } = await req.json();

  // Validate priceId against known env vars -- never trust client input
  const validPrices = [
    process.env.STRIPE_PRICE_STARTER,
    process.env.STRIPE_PRICE_STANDARD,
    process.env.STRIPE_PRICE_PRO,
    process.env.STRIPE_PRICE_INSTITUTE,
    process.env.STRIPE_PRICE_TOPUP,
  ].filter(Boolean);

  if (!validPrices.includes(priceId)) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  const customerId = await createOrGetStripeCustomer(user.id, user.email!);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: isTopUp ? 'payment' : 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    currency: 'lkr',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { supabase_user_id: user.id },
    subscription_data: isTopUp ? undefined : {
      metadata: { supabase_user_id: user.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
```

---

## Customer Portal (app/api/stripe/portal/route.ts)
```typescript
import { stripe } from '@/lib/stripe/client';
import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tutor } = await supabase
    .from('tutors')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!tutor?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tutor.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
```

---

## WEBHOOK HANDLER (app/api/stripe/webhook/route.ts)
This is the most security-critical file. Read all comments carefully.

```typescript
import { stripe } from '@/lib/stripe/client';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { PLAN_AI_MINUTES } from '@/lib/stripe/plans';
import { NextResponse } from 'next/server';

// REQUIRED: Tell Next.js App Router NOT to parse the body.
// Parsing destroys the raw bytes needed for HMAC-SHA256 signature verification.
// Without this, every webhook call returns 400 "signature verification failed".
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Step 1: Read RAW body as text BEFORE any parsing
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  // Step 2: Verify HMAC-SHA256 signature + timestamp (replay attack prevention)
  // Stripe rejects requests older than 300 seconds automatically.
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('Stripe signature verification failed:', err);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  // Step 3: Use SERVICE ROLE client.
  // The anon key respects RLS, which blocks writes to billing columns.
  // Only service role can update plan, ai_minutes_limit, stripe_customer_id.
  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        if (session.mode === 'subscription') {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = sub.items.data[0].price.id;
          const plan = getPlanFromPriceId(priceId);

          await supabase.from('tutors').update({
            stripe_customer_id:     session.customer as string,
            stripe_subscription_id: sub.id,
            plan,
            ai_minutes_limit:    PLAN_AI_MINUTES[plan],
            ai_minutes_used:     0,
            subscription_status: 'active',
            billing_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
          }).eq('id', userId);
        }

        if (session.mode === 'payment') {
          // Top-up: adds 10 minutes to limit (not usage)
          await supabase.rpc('add_topup_minutes', { p_tutor_id: userId, p_amount: 10 });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Monthly renewal: reset usage counter for new billing period
        const invoice = event.data.object;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase.from('tutors').update({
          ai_minutes_used:     0,
          subscription_status: 'active',
          billing_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await supabase.from('tutors').update({
          subscription_status: 'past_due',
        }).eq('stripe_subscription_id', invoice.subscription as string);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;
        const priceId = sub.items.data[0].price.id;
        const plan = getPlanFromPriceId(priceId);

        await supabase.from('tutors').update({
          plan,
          ai_minutes_limit:    PLAN_AI_MINUTES[plan],
          subscription_status: sub.status,
          billing_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase.from('tutors').update({
          plan:                    'free',
          ai_minutes_limit:        10,
          ai_minutes_used:         0,
          subscription_status:     'canceled',
          stripe_subscription_id:  null,
          billing_period_end:      null,
        }).eq('stripe_subscription_id', sub.id);
        break;
      }
    }
  } catch (err) {
    // Log the error but return 200 so Stripe does not retry excessively.
    // Stripe retries for up to 3 days on non-200 responses.
    console.error('Webhook handler processing error:', err);
  }

  return NextResponse.json({ received: true });
}

function getPlanFromPriceId(priceId: string): string {
  const map: Record<string, string> = {
    [process.env.STRIPE_PRICE_STARTER!]:   'starter',
    [process.env.STRIPE_PRICE_STANDARD!]:  'standard',
    [process.env.STRIPE_PRICE_PRO!]:       'pro',
    [process.env.STRIPE_PRICE_INSTITUTE!]: 'institute',
  };
  return map[priceId] ?? 'free';
}
```

---

## Service Role Client (lib/supabase/service.ts)
```typescript
import { createClient } from '@supabase/supabase-js';

// ONLY use this in server-side webhook handlers and trusted background jobs.
// NEVER import in client components, SWR hooks, or regular API routes.
export const createServiceRoleClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // NO NEXT_PUBLIC_ prefix
  );
```

---

## createOrGetStripeCustomer (lib/stripe/subscription.ts)
```typescript
import { stripe } from './client';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function createOrGetStripeCustomer(userId: string, email: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data: tutor } = await supabase
    .from('tutors')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (tutor?.stripe_customer_id) return tutor.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  await supabase
    .from('tutors')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
}
```

---

## Security Checklist
- [x] Webhook uses `req.text()` for raw body -- NOT `req.json()` (JSON parsing breaks HMAC)
- [x] `constructEvent()` verifies HMAC-SHA256 + timestamp (replay attack prevention, 300s window)
- [x] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only (no NEXT_PUBLIC_ prefix)
- [x] Webhook handler uses `SUPABASE_SERVICE_ROLE_KEY` not anon key
- [x] `plan`, `ai_minutes_limit`, `stripe_customer_id` columns REVOKED from `authenticated` role
- [x] `priceId` validated server-side against known env var values before checkout
- [x] Feature gating reads from DB server-side -- never from JWT claims (JWT is stale post-upgrade)
- [x] AI minutes deducted atomically via `SECURITY DEFINER` SQL function (race-condition safe)
- [x] Top-up uses `mode: 'payment'`, subscription uses `mode: 'subscription'`
- [x] `supabase_user_id` in Stripe metadata bridges Stripe events back to Supabase user
