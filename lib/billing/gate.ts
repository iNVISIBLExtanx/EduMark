import { createServerClient } from '@/lib/supabase/server';

export interface BillingStatus {
  plan: string;
  ai_minutes_used: number;
  ai_minutes_limit: number;
  subscription_status: string;
  billing_period_end: string | null;
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('tutors')
    .select('plan, ai_minutes_used, ai_minutes_limit, subscription_status, billing_period_end')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('Could not fetch billing status');
  return data as BillingStatus;
}

export const isActive = (b: BillingStatus) =>
  b.subscription_status === 'active' || b.subscription_status === 'trialing';

export const hasMinutes = (b: BillingStatus, needed: number) =>
  (b.ai_minutes_limit - b.ai_minutes_used) >= needed;
