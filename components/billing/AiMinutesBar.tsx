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
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
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
