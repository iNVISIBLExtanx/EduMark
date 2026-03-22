import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionPaperUploadForm } from './QuestionPaperUploadForm';

const SUBJECT_1 = '550e8400-e29b-41d4-a716-446655440001';
const SUBJECT_2 = '550e8400-e29b-41d4-a716-446655440002';

// Mock hooks
const mockMutate = vi.fn();
vi.mock('@/hooks/useTutorSubjects', () => ({
  useTutorSubjects: () => ({
    subjects: [
      { subject_id: SUBJECT_1, subjects: { id: SUBJECT_1, name: 'Combined Maths', code: 'CM' } },
      { subject_id: SUBJECT_2, subjects: { id: SUBJECT_2, name: 'Physics', code: 'PHY' } },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useQuestionPapers', () => ({
  useQuestionPapers: () => ({
    papers: [],
    isLoading: false,
    error: null,
    mutate: mockMutate,
  }),
}));

// Mock apiUpload
const mockApiUpload = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiUpload: (...args: unknown[]) => mockApiUpload(...args),
}));

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Title'), 'Test Paper');
  // Set the select value directly, then fire change for react-hook-form
  const select = screen.getByLabelText('Subject') as HTMLSelectElement;
  await user.selectOptions(select, SUBJECT_1);
}

function attachPdfFile() {
  const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
  const input = screen.getByLabelText(/Question Paper PDF/);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  return file;
}

function attachSchemeFile() {
  const file = new File(['scheme content'], 'scheme.pdf', { type: 'application/pdf' });
  const input = screen.getByLabelText(/Marking Scheme PDF/);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  return file;
}

describe('QuestionPaperUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders subject dropdown with tutor subjects', () => {
    render(<QuestionPaperUploadForm />);
    expect(screen.getByText('Combined Maths')).toBeDefined();
    expect(screen.getByText('Physics')).toBeDefined();
  });

  it('renders all form fields', () => {
    render(<QuestionPaperUploadForm />);
    expect(screen.getByLabelText('Title')).toBeDefined();
    expect(screen.getByLabelText('Subject')).toBeDefined();
    expect(screen.getByLabelText(/Year/)).toBeDefined();
    expect(screen.getByLabelText(/Question Paper PDF/)).toBeDefined();
    expect(screen.getByLabelText(/Marking Scheme PDF/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDefined();
  });

  it('shows validation errors when form submitted without required fields', async () => {
    const user = userEvent.setup();
    render(<QuestionPaperUploadForm />);

    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      const errors = screen.getAllByText(/required|invalid/i);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('shows error when no PDF file is selected', async () => {
    const user = userEvent.setup();
    render(<QuestionPaperUploadForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(screen.getByText(/Please select a question paper PDF/)).toBeDefined();
    });
  });

  it('shows error when no marking scheme is selected', async () => {
    const user = userEvent.setup();
    render(<QuestionPaperUploadForm />);

    await fillRequiredFields(user);
    attachPdfFile();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(screen.getByText(/Please select a marking scheme PDF/)).toBeDefined();
    });
  });

  it('calls apiUpload on successful submit', async () => {
    const user = userEvent.setup();
    mockApiUpload.mockResolvedValue({ id: 'paper-1' });
    render(<QuestionPaperUploadForm />);

    await fillRequiredFields(user);
    attachPdfFile();
    attachSchemeFile();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(mockApiUpload).toHaveBeenCalledWith(
        '/api/question-papers',
        expect.any(FormData),
      );
    });
  });

  it('shows success message after upload', async () => {
    const user = userEvent.setup();
    mockApiUpload.mockResolvedValue({ id: 'paper-1' });
    render(<QuestionPaperUploadForm />);

    await fillRequiredFields(user);
    attachPdfFile();
    attachSchemeFile();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(screen.getByText(/uploaded successfully/)).toBeDefined();
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('shows error message on upload failure', async () => {
    const user = userEvent.setup();
    mockApiUpload.mockRejectedValue(new Error('Network error'));
    render(<QuestionPaperUploadForm />);

    await fillRequiredFields(user);
    attachPdfFile();
    attachSchemeFile();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });
});
