'use client';

import { useState } from 'react';
import { Loader2, Download, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SubmissionResultsPanel } from './SubmissionResultsPanel';
import { createBrowserClient } from '@/lib/supabase/client';

interface SubmissionReviewDialogProps {
  submissionId: string;
  studentName: string;
  language: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SubmissionReviewDialog({
  submissionId,
  studentName,
  language,
  isOpen,
  onClose,
}: SubmissionReviewDialogProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token ?? ''}` };
  };

  const triggerDownload = async (headers: Record<string, string>) => {
    const res = await fetch(`/api/reports/${submissionId}/download`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Failed to download report');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${studentName.replace(/\s+/g, '-')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApproveAndDownload = async () => {
    setDownloadingId('approve');
    try {
      const headers = await getAuthHeaders();
      const approveRes = await fetch(`/api/reports/${submissionId}/approve`, {
        method: 'POST',
        headers,
      });
      if (!approveRes.ok) {
        const err = await approveRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to approve report');
      }
      await triggerDownload(headers);
    } catch (err) {
      console.error('Approve & download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownload = async () => {
    setDownloadingId('download');
    try {
      const headers = await getAuthHeaders();
      await triggerDownload(headers);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="review-dialog"
        className="top-0 left-0 translate-x-0 translate-y-0 max-w-none w-screen h-screen rounded-none flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-lg">{studentName} — Marking Review</DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        {/* Scrollable results area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <SubmissionResultsPanel submissionId={submissionId} language={language} />
        </div>

        <DialogFooter className="flex-row justify-end gap-2 px-6 pb-6 pt-4 border-t shrink-0 rounded-none bg-transparent">
          <Button
            variant="outline"
            disabled={!!downloadingId}
            onClick={handleDownload}
            data-testid="review-dialog-download"
          >
            {downloadingId === 'download' ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Download Report
          </Button>
          <Button
            disabled={!!downloadingId}
            onClick={handleApproveAndDownload}
            data-testid="review-dialog-approve"
          >
            {downloadingId === 'approve' ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Approve &amp; Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
