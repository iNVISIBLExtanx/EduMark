'use client';

import { Fragment, useState } from 'react';
import { useBatchDetail } from '@/hooks/useBatchDetail';
import { useSubmissions } from '@/hooks/useSubmissions';
import { BatchStatusBadge } from './BatchStatusBadge';
import { LanguageBadge } from '@/components/shared/LanguageBadge';
import { SubmissionResultsPanel } from './SubmissionResultsPanel';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
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

  if (isLoading) return <p className="p-6">Loading batch...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error.message}</p>;
  if (!batch) return <p className="p-6 text-gray-500">Batch not found</p>;

  const toggleExpand = (submissionId: string) => {
    setExpandedSubmissionId((prev) => (prev === submissionId ? null : submissionId));
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

      {/* TODO Phase 10: Add "Download Report" links per submission */}
    </div>
  );
}
