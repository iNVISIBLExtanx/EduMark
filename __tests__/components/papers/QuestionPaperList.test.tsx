import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionPaperList } from '@/components/papers/QuestionPaperList';

// Mock hooks
const mockMutate = vi.fn();
vi.mock('@/hooks/useQuestionPapers', () => ({
  useQuestionPapers: vi.fn(),
}));

// Mock apiFetch
const mockApiFetch = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Mock SubjectBadge as simple passthrough
vi.mock('@/components/shared/SubjectBadge', () => ({
  SubjectBadge: ({ subject }: { subject: string }) => <span>{subject}</span>,
}));

// Mock Dialog components to render children directly (avoids portal issues)
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { useQuestionPapers } from '@/hooks/useQuestionPapers';

const mockUseQuestionPapers = vi.mocked(useQuestionPapers);

const samplePapers = [
  {
    id: 'p1',
    title: 'Combined Maths 2024',
    year: 2024,
    pdf_url: '/papers/p1.pdf',
    subject_id: 's1',
    created_at: '2026-03-20T10:00:00Z',
    subjects: { name: 'Combined Maths', code: 'CM' },
    marking_schemes: [{ id: 'ms1' }],
  },
  {
    id: 'p2',
    title: 'Physics Paper I',
    year: null,
    pdf_url: '/papers/p2.pdf',
    subject_id: 's2',
    created_at: '2026-03-21T12:00:00Z',
    subjects: { name: 'Physics', code: 'PHY' },
    marking_schemes: [],
  },
];

const defaultReturn = {
  papers: samplePapers,
  isLoading: false,
  error: null,
  mutate: mockMutate,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuestionPapers.mockReturnValue(defaultReturn as ReturnType<typeof useQuestionPapers>);
});

describe('QuestionPaperList', () => {
  it('shows loading state when isLoading is true', () => {
    mockUseQuestionPapers.mockReturnValue({
      ...defaultReturn,
      isLoading: true,
    } as ReturnType<typeof useQuestionPapers>);
    render(<QuestionPaperList />);
    expect(screen.getByText('Loading question papers...')).toBeInTheDocument();
  });

  it('shows error state when error is set', () => {
    mockUseQuestionPapers.mockReturnValue({
      ...defaultReturn,
      error: new Error('Failed to load papers'),
    } as ReturnType<typeof useQuestionPapers>);
    render(<QuestionPaperList />);
    expect(screen.getByText('Error: Failed to load papers')).toBeInTheDocument();
  });

  it('shows empty state when no papers exist', () => {
    mockUseQuestionPapers.mockReturnValue({
      ...defaultReturn,
      papers: [],
    } as ReturnType<typeof useQuestionPapers>);
    render(<QuestionPaperList />);
    expect(
      screen.getByText('No question papers yet. Upload one to get started.')
    ).toBeInTheDocument();
  });

  it('renders table with papers including all columns', () => {
    render(<QuestionPaperList />);

    // Table headers
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Paper data
    expect(screen.getByText('Combined Maths 2024')).toBeInTheDocument();
    expect(screen.getByText('Combined Maths')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();

    expect(screen.getByText('Physics Paper I')).toBeInTheDocument();
    expect(screen.getByText('Physics')).toBeInTheDocument();
    // Null year displays as dash
    const dashCells = screen.getAllByText('—');
    expect(dashCells.length).toBeGreaterThanOrEqual(1);

    // Delete buttons with aria-labels
    expect(screen.getByLabelText('Delete Combined Maths 2024')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Physics Paper I')).toBeInTheDocument();
  });

  it('opens confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<QuestionPaperList />);

    await user.click(screen.getByLabelText('Delete Combined Maths 2024'));

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Question Paper')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This will permanently delete the question paper and its marking scheme. This action cannot be undone.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('closes dialog when Cancel is clicked without calling delete', async () => {
    const user = userEvent.setup();
    render(<QuestionPaperList />);

    await user.click(screen.getByLabelText('Delete Combined Maths 2024'));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('calls DELETE API and mutates on confirm', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({});
    render(<QuestionPaperList />);

    await user.click(screen.getByLabelText('Delete Combined Maths 2024'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/question-papers/p1', {
        method: 'DELETE',
      });
    });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    });

    // Dialog should close after successful delete
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('shows error message when delete fails', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockRejectedValue(
      new Error('Cannot delete: paper has associated batches')
    );
    render(<QuestionPaperList />);

    await user.click(screen.getByLabelText('Delete Physics Paper I'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        screen.getByText('Cannot delete: paper has associated batches')
      ).toBeInTheDocument();
    });

    // Dialog should remain open on error
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    // mutate should NOT have been called
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
