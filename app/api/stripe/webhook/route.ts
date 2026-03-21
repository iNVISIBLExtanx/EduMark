import { stripe } from '@/lib/stripe/client';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { PLAN_AI_MINUTES } from '@/lib/stripe/plans';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

function getPlanFromPriceId(priceId: string): string {
  const map: Record<string, string> = {
    [process.env.STRIPE_PRICE_STARTER!]: 'starter',
    [process.env.STRIPE_PRICE_STANDARD!]: 'standard',
    [process.env.STRIPE_PRICE_PRO!]: 'pro',
    [process.env.STRIPE_PRICE_INSTITUTE!]: 'institute',
  };
  return map[priceId] ?? 'free';
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;
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

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        if (session.mode === 'subscription') {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = sub.items.data[0].price.id;
          const plan = getPlanFromPriceId(priceId);

          await supabase.from('tutors').update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: sub.id,
            plan,
            ai_minutes_limit: PLAN_AI_MINUTES[plan],
            ai_minutes_used: 0,
            subscription_status: 'active',
            billing_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
          }).eq('id', userId);
        }

        if (session.mode === 'payment') {
          await supabase.rpc('add_topup_minutes', { p_tutor_id: userId, p_amount: 10 });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as unknown as { subscription: string | null }).subscription;
        if (!subscriptionId) break;
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase.from('tutors').update({
          ai_minutes_used: 0,
          subscription_status: 'active',
          billing_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as unknown as { subscription: string | null }).subscription;
        if (!subscriptionId) break;
        await supabase.from('tutors').update({
          subscription_status: 'past_due',
        }).eq('stripe_subscription_id', subscriptionId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;
        const priceId = sub.items.data[0].price.id;
        const plan = getPlanFromPriceId(priceId);

        await supabase.from('tutors').update({
          plan,
          ai_minutes_limit: PLAN_AI_MINUTES[plan],
          subscription_status: sub.status,
          billing_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from('tutors').update({
          plan: 'free',
          ai_minutes_limit: 10,
          ai_minutes_used: 0,
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          billing_period_end: null,
        }).eq('stripe_subscription_id', sub.id);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler processing error:', err);
  }

  return NextResponse.json({ received: true });
}
