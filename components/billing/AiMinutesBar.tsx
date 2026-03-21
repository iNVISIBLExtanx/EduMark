'use client';

import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export function AiMinutesBar() {
  const { subscription, available, usagePercent, isPastDue } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  if (!subscription) return null;

  const barColor =
    usagePercent > 90 ? 'bg-red-500' :
    usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500';

  async function handlePortalRedirect() {
    setPortalLoading(true);
    try {
      const { url } = await apiFetch<{ url: string }>('/api/stripe/portal', {
        method: 'POST',
      });
      window.location.href = url;
    } catch {
      setPortalLoading(false);
    }
  }

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
        <div className="flex items-center justify-between">
          <p className="text-red-600 text-xs">
            Payment failed -- update billing to continue marking
          </p>
          <Button
            variant="destructive"
            size="xs"
            disabled={portalLoading}
            onClick={handlePortalRedirect}
          >
            {portalLoading ? 'Redirecting...' : 'Update Payment'}
          </Button>
        </div>
      )}
      {available < 10 && !isPastDue && (
        <div className="flex items-center justify-between">
          <p className="text-yellow-600 text-xs">
            Running low -- consider upgrading or adding a top-up
          </p>
          <a href="/pricing">
            <Button variant="outline" size="xs">
              Top Up
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}
