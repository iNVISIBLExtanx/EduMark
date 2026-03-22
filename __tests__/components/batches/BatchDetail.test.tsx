import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatchDetail } from '@/components/batches/BatchDetail';

vi.mock('@/hooks/useBatchDetail', () => ({
  useBatchDetail: vi.fn(),
}));
vi.mock('@/hooks/useSubmissions', () => ({
  useSubmissions: vi.fn(),
}));
vi.mock('@/components/batches/BatchStatusBadge', () => ({
  BatchStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('@/components/shared/LanguageBadge', () => ({
  LanguageBadge: ({ language }: { language: string }) => <span data-testid="language-badge">{language}</span>,
}));

import { useBatchDetail } from '@/hooks/useBatchDetail';
import { useSubmissions } from '@/hooks/useSubmissions';

const mockUseBatchDetail = useBatchDetail as ReturnType<typeof vi.fn>;
const mockUseSubmissions = useSubmissions as ReturnType<typeof vi.fn>;

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
});
