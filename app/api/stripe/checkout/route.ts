import { stripe } from '@/lib/stripe/client';
import { createServerClient } from '@/lib/supabase/server';
import { createOrGetStripeCustomer } from '@/lib/stripe/subscription';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { priceId, isTopUp } = await req.json();

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
