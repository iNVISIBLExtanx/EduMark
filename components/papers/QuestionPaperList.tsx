'use client';

import { useState } from 'react';
import { useQuestionPapers } from '@/hooks/useQuestionPapers';
import { apiFetch } from '@/lib/api-client';
import { SubjectBadge } from '@/components/shared/SubjectBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';

export function QuestionPaperList() {
  const { papers, isLoading, error, mutate } = useQuestionPapers();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isLoading) return <p className="p-6">Loading question papers...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error.message}</p>;

  if (papers.length === 0) {
    return (
      <p className="text-gray-500">
        No question papers yet. Upload one to get started.
      </p>
    );
  }

  function openDeleteDialog(paperId: string) {
    setDeletingId(paperId);
    setDeleteError(null);
    setConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiFetch(`/api/question-papers/${deletingId}`, { method: 'DELETE' });
      setConfirmOpen(false);
      setDeletingId(null);
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      // Parse API error message from response body
      if (message.includes('Cannot delete')) {
        setDeleteError(message);
      } else {
        setDeleteError(message);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">Title</th>
              <th className="pb-2 font-medium">Subject</th>
              <th className="pb-2 font-medium">Year</th>
              <th className="pb-2 font-medium">Uploaded</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((paper) => (
              <tr key={paper.id} className="border-b last:border-0">
                <td className="py-3 font-medium">{paper.title}</td>
                <td className="py-3">
                  <SubjectBadge subject={paper.subjects.name} />
                </td>
                <td className="py-3 text-gray-500">{paper.year ?? '—'}</td>
                <td className="py-3 text-gray-500">
                  {new Date(paper.created_at).toLocaleDateString()}
                </td>
                <td className="py-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openDeleteDialog(paper.id)}
                    aria-label={`Delete ${paper.title}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Question Paper</DialogTitle>
            <DialogDescription>
              This will permanently delete the question paper and its marking scheme. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-red-600">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
