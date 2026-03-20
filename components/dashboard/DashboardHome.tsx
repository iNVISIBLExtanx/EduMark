'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { AiMinutesBar } from '@/components/billing/AiMinutesBar';

export function DashboardHome() {
  const { subscription, isLoading } = useSubscription();

  if (isLoading) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {subscription && <AiMinutesBar />}
    </div>
  );
}
