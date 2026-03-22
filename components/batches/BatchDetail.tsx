'use client';

import { useBatchDetail } from '@/hooks/useBatchDetail';
import { useSubmissions } from '@/hooks/useSubmissions';
import { BatchStatusBadge } from './BatchStatusBadge';
import { LanguageBadge } from '@/components/shared/LanguageBadge';
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

  if (isLoading) return <p className="p-6">Loading batch...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error.message}</p>;
  if (!batch) return <p className="p-6 text-gray-500">Batch not found</p>;

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>{submission.students.name}</TableCell>
                  <TableCell>{submission.students.index_no ?? '—'}</TableCell>
                  <TableCell>
                    <BatchStatusBadge status={submission.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* TODO Phase 9: Show marking results using MarkingSummary + QuestionFeedbackCard */}
      {/* TODO Phase 10: Add "Download Report" links per submission */}
    </div>
  );
}
