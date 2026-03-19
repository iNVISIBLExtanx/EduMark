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
