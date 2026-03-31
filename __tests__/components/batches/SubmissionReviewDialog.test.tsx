import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubmissionReviewDialog } from '@/components/batches/SubmissionReviewDialog';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, 'data-testid': testId }: { children: React.ReactNode; 'data-testid'?: string }) => (
    <div data-testid={testId ?? 'dialog-content'}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/batches/SubmissionResultsPanel', () => ({
  SubmissionResultsPanel: ({ submissionId }: { submissionId: string }) => (
    <div data-testid="results-panel">{submissionId}</div>
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Download: () => <span data-testid="icon-download" />,
  Check: () => <span data-testid="icon-check" />,
  Loader2: () => <span data-testid="icon-loader" />,
}));

const defaultProps = {
  submissionId: 'sub-1',
  studentName: 'Alice Perera',
  language: 'english',
  isOpen: true,
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  defaultProps.onClose = vi.fn();
});

describe('SubmissionReviewDialog', () => {
  it('renders when isOpen is true', () => {
    render(<SubmissionReviewDialog {...defaultProps} />);
    expect(screen.getByTestId('review-dialog')).toBeInTheDocument();
  });

  it('does not render content when isOpen is false', () => {
    render(<SubmissionReviewDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('review-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('results-panel')).not.toBeInTheDocument();
  });

  it('shows student name in title', () => {
    render(<SubmissionReviewDialog {...defaultProps} />);
    expect(screen.getByText('Alice Perera — Marking Review')).toBeInTheDocument();
  });

  it('renders SubmissionResultsPanel with correct submissionId', () => {
    render(<SubmissionReviewDialog {...defaultProps} />);
    const panel = screen.getByTestId('results-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent('sub-1');
  });

  it('calls onClose when Close button is clicked', () => {
    render(<SubmissionReviewDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('review-dialog-close'));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it('triggers approve then download fetch when Approve & Download is clicked', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' })),
      });
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:url'), revokeObjectURL: vi.fn() });

    render(<SubmissionReviewDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('review-dialog-approve'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/reports/sub-1/approve',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/reports/sub-1/download',
        expect.any(Object),
      );
    });

    vi.unstubAllGlobals();
  });

  it('triggers download fetch when Download Report is clicked', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' })),
    });
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:url'), revokeObjectURL: vi.fn() });

    render(<SubmissionReviewDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('review-dialog-download'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/reports/sub-1/download',
        expect.any(Object),
      );
    });

    vi.unstubAllGlobals();
  });
});
