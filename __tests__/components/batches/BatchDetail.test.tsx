import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchDetail } from '@/components/batches/BatchDetail';

vi.mock('@/hooks/useBatchDetail', () => ({
  useBatchDetail: vi.fn(),
}));
vi.mock('@/hooks/useSubmissions', () => ({
  useSubmissions: vi.fn(),
}));
vi.mock('@/hooks/useBatchPolling', () => ({
  useBatchPolling: vi.fn(),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock('@/components/batches/BatchStatusBadge', () => ({
  BatchStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('@/components/shared/LanguageBadge', () => ({
  LanguageBadge: ({ language }: { language: string }) => <span data-testid="language-badge">{language}</span>,
}));
vi.mock('@/components/batches/SubmissionResultsPanel', () => ({
  SubmissionResultsPanel: ({ submissionId }: { submissionId: string }) => (
    <div data-testid="results-panel">{submissionId}</div>
  ),
}));
vi.mock('@/components/batches/BulkUploader', () => ({
  BulkUploader: ({ batchId }: { batchId: string }) => <div data-testid="bulk-uploader">{batchId}</div>,
}));
vi.mock('@/components/billing/UpgradeModal', () => ({
  UpgradeModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="upgrade-modal" /> : null,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="chevron-down" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
  Download: () => <span data-testid="icon-download" />,
  Check: () => <span data-testid="icon-check" />,
  Loader2: () => <span data-testid="icon-loader" />,
  Zap: () => <span data-testid="icon-zap" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  XCircle: () => <span data-testid="icon-x-circle" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Pencil: () => <span data-testid="icon-pencil" />,
}));
vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
    },
  }),
}));

import { useBatchDetail } from '@/hooks/useBatchDetail';
import { useSubmissions } from '@/hooks/useSubmissions';
import { useBatchPolling } from '@/hooks/useBatchPolling';
import { useSubscription } from '@/hooks/useSubscription';
import { apiFetch } from '@/lib/api-client';

const mockUseBatchDetail = useBatchDetail as ReturnType<typeof vi.fn>;
const mockUseSubmissions = useSubmissions as ReturnType<typeof vi.fn>;
const mockUseBatchPolling = useBatchPolling as ReturnType<typeof vi.fn>;
const mockUseSubscription = useSubscription as ReturnType<typeof vi.fn>;
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

const defaultBatch = {
  batch: {
    id: 'b1',
    name: 'Physics 2024 - Class A',
    status: 'pending',
    medium: 'english',
    total_papers: 3,
    marked_papers: 0,
    created_at: '2026-03-22',
  },
  isLoading: false,
  error: null,
  mutate: vi.fn(),
};

const defaultSubmissions = {
  submissions: [
    {
      id: 's1',
      student_id: 'st1',
      pdf_url: 'path/to.pdf',
      page_count: 4,
      status: 'pending',
      created_at: '2026-03-22',
      students: { name: 'Kasun Perera', index_no: '12345' },
    },
    {
      id: 's2',
      student_id: 'st2',
      pdf_url: 'path/to2.pdf',
      page_count: 3,
      status: 'marked',
      created_at: '2026-03-22',
      students: { name: 'Dilshan Silva', index_no: null },
    },
  ],
  isLoading: false,
  error: null,
  mutate: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBatchDetail.mockReturnValue(defaultBatch);
  mockUseSubmissions.mockReturnValue(defaultSubmissions);
  mockUseBatchPolling.mockReturnValue({ results: null, isDone: false, error: null });
  mockUseSubscription.mockReturnValue({ available: 40, subscription: { plan: 'starter' }, isFree: false, isLoading: false, error: null, usagePercent: 20, isPastDue: false, mutate: vi.fn() });
});

describe('BatchDetail', () => {
  it('shows loading state when batch is loading', () => {
    mockUseBatchDetail.mockReturnValue({ ...defaultBatch, isLoading: true });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('Loading batch...')).toBeInTheDocument();
  });

  it('shows error message on batch error', () => {
    mockUseBatchDetail.mockReturnValue({ ...defaultBatch, error: new Error('Failed to load') });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('Error: Failed to load')).toBeInTheDocument();
  });

  it('shows "Batch not found" when batch is null', () => {
    mockUseBatchDetail.mockReturnValue({ ...defaultBatch, batch: null });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('Batch not found')).toBeInTheDocument();
  });

  it('renders batch name as heading', () => {
    render(<BatchDetail batchId="b1" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Physics 2024 - Class A');
  });

  it('shows status badge and language badge', () => {
    render(<BatchDetail batchId="b1" />);
    // One for the batch header + two for submissions in table
    const statusBadges = screen.getAllByTestId('status-badge');
    expect(statusBadges[0]).toHaveTextContent('pending');
    expect(screen.getByTestId('language-badge')).toHaveTextContent('english');
  });

  it('shows marked/total count', () => {
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('0/3 marked')).toBeInTheDocument();
  });

  it('shows submissions loading state', () => {
    mockUseSubmissions.mockReturnValue({ ...defaultSubmissions, isLoading: true, submissions: [] });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('Loading submissions...')).toBeInTheDocument();
  });

  it('shows empty submissions message', () => {
    mockUseSubmissions.mockReturnValue({ ...defaultSubmissions, submissions: [] });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('No submissions uploaded yet.')).toBeInTheDocument();
  });

  it('renders submissions table with student data', () => {
    render(<BatchDetail batchId="b1" />);
    // Student names
    expect(screen.getByText('Kasun Perera')).toBeInTheDocument();
    expect(screen.getByText('Dilshan Silva')).toBeInTheDocument();
    // Index number and null fallback
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    // Submission count in heading
    expect(screen.getByText('Submissions (2)')).toBeInTheDocument();
  });

  it('shows View Results button for marked submissions', () => {
    mockUseSubmissions.mockReturnValue({
      ...defaultSubmissions,
      submissions: [
        { ...defaultSubmissions.submissions[1], status: 'marked' },
      ],
    });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('View Results')).toBeInTheDocument();
  });

  it('does not show View Results for pending submissions', () => {
    render(<BatchDetail batchId="b1" />);
    // First submission is pending, should not have View Results
    const buttons = screen.queryAllByText('View Results');
    // Only the marked submission (s2) should have the button
    expect(buttons).toHaveLength(1);
  });

  it('shows Actions column header', () => {
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders SubmissionResultsPanel when View Results is clicked', async () => {
    mockUseSubmissions.mockReturnValue({
      ...defaultSubmissions,
      submissions: [
        { ...defaultSubmissions.submissions[1], status: 'marked' },
      ],
    });
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByText('View Results'));
    expect(screen.getByTestId('results-panel')).toBeInTheDocument();
    expect(screen.getByText('Hide Results')).toBeInTheDocument();
  });

  it('toggles results panel: clicking View Results then Hide Results hides the panel', () => {
    mockUseSubmissions.mockReturnValue({
      ...defaultSubmissions,
      submissions: [
        { ...defaultSubmissions.submissions[1], status: 'marked' },
      ],
    });
    render(<BatchDetail batchId="b1" />);
    // First click: open
    fireEvent.click(screen.getByText('View Results'));
    expect(screen.getByTestId('results-panel')).toBeInTheDocument();
    // Second click: close
    fireEvent.click(screen.getByText('Hide Results'));
    expect(screen.queryByTestId('results-panel')).not.toBeInTheDocument();
    expect(screen.getByText('View Results')).toBeInTheDocument();
  });

  // --- Download/Approve button tests ---

  it('shows Download Report and Approve & Download buttons for marked submissions', () => {
    render(<BatchDetail batchId="b1" />);
    // s2 is marked — should have both buttons
    expect(screen.getByText('Download Report')).toBeInTheDocument();
    expect(screen.getByText('Approve & Download')).toBeInTheDocument();
  });

  it('does not show download buttons for pending submissions', () => {
    mockUseSubmissions.mockReturnValue({
      ...defaultSubmissions,
      submissions: [
        { ...defaultSubmissions.submissions[0], status: 'pending' },
      ],
    });
    render(<BatchDetail batchId="b1" />);
    expect(screen.queryByText('Download Report')).not.toBeInTheDocument();
    expect(screen.queryByText('Approve & Download')).not.toBeInTheDocument();
  });

  it('triggers fetch when Approve & Download is clicked', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ approved: true }), blob: () => Promise.resolve(new Blob()) });
    vi.stubGlobal('fetch', mockFetch);

    mockUseSubmissions.mockReturnValue({
      ...defaultSubmissions,
      submissions: [
        { ...defaultSubmissions.submissions[1], status: 'marked' },
      ],
    });
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByText('Approve & Download'));

    // Wait for the async handler to fire
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/reports/s2/approve',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    vi.unstubAllGlobals();
  });

  it('triggers download fetch when Download Report is clicked', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) });
    vi.stubGlobal('fetch', mockFetch);

    mockUseSubmissions.mockReturnValue({
      ...defaultSubmissions,
      submissions: [
        { ...defaultSubmissions.submissions[1], status: 'marked' },
      ],
    });
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByText('Download Report'));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/reports/s2/download',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }),
      );
    });

    vi.unstubAllGlobals();
  });

  // --- Dispatch button tests ---

  it('shows "Mark Papers" button when batch is pending and has submissions', () => {
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByTestId('dispatch-button')).toBeInTheDocument();
    expect(screen.getByText('Mark Papers')).toBeInTheDocument();
  });

  it('does not show "Mark Papers" when no submissions', () => {
    mockUseSubmissions.mockReturnValue({ ...defaultSubmissions, submissions: [] });
    render(<BatchDetail batchId="b1" />);
    expect(screen.queryByTestId('dispatch-button')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Papers')).not.toBeInTheDocument();
  });

  it('does not show "Mark Papers" when status is processing', () => {
    mockUseBatchDetail.mockReturnValue({
      ...defaultBatch,
      batch: { ...defaultBatch.batch, status: 'processing' },
    });
    render(<BatchDetail batchId="b1" />);
    expect(screen.queryByTestId('dispatch-button')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Papers')).not.toBeInTheDocument();
  });

  it('shows available AI minutes text near the dispatch button', () => {
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('40 AI minutes remaining')).toBeInTheDocument();
  });

  it('calls apiFetch on "Mark Papers" click', async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByText('Mark Papers'));

    await vi.waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/batches/b1/dispatch', { method: 'POST' });
    });
  });

  it('shows UpgradeModal on 402 insufficient_ai_minutes error', async () => {
    mockApiFetch.mockRejectedValue(new Error(JSON.stringify({ error: 'insufficient_ai_minutes' })));
    render(<BatchDetail batchId="b1" />);

    expect(screen.queryByTestId('upgrade-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Mark Papers'));

    await vi.waitFor(() => {
      expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();
    });
  });

  it('shows dispatch error on subscription_inactive', async () => {
    mockApiFetch.mockRejectedValue(new Error(JSON.stringify({ error: 'subscription_inactive' })));
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByText('Mark Papers'));

    await vi.waitFor(() => {
      expect(screen.getByTestId('dispatch-error')).toBeInTheDocument();
      expect(screen.getByText('Your subscription is inactive. Please update your payment method.')).toBeInTheDocument();
    });
  });

  // --- Processing status tests ---

  it('shows processing status with progress text when batch is processing', () => {
    mockUseBatchDetail.mockReturnValue({
      ...defaultBatch,
      batch: { ...defaultBatch.batch, status: 'processing', total_papers: 5, marked_papers: 2 },
    });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByTestId('processing-status')).toBeInTheDocument();
    expect(screen.getByText(/Marking.*papers/)).toBeInTheDocument();
  });

  it('shows "Marking complete" when batch is completed', () => {
    mockUseBatchDetail.mockReturnValue({
      ...defaultBatch,
      batch: { ...defaultBatch.batch, status: 'completed', marked_papers: 3 },
    });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByTestId('completed-status')).toBeInTheDocument();
    expect(screen.getByText('Marking complete')).toBeInTheDocument();
  });

  it('shows "Marking failed" when batch is failed', () => {
    mockUseBatchDetail.mockReturnValue({
      ...defaultBatch,
      batch: { ...defaultBatch.batch, status: 'failed' },
    });
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByTestId('failed-status')).toBeInTheDocument();
    expect(screen.getByText('Marking failed')).toBeInTheDocument();
  });

  // --- BulkUploader integration tests ---

  it('renders BulkUploader when batch is pending', () => {
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByTestId('bulk-uploader')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-uploader')).toHaveTextContent('b1');
  });

  it('does not render BulkUploader when batch is completed', () => {
    mockUseBatchDetail.mockReturnValue({
      ...defaultBatch,
      batch: { ...defaultBatch.batch, status: 'completed' },
    });
    render(<BatchDetail batchId="b1" />);
    expect(screen.queryByTestId('bulk-uploader')).not.toBeInTheDocument();
  });

  // --- UpgradeModal tests ---

  it('UpgradeModal is not shown by default', () => {
    render(<BatchDetail batchId="b1" />);
    expect(screen.queryByTestId('upgrade-modal')).not.toBeInTheDocument();
  });

  // --- Back button tests ---

  it('renders Back to Batches button', () => {
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByText('Back to Batches')).toBeInTheDocument();
  });

  it('navigates to /batches on back button click', () => {
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByText('Back to Batches'));
    expect(mockPush).toHaveBeenCalledWith('/batches');
  });

  // --- Edit batch name tests ---

  it('renders edit batch name button', () => {
    render(<BatchDetail batchId="b1" />);
    expect(screen.getByLabelText('Edit batch name')).toBeInTheDocument();
  });

  it('shows input with current name on edit click', () => {
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByLabelText('Edit batch name'));
    const input = screen.getByDisplayValue('Physics 2024 - Class A');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls PATCH API with new name on save', async () => {
    mockApiFetch.mockResolvedValue({ updated: true });
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByLabelText('Edit batch name'));
    const input = screen.getByDisplayValue('Physics 2024 - Class A');
    fireEvent.change(input, { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByText('Save'));

    await vi.waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/batches/b1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Name' }),
      });
    });
  });

  it('cancels editing without API call', () => {
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByLabelText('Edit batch name'));
    expect(screen.getByDisplayValue('Physics 2024 - Class A')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Physics 2024 - Class A');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('does not call API when name is unchanged', async () => {
    render(<BatchDetail batchId="b1" />);
    fireEvent.click(screen.getByLabelText('Edit batch name'));
    fireEvent.click(screen.getByText('Save'));
    // Give any async handlers time to fire
    await vi.waitFor(() => {
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });
});
