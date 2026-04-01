import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchList } from '@/components/batches/BatchList';

vi.mock('@/hooks/useBatches', () => ({
  useBatches: vi.fn(),
}));
vi.mock('@/components/batches/BatchStatusBadge', () => ({
  BatchStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('@/components/shared/LanguageBadge', () => ({
  LanguageBadge: ({ language }: { language: string }) => <span data-testid="language-badge">{language}</span>,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/batches/CreateBatchDialog', () => ({
  CreateBatchDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid="create-batch-dialog"><button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="delete-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: (e?: React.MouseEvent) => void }>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

import { useBatches } from '@/hooks/useBatches';
import { apiFetch } from '@/lib/api-client';

const mockUseBatches = useBatches as ReturnType<typeof vi.fn>;

const sampleBatches = [
  { id: 'b1', name: 'Physics 2024 - Class A', status: 'completed', medium: 'english', total_papers: 10, marked_papers: 10, created_at: '2026-03-20' },
  { id: 'b2', name: 'Chemistry 2024', status: 'processing', medium: 'sinhala', total_papers: 5, marked_papers: 2, created_at: '2026-03-21' },
];

const defaultReturn = {
  batches: sampleBatches,
  error: null,
  isLoading: false,
  mutate: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBatches.mockReturnValue(defaultReturn);
});

describe('BatchList', () => {
  it('shows loading state when isLoading is true', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, isLoading: true });
    render(<BatchList />);
    expect(screen.getByText('Loading batches...')).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, error: new Error('Failed to load') });
    render(<BatchList />);
    expect(screen.getByText('Error: Failed to load')).toBeInTheDocument();
  });

  it('shows empty state when batches is empty', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, batches: [] });
    render(<BatchList />);
    expect(screen.getByText('No batches yet. Create one to get started.')).toBeInTheDocument();
  });

  it('renders batch names as links to /batches/{id}', () => {
    render(<BatchList />);
    const link1 = screen.getByText('Physics 2024 - Class A').closest('a');
    const link2 = screen.getByText('Chemistry 2024').closest('a');
    expect(link1).toHaveAttribute('href', '/batches/b1');
    expect(link2).toHaveAttribute('href', '/batches/b2');
  });

  it('shows marked/total papers count per batch', () => {
    render(<BatchList />);
    expect(screen.getByText('10/10 papers marked')).toBeInTheDocument();
    expect(screen.getByText('2/5 papers marked')).toBeInTheDocument();
  });

  it('renders status and language badges for each batch', () => {
    render(<BatchList />);
    const statusBadges = screen.getAllByTestId('status-badge');
    const languageBadges = screen.getAllByTestId('language-badge');
    expect(statusBadges).toHaveLength(2);
    expect(languageBadges).toHaveLength(2);
    expect(statusBadges[0]).toHaveTextContent('completed');
    expect(statusBadges[1]).toHaveTextContent('processing');
    expect(languageBadges[0]).toHaveTextContent('english');
    expect(languageBadges[1]).toHaveTextContent('sinhala');
  });

  it('renders multiple batches as list items', () => {
    render(<BatchList />);
    expect(screen.getByText('Physics 2024 - Class A')).toBeInTheDocument();
    expect(screen.getByText('Chemistry 2024')).toBeInTheDocument();
  });

  it('renders Create Batch button', () => {
    render(<BatchList />);
    expect(screen.getByText('Create Batch')).toBeInTheDocument();
  });

  it('opens CreateBatchDialog when Create Batch button is clicked', () => {
    render(<BatchList />);
    expect(screen.queryByTestId('create-batch-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Create Batch'));
    expect(screen.getByTestId('create-batch-dialog')).toBeInTheDocument();
  });

  // --- Delete batch from card ---

  it('renders delete button on each batch card', () => {
    render(<BatchList />);
    expect(screen.getByLabelText('Delete Physics 2024 - Class A')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Chemistry 2024')).toBeInTheDocument();
  });

  it('opens delete dialog when trash icon is clicked', () => {
    render(<BatchList />);
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Delete Physics 2024 - Class A'));
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Batch')).toBeInTheDocument();
  });

  it('calls DELETE API and refreshes on confirm', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ deleted: true });
    render(<BatchList />);
    fireEvent.click(screen.getByLabelText('Delete Physics 2024 - Class A'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/api/batches/b1', { method: 'DELETE' });
      expect(defaultReturn.mutate).toHaveBeenCalled();
    });
  });

  it('shows error in delete dialog on failure', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Cannot delete a batch while it is being processed.'));
    render(<BatchList />);
    fireEvent.click(screen.getByLabelText('Delete Physics 2024 - Class A'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(screen.getByText('Cannot delete a batch while it is being processed.')).toBeInTheDocument();
    });
  });
});
