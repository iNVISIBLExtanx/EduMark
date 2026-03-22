'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSubscription } from '@/hooks/useSubscription';
import { useTutorProfile } from '@/hooks/useTutorProfile';
import { useBatches } from '@/hooks/useBatches';
import { AiMinutesBar } from '@/components/billing/AiMinutesBar';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { LanguageBadge } from '@/components/shared/LanguageBadge';
import { BatchStatusBadge } from '@/components/batches/BatchStatusBadge';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DashboardHome() {
  const { subscription, available, isFree, isLoading: subLoading } = useSubscription();
  const { tutor, error: tutorError, isLoading: tutorLoading } = useTutorProfile();
  const { batches, error: batchesError, isLoading: batchesLoading } = useBatches();
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (available === 0 && isFree) {
      setShowUpgrade(true);
    }
  }, [available, isFree]);

  if (tutorLoading || subLoading || batchesLoading) {
    return <p className="p-6">Loading...</p>;
  }

  if (tutorError || batchesError) {
    return (
      <p className="p-6 text-red-600">
        {tutorError?.message ?? batchesError?.message ?? 'Something went wrong'}
      </p>
    );
  }

  const recentBatches = batches.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">
          Welcome, {tutor?.full_name}
        </h1>
        <PlanBadge plan={subscription?.plan ?? 'free'} />
        {tutor?.marking_language && (
          <LanguageBadge language={tutor.marking_language} />
        )}
      </div>

      <AiMinutesBar />

      <Card>
        <CardHeader>
          <CardTitle>Recent Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBatches.length === 0 ? (
            <div className="text-sm text-gray-500">
              <p>No batches yet. Start by uploading a question paper.</p>
              <Link href="/papers" className="text-blue-600 hover:underline">
                Upload a question paper
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBatches.map((batch) => (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{batch.name}</span>
                    <BatchStatusBadge status={batch.status} />
                  </div>
                  <span className="text-sm text-gray-500">
                    {batch.marked_papers}/{batch.total_papers} papers
                  </span>
                </Link>
              ))}
              <Link
                href="/batches"
                className="text-sm text-blue-600 hover:underline"
              >
                View all batches &rarr;
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
