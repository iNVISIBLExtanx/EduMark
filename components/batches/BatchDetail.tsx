'use client';

import { useBatchDetail } from '@/hooks/useBatchDetail';

export function BatchDetail({ batchId }: { batchId: string }) {
  const { batch, isLoading, error } = useBatchDetail(batchId);

  if (isLoading) return <p className="p-6">Loading batch...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error.message}</p>;
  if (!batch) return <p className="p-6 text-gray-500">Batch not found</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{batch.name}</h1>
      <p className="text-gray-500 mt-1">
        Status: {batch.status} &middot; {batch.marked_papers}/{batch.total_papers} marked
      </p>
    </div>
  );
}
