'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBatches } from '@/hooks/useBatches';
import { BatchStatusBadge } from './BatchStatusBadge';
import { CreateBatchDialog } from './CreateBatchDialog';
import { LanguageBadge } from '@/components/shared/LanguageBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

export function BatchList() {
  const { batches, isLoading, error, mutate } = useBatches();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isLoading) return <p className="p-6">Loading batches...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error.message}</p>;

  function handleBatchCreated(batchId: string) {
    mutate();
    router.push(`/batches/${batchId}`);
  }

  async function handleDeleteBatch() {
    if (!deletingBatchId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/batches/${deletingBatchId}`, { method: 'DELETE' });
      setDeletingBatchId(null);
      mutate();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete batch');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Batches</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create Batch
        </Button>
      </div>

      {batches.length === 0 ? (
        <p className="text-gray-500">No batches yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {batches.map((batch) => (
            <li key={batch.id} className="rounded-lg border p-4 flex items-center justify-between">
              <Link href={`/batches/${batch.id}`} className="block flex-1 min-w-0">
                <p className="font-medium">{batch.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">
                    {batch.marked_papers}/{batch.total_papers} papers marked
                  </span>
                  <BatchStatusBadge status={batch.status} />
                  <LanguageBadge language={batch.medium} />
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  setDeleteError(null);
                  setDeletingBatchId(batch.id);
                }}
                aria-label={`Delete ${batch.name}`}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CreateBatchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onBatchCreated={handleBatchCreated}
      />

      <Dialog open={!!deletingBatchId} onOpenChange={(open) => { if (!open) setDeletingBatchId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Batch</DialogTitle>
            <DialogDescription>
              This will permanently delete the batch, all student submissions, and marking results. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-red-600">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingBatchId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBatch}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
