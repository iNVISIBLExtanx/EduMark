import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateBatchDialog } from '@/components/batches/CreateBatchDialog';

vi.mock('@/hooks/useQuestionPapers', () => ({
  useQuestionPapers: vi.fn(),
}));
vi.mock('@/hooks/useTutorProfile', () => ({
  useTutorProfile: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    ...props
  }: React.PropsWithChildren<React.LabelHTMLAttributes<HTMLLabelElement>>) => (
    <label {...props}>{children}</label>
  ),
}));

import { useQuestionPapers } from '@/hooks/useQuestionPapers';
import { useTutorProfile } from '@/hooks/useTutorProfile';
import { apiFetch } from '@/lib/api-client';

const PAPERS = [
  {
    id: 'paper-1',
    title: 'Physics 2025 Paper I',
    year: 2025,
    pdf_url: 'path/to/paper.pdf',
    subject_id: 'subj-1',
    created_at: '2026-03-01T00:00:00Z',
    subjects: { name: 'Physics', code: 'PHY' },
    marking_schemes: [{ id: 'scheme-1' }],
  },
  {
    id: 'paper-2',
    title: 'Chemistry 2024 Paper I',
    year: 2024,
    pdf_url: 'path/to/paper2.pdf',
    subject_id: 'subj-2',
    created_at: '2026-03-02T00:00:00Z',
    subjects: { name: 'Chemistry', code: 'CHEM' },
    marking_schemes: [{ id: 'scheme-2' }],
  },
];

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onBatchCreated: vi.fn(),
};

describe('CreateBatchDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuestionPapers).mockReturnValue({
      papers: PAPERS,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    } as ReturnType<typeof useQuestionPapers>);
    vi.mocked(useTutorProfile).mockReturnValue({
      tutor: { id: 'tutor-1', marking_language: 'sinhala', full_name: 'Test Tutor', email: 'test@test.com', plan: 'free' },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    } as ReturnType<typeof useTutorProfile>);
  });

  it('renders dialog when open=true with form fields', () => {
    render(<CreateBatchDialog {...defaultProps} />);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create Batch' })).toBeInTheDocument();
    expect(screen.getByLabelText('Batch Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Question Paper')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Batch' })).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<CreateBatchDialog {...defaultProps} open={false} />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('shows all papers in dropdown', () => {
    render(<CreateBatchDialog {...defaultProps} />);

    const select = screen.getByLabelText('Question Paper') as HTMLSelectElement;
    expect(select.options).toHaveLength(3); // placeholder + 2 papers
    expect(select.options[1].textContent).toBe('Physics 2025 Paper I (Physics, 2025)');
    expect(select.options[2].textContent).toBe('Chemistry 2024 Paper I (Chemistry, 2024)');
  });

  it('shows tutor marking_language as read-only medium', () => {
    render(<CreateBatchDialog {...defaultProps} />);

    expect(screen.getByText('Sinhala')).toBeInTheDocument();
    // No select element for medium
    expect(screen.queryByLabelText('Medium')).not.toBeInTheDocument();
  });

  it('shows validation error when name is empty on submit', async () => {
    const user = userEvent.setup();
    render(<CreateBatchDialog {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'Create Batch' });
    await user.click(submitButton);

    expect(screen.getByText('Batch name is required')).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });

  it('shows validation error when no paper selected on submit', async () => {
    const user = userEvent.setup();
    render(<CreateBatchDialog {...defaultProps} />);

    const nameInput = screen.getByLabelText('Batch Name');
    await user.type(nameInput, 'My Batch');

    const submitButton = screen.getByRole('button', { name: 'Create Batch' });
    await user.click(submitButton);

    expect(screen.getByText('Please select a question paper')).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });

  it('calls apiFetch with correct payload on successful submit', async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValue({ id: 'batch-123', name: 'My Batch', status: 'pending' });

    render(<CreateBatchDialog {...defaultProps} />);

    await user.type(screen.getByLabelText('Batch Name'), 'My Batch');
    await user.selectOptions(screen.getByLabelText('Question Paper'), 'paper-1');

    const submitButton = screen.getByRole('button', { name: 'Create Batch' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          name: 'My Batch',
          paper_id: 'paper-1',
          scheme_id: 'scheme-1',
          medium: 'sinhala',
        }),
      });
    });
  });

  it('calls onBatchCreated with batch ID on success', async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValue({ id: 'batch-123', name: 'My Batch', status: 'pending' });

    render(<CreateBatchDialog {...defaultProps} />);

    await user.type(screen.getByLabelText('Batch Name'), 'My Batch');
    await user.selectOptions(screen.getByLabelText('Question Paper'), 'paper-1');
    await user.click(screen.getByRole('button', { name: 'Create Batch' }));

    await waitFor(() => {
      expect(defaultProps.onBatchCreated).toHaveBeenCalledWith('batch-123');
    });
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error message when API call fails', async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockRejectedValue(new Error('Server error'));

    render(<CreateBatchDialog {...defaultProps} />);

    await user.type(screen.getByLabelText('Batch Name'), 'My Batch');
    await user.selectOptions(screen.getByLabelText('Question Paper'), 'paper-1');
    await user.click(screen.getByRole('button', { name: 'Create Batch' }));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
    expect(defaultProps.onBatchCreated).not.toHaveBeenCalled();
  });

  it('cancel button calls onOpenChange(false)', async () => {
    const user = userEvent.setup();
    render(<CreateBatchDialog {...defaultProps} />);

    await user.click(screen.getByText('Cancel'));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
