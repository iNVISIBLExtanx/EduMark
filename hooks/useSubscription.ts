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
  const usagePercent = data && data.ai_minutes_limit > 0
    ? (data.ai_minutes_used / data.ai_minutes_limit) * 100
    : 0;
  const isPastDue = data?.subscription_status === 'past_due';
  const isFree = data?.plan === 'free';
  return { subscription: data, available, usagePercent, isPastDue, isFree, isLoading, error, mutate };
}
