'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBatches } from '@/hooks/useBatches';
import { CreateBatchDialog } from './CreateBatchDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Layers,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface Batch {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_papers: number;
  marked_papers: number;
  created_at: string;
  subject_name: string | null;
  medium: 'sinhala' | 'tamil' | 'english';
  paper_name: string | null;
}

interface BatchListProps {
  batches?: Batch[];
  isLoading?: boolean;
  error?: Error;
  onCreateBatch?: () => void;
  onDeleteBatch?: (id: string) => void;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700 border-green-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
};

const MEDIUM_LABELS = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function BatchCardSkeleton() {
  return (
    <Card className="border-slate-100 bg-white">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
        </div>
        <Skeleton className="h-2 w-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Batch['status'] }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {status === 'processing' && (
        <Loader2 className="size-3 animate-spin" />
      )}
      {config.label}
    </span>
  );
}

function BatchCard({
  batch,
  onDelete,
}: {
  batch: Batch;
  onDelete: (id: string) => void;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const progressPercent =
    batch.total_papers > 0
      ? Math.round((batch.marked_papers / batch.total_papers) * 100)
      : 0;
  const showProgress = batch.status === 'processing' || batch.status === 'completed';

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(batch.id);
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="border-slate-100 bg-white transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3">
        {/* Top Row: Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {batch.name}
          </h3>
          <StatusBadge status={batch.status} />
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-300 text-slate-600">
            {batch.subject_name || 'General'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {MEDIUM_LABELS[batch.medium]}
          </span>
          {batch.paper_name && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {batch.paper_name}
            </Badge>
          )}
        </div>

        {/* Progress Row */}
        {showProgress && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {batch.marked_papers} / {batch.total_papers} papers marked
            </span>
            <Progress value={progressPercent}>
              <ProgressTrack className="h-1.5 bg-slate-100">
                <ProgressIndicator className="bg-indigo-600" />
              </ProgressTrack>
            </Progress>
          </div>
        )}

        {/* Bottom Row: Date + Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="size-3.5" />
            <span>{formatDate(batch.created_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" render={<Link href={`/batches/${batch.id}`} />}>
              View
              <ArrowRight data-icon="inline-end" />
            </Button>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${batch.name}`}
                  />
                }
              >
                <Trash2 className="size-4" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the batch, all uploaded student
                    papers, and marking results. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="animate-spin" data-icon="inline-start" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BatchList({
  batches: propBatches,
  isLoading: propLoading,
  error: propError,
  onCreateBatch,
  onDeleteBatch,
}: BatchListProps) {
  const hookData = useBatches();
  const batches = propBatches ?? hookData.batches;
  const isLoading = propLoading ?? hookData.isLoading;
  const error = propError ?? hookData.error;
  const mutate = hookData.mutate;

  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleCreateClick() {
    if (onCreateBatch) {
      onCreateBatch();
    } else {
      setDialogOpen(true);
    }
  }

  function handleBatchCreated(batchId: string) {
    mutate();
    router.push(`/batches/${batchId}`);
  }

  async function handleDeleteBatch(id: string) {
    if (onDeleteBatch) {
      onDeleteBatch(id);
    } else {
      await apiFetch(`/api/batches/${id}`, { method: 'DELETE' });
      mutate();
    }
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Batches</h1>
        <Button
          onClick={handleCreateClick}
          className="bg-indigo-700 hover:bg-indigo-800"
        >
          <Plus data-icon="inline-start" />
          Create Batch
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          <BatchCardSkeleton />
          <BatchCardSkeleton />
          <BatchCardSkeleton />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 text-red-700">
            <AlertCircle className="size-5 shrink-0" />
            <p>Failed to load batches. Please refresh the page.</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && batches.length === 0 && (
        <Card className="border-slate-100 bg-white">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-indigo-50 p-4">
              <Layers className="size-10 text-indigo-200" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">
              No batches yet
            </h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Create a batch to start marking student papers with AI
            </p>
            <Button
              onClick={handleCreateClick}
              className="bg-indigo-700 hover:bg-indigo-800"
            >
              <Plus data-icon="inline-start" />
              Create Your First Batch
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Batch Cards Grid */}
      {!isLoading && !error && batches.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {batches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch as Batch}
              onDelete={handleDeleteBatch}
            />
          ))}
        </div>
      )}

      {/* Create Batch Dialog (fallback when no onCreateBatch prop) */}
      {!onCreateBatch && (
        <CreateBatchDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onBatchCreated={handleBatchCreated}
        />
      )}
    </div>
  );
}
