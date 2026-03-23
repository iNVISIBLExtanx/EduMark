'use client';

import { useState } from 'react';
import { useQuestionPapers } from '@/hooks/useQuestionPapers';
import { useTutorProfile } from '@/hooks/useTutorProfile';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreateBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBatchCreated: (batchId: string) => void;
}

interface BatchResponse {
  id: string;
  name: string;
  status: string;
}

const MEDIUM_LABELS: Record<string, string> = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

export function CreateBatchDialog({ open, onOpenChange, onBatchCreated }: CreateBatchDialogProps) {
  const { papers, isLoading: papersLoading } = useQuestionPapers();
  const { tutor } = useTutorProfile();

  const [name, setName] = useState('');
  const [paperId, setPaperId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const medium = tutor?.marking_language ?? '';

  function resetForm() {
    setName('');
    setPaperId('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Batch name is required');
      return;
    }
    if (!paperId) {
      setError('Please select a question paper');
      return;
    }
    if (!medium) {
      setError('Marking language not set. Please update your profile in Settings.');
      return;
    }

    const selectedPaper = papers.find((p) => p.id === paperId);
    if (!selectedPaper || !selectedPaper.marking_schemes?.[0]) {
      setError('Selected paper has no marking scheme');
      return;
    }

    setCreating(true);

    try {
      const batch = await apiFetch<BatchResponse>('/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          paper_id: paperId,
          scheme_id: selectedPaper.marking_schemes[0].id,
          medium,
        }),
      });
      resetForm();
      onOpenChange(false);
      onBatchCreated(batch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Batch</DialogTitle>
          <DialogDescription>
            Create a new marking batch for a question paper. You can upload student papers after creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batch-name">Batch Name</Label>
            <Input
              id="batch-name"
              placeholder="e.g. Physics 2025 - Class A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-paper">Question Paper</Label>
            <select
              id="batch-paper"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={paperId}
              onChange={(e) => setPaperId(e.target.value)}
              disabled={papersLoading}
            >
              <option value="">Select a question paper</option>
              {papers.map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.title} ({paper.subjects.name}{paper.year ? `, ${paper.year}` : ''})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Medium</Label>
            <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
              {medium ? MEDIUM_LABELS[medium] ?? medium : 'Not set — update in Settings'}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating || papersLoading}>
              {creating ? 'Creating...' : 'Create Batch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
