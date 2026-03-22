'use client';

import { Fragment, useState } from 'react';
import { useBatchDetail } from '@/hooks/useBatchDetail';
import { useSubmissions } from '@/hooks/useSubmissions';
import { BatchStatusBadge } from './BatchStatusBadge';
import { LanguageBadge } from '@/components/shared/LanguageBadge';
import { SubmissionResultsPanel } from './SubmissionResultsPanel';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Download, Check, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function BatchDetail({ batchId }: { batchId: string }) {
  const { batch, isLoading, error } = useBatchDetail(batchId);
  const { submissions, isLoading: submissionsLoading } = useSubmissions(batchId);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const handleApproveAndDownload = async (submissionId: string) => {
    setDownloadingId(submissionId);
    try {
      const headers = await getAuthHeaders();

      // Approve first
      const approveRes = await fetch(`/api/reports/${submissionId}/approve`, {
        method: 'POST',
        headers,
      });
      if (!approveRes.ok) {
        const err = await approveRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to approve report');
      }

      // Then download
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
      <div>
        <h1 className="text-2xl font-bold">{batch.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <BatchStatusBadge status={batch.status} />
          <LanguageBadge language={batch.medium} />
          <span className="text-gray-500 text-sm">
            {batch.marked_papers}/{batch.total_papers} marked
          </span>
        </div>
      </div>

      {/* TODO Phase 8: Add "Dispatch to AI" button — POST /api/batches/[id]/dispatch */}

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
    </div>
  );
}
