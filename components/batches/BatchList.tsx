'use client';

import { useBatches } from '@/hooks/useBatches';

export function BatchList() {
  const { batches, isLoading, error } = useBatches();

  if (isLoading) return <p className="p-6">Loading batches...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error.message}</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Batches</h1>
      {batches.length === 0 ? (
        <p className="text-gray-500">No batches yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {batches.map((batch) => (
            <li key={batch.id} className="rounded-lg border p-4">
              <p className="font-medium">{batch.name}</p>
              <p className="text-sm text-gray-500">
                {batch.marked_papers}/{batch.total_papers} papers marked &middot; {batch.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
