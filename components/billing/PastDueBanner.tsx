'use client';

import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export function PastDueBanner() {
  const { isPastDue, isLoading } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  if (isLoading || !isPastDue) return null;

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
    <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
      <p className="text-sm text-red-700">
        Payment failed — update your billing to continue marking papers.
      </p>
      <Button
        variant="destructive"
        size="sm"
        disabled={portalLoading}
        onClick={handlePortalRedirect}
      >
        {portalLoading ? 'Redirecting...' : 'Update Payment'}
      </Button>
    </div>
  );
}
