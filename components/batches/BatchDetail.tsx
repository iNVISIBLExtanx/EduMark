'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBatchDetail } from '@/hooks/useBatchDetail';
import { useSubmissions } from '@/hooks/useSubmissions';
import { useBatchPolling } from '@/hooks/useBatchPolling';
import { useSubscription } from '@/hooks/useSubscription';
import { BatchStatusBadge } from './BatchStatusBadge';
import { LanguageBadge } from '@/components/shared/LanguageBadge';
import { SubmissionResultsPanel } from './SubmissionResultsPanel';
import { BulkUploader } from './BulkUploader';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ChevronDown, ChevronRight, Download, Check, Loader2, Zap, CheckCircle, XCircle, Pencil } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function BatchDetail({ batchId }: { batchId: string }) {
  const router = useRouter();
  const { batch, isLoading, error, mutate } = useBatchDetail(batchId);
  const { submissions, isLoading: submissionsLoading, mutate: submissionsMutate } = useSubmissions(batchId);
  const { available } = useSubscription();
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  const { results: pollData, isDone } = useBatchPolling(
    batchId,
    batch?.status === 'processing'
  );

  useEffect(() => {
    if (isDone) {
      mutate();
      submissionsMutate();
    }
  }, [isDone, mutate, submissionsMutate]);

  if (isLoading) return <p className="p-6">Loading batch...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error.message}</p>;
  if (!batch) return <p className="p-6 text-gray-500">Batch not found</p>;

  const toggleExpand = (submissionId: string) => {
    setExpandedSubmissionId((prev) => (prev === submissionId ? null : submissionId));
  };

  const getAuthHeaders = async () => {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token ?? ''}` };
  };

  const handleDispatch = async () => {
    setDispatchError(null);
    setDispatching(true);
    try {
      await apiFetch(`/api/batches/${batchId}/dispatch`, { method: 'POST' });
      await mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dispatch failed';
      try {
        const parsed = JSON.parse(message);
        if (parsed.error === 'insufficient_ai_minutes') {
          setShowUpgradeModal(true);
        } else if (parsed.error === 'subscription_inactive') {
          setDispatchError('Your subscription is inactive. Please update your payment method.');
        } else {
          setDispatchError(parsed.error ?? 'Dispatch failed');
        }
      } catch {
        setDispatchError(message);
      }
    } finally {
      setDispatching(false);
    }
  };

  const handleApproveAndDownload = async (submissionId: string) => {
    setDownloadingId(submissionId);
    try {
      const headers = await getAuthHeaders();

      const approveRes = await fetch(`/api/reports/${submissionId}/approve`, {
        method: 'POST',
        headers,
      });
      if (!approveRes.ok) {
        const err = await approveRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to approve report');
      }

      await triggerDownload(submissionId, headers);
    } catch (err) {
      console.error('Approve & download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownload = async (submissionId: string) => {
    setDownloadingId(submissionId);
    try {
      const headers = await getAuthHeaders();
      await triggerDownload(submissionId, headers);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === batch?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await apiFetch(`/api/batches/${batchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      });
      await mutate();
      setEditingName(false);
    } catch {
      // keep editing on error
    } finally {
      setSavingName(false);
    }
  };

  const triggerDownload = async (submissionId: string, headers: Record<string, string>) => {
    const res = await fetch(`/api/reports/${submissionId}/download`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Failed to download report');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${submissionId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/batches')}
        className="mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Batches
      </Button>

      <div>
        <div className="flex items-center gap-2">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                maxLength={200}
                className="text-2xl font-bold h-auto py-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                disabled={savingName}
              />
              <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                {savingName ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingName(false)} disabled={savingName}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{batch.name}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setNameValue(batch.name); setEditingName(true); }}
                aria-label="Edit batch name"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <BatchStatusBadge status={batch.status} />
          <LanguageBadge language={batch.medium} />
          <span className="text-gray-500 text-sm">
            {batch.marked_papers}/{batch.total_papers} marked
          </span>
        </div>
      </div>

      {/* Dispatch / Status Section */}
      {batch.status === 'pending' && submissions.length > 0 && (
        <div className="space-y-2">
          <Button
            onClick={handleDispatch}
            disabled={dispatching}
            data-testid="dispatch-button"
          >
            {dispatching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Mark Papers
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500">{available} AI minutes remaining</p>
          {dispatchError && (
            <p className="text-sm text-red-600" data-testid="dispatch-error">
              {dispatchError}
            </p>
          )}
        </div>
      )}

      {batch.status === 'processing' && (
        <div className="flex items-center gap-2 text-blue-600" data-testid="processing-status">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">
            Marking {pollData?.results?.length ?? batch.marked_papers}/{batch.total_papers} papers...
          </span>
        </div>
      )}

      {batch.status === 'completed' && (
        <div className="flex items-center gap-2 text-green-600" data-testid="completed-status">
          <CheckCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Marking complete</span>
        </div>
      )}

      {batch.status === 'failed' && (
        <div className="flex items-center gap-2 text-red-600" data-testid="failed-status">
          <XCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Marking failed</span>
        </div>
      )}

      {/* Bulk Uploader — visible when batch is pending */}
      {batch.status === 'pending' && (
        <BulkUploader
          batchId={batchId}
          onUploadComplete={() => {
            submissionsMutate();
            mutate();
          }}
        />
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Submissions ({submissions.length})
        </h2>

        {submissionsLoading ? (
          <p className="text-gray-500">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <p className="text-gray-500">No submissions uploaded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Index No</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => {
                const isExpanded = expandedSubmissionId === submission.id;
                const isMarked = submission.status === 'marked';
                const isDownloading = downloadingId === submission.id;
                return (
                  <Fragment key={submission.id}>
                    <TableRow>
                      <TableCell>{submission.students.name}</TableCell>
                      <TableCell>{submission.students.index_no ?? '—'}</TableCell>
                      <TableCell>
                        <BatchStatusBadge status={submission.status} />
                      </TableCell>
                      <TableCell>
                        {isMarked && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(submission.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 mr-1" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mr-1" />
                              )}
                              {isExpanded ? 'Hide Results' : 'View Results'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isDownloading}
                              onClick={() => handleApproveAndDownload(submission.id)}
                              data-testid={`approve-download-${submission.id}`}
                            >
                              {isDownloading ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-1" />
                              )}
                              Approve & Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isDownloading}
                              onClick={() => handleDownload(submission.id)}
                              data-testid={`download-${submission.id}`}
                            >
                              {isDownloading ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4 mr-1" />
                              )}
                              Download Report
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && isMarked && (
                      <TableRow>
                        <TableCell colSpan={4} className="p-0 px-4 pb-4">
                          <SubmissionResultsPanel
                            submissionId={submission.id}
                            language={batch.medium}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}
