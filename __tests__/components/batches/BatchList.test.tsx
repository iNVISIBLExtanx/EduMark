import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchList } from '@/components/batches/BatchList';

vi.mock('@/hooks/useBatches', () => ({
  useBatches: vi.fn(),
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
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

import { useBatches } from '@/hooks/useBatches';
import { apiFetch } from '@/lib/api-client';

const mockUseBatches = useBatches as ReturnType<typeof vi.fn>;

const sampleBatches = [
  { id: 'b1', name: 'Physics 2024 - Class A', status: 'completed', medium: 'english', total_papers: 10, marked_papers: 10, created_at: '2026-03-20', subject_name: null, paper_name: null },
  { id: 'b2', name: 'Chemistry 2024', status: 'processing', medium: 'sinhala', total_papers: 5, marked_papers: 2, created_at: '2026-03-21', subject_name: null, paper_name: null },
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
  it('shows loading state (Skeleton) when isLoading is true', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, isLoading: true });
    const { container } = render(<BatchList />);
    // Loading state renders Skeleton cards, not "Loading batches..." text
    expect(screen.queryByText('Physics 2024 - Class A')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows error message when error is set', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, error: new Error('Failed to load') });
    render(<BatchList />);
    // Component shows: "Failed to load batches. Please refresh the page."
    expect(screen.getByText('Failed to load batches. Please refresh the page.')).toBeInTheDocument();
  });

  it('shows empty state when batches is empty', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, batches: [] });
    render(<BatchList />);
    // Component shows "No batches yet" heading
    expect(screen.getByText('No batches yet')).toBeInTheDocument();
    expect(screen.getByText('Create a batch to start marking student papers with AI')).toBeInTheDocument();
  });

  it('renders batch names in the card', () => {
    render(<BatchList />);
    // Batch names are in <h3> tags (not as links)
    expect(screen.getByText('Physics 2024 - Class A')).toBeInTheDocument();
    expect(screen.getByText('Chemistry 2024')).toBeInTheDocument();
  });

  it('renders View links to /batches/{id} for each batch', () => {
    render(<BatchList />);
    // Each card has a "View" button that links to the batch detail page
    const viewLinks = screen.getAllByText('View');
    expect(viewLinks.length).toBe(2);
    expect(viewLinks[0].closest('a')).toHaveAttribute('href', '/batches/b1');
    expect(viewLinks[1].closest('a')).toHaveAttribute('href', '/batches/b2');
  });

  it('shows marked/total papers count for processing and completed batches', () => {
    render(<BatchList />);
    // Progress row shows "{marked} / {total} papers marked" for processing + completed
    expect(screen.getByText(/10 \/ 10 papers marked/)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 5 papers marked/)).toBeInTheDocument();
  });

  it('renders status labels for each batch', () => {
    render(<BatchList />);
    // StatusBadge renders the config label: "Completed", "Processing"
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('renders medium labels for each batch', () => {
    render(<BatchList />);
    // MEDIUM_LABELS maps medium to label: "English", "Sinhala"
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Sinhala')).toBeInTheDocument();
  });

  it('renders multiple batches', () => {
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

  it('opens AlertDialog when trash icon is clicked', () => {
    render(<BatchList />);
    fireEvent.click(screen.getByLabelText('Delete Physics 2024 - Class A'));
    // AlertDialog renders the dialog content including the title
    expect(screen.getByText('Delete Batch?')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
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

  it('shows delete confirmation description text', () => {
    render(<BatchList />);
    fireEvent.click(screen.getByLabelText('Delete Physics 2024 - Class A'));
    expect(screen.getByText(/permanently delete the batch/)).toBeInTheDocument();
  });
});
