import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuestionFeedbackCard } from '@/components/marking/QuestionFeedbackCard';

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/api-client';
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

const defaultProps = {
  id: 'r1',
  submissionId: 's1',
  part: 'Part A' as string | null,
  questionNo: 1,
  maxMarks: 10,
  awardedMarks: 7,
  feedback: 'Good attempt at explaining photosynthesis.',
  studentAnswerText: 'Photosynthesis is the process by which plants make food.',
  ocrConfidence: 'high' as const,
  subQuestions: null as { label: string; max_marks: number; awarded_marks: number; feedback: string }[] | null,
  tutorOverride: false,
  overrideMarks: null as number | null,
  overrideFeedback: null as string | null,
  language: 'english',
  onSaved: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuestionFeedbackCard', () => {
  it('renders question number and marks', () => {
    render(<QuestionFeedbackCard {...defaultProps} />);
    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(screen.getByText('7/10')).toBeInTheDocument();
  });

  it('renders feedback text', () => {
    render(<QuestionFeedbackCard {...defaultProps} />);
    expect(screen.getByText('Good attempt at explaining photosynthesis.')).toBeInTheDocument();
  });

  it('renders student answer text', () => {
    render(<QuestionFeedbackCard {...defaultProps} />);
    expect(screen.getByText(/Photosynthesis is the process/)).toBeInTheDocument();
  });

  it('shows part badge when part is provided', () => {
    render(<QuestionFeedbackCard {...defaultProps} part="Part A" />);
    expect(screen.getByText('Part A')).toBeInTheDocument();
  });

  it('shows Part B badge for Part B questions', () => {
    render(<QuestionFeedbackCard {...defaultProps} part="Part B" />);
    expect(screen.getByText('Part B')).toBeInTheDocument();
  });

  it('does not render part badge when part is null', () => {
    render(<QuestionFeedbackCard {...defaultProps} part={null} />);
    expect(screen.queryByText('Part A')).not.toBeInTheDocument();
    expect(screen.queryByText('Part B')).not.toBeInTheDocument();
  });

  it('shows low OCR confidence badge when confidence is low', () => {
    render(<QuestionFeedbackCard {...defaultProps} ocrConfidence="low" />);
    expect(screen.getByText('Low OCR confidence')).toBeInTheDocument();
  });

  it('does not show OCR badge when confidence is high', () => {
    render(<QuestionFeedbackCard {...defaultProps} />);
    expect(screen.queryByText('Low OCR confidence')).not.toBeInTheDocument();
  });

  it('shows Edited badge when tutorOverride is true', () => {
    render(<QuestionFeedbackCard {...defaultProps} tutorOverride={true} overrideMarks={9} overrideFeedback="Excellent" />);
    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('displays override marks when tutorOverride is true', () => {
    render(<QuestionFeedbackCard {...defaultProps} tutorOverride={true} overrideMarks={9} overrideFeedback="Excellent" />);
    expect(screen.getByText('9/10')).toBeInTheDocument();
  });

  it('renders sub-question breakdown when sub_questions are provided', () => {
    const subQuestions = [
      { label: '(a)(i)', max_marks: 3, awarded_marks: 2, feedback: 'Partial credit' },
      { label: '(a)(ii)', max_marks: 4, awarded_marks: 4, feedback: 'Full marks' },
    ];
    render(<QuestionFeedbackCard {...defaultProps} subQuestions={subQuestions} />);
    expect(screen.getByText('(a)(i)')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('Partial credit')).toBeInTheDocument();
    expect(screen.getByText('(a)(ii)')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('does not render sub-question section when sub_questions is null', () => {
    render(<QuestionFeedbackCard {...defaultProps} subQuestions={null} />);
    expect(screen.queryByText('Sub-question Breakdown')).not.toBeInTheDocument();
  });

  it('does not render sub-question section when sub_questions is empty array', () => {
    render(<QuestionFeedbackCard {...defaultProps} subQuestions={[]} />);
    expect(screen.queryByText('Sub-question Breakdown')).not.toBeInTheDocument();
  });

  it('enters edit mode when edit button is clicked', () => {
    render(<QuestionFeedbackCard {...defaultProps} />);
    const editButton = screen.getByRole('button');
    fireEvent.click(editButton);
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls apiFetch and onSaved when save is clicked', async () => {
    mockApiFetch.mockResolvedValue({ success: true });
    render(<QuestionFeedbackCard {...defaultProps} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole('button'));

    // Click save
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/submissions/s1/override',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
    await waitFor(() => {
      expect(defaultProps.onSaved).toHaveBeenCalled();
    });
  });

  it('exits edit mode on cancel', () => {
    render(<QuestionFeedbackCard {...defaultProps} />);
    fireEvent.click(screen.getByRole('button')); // enter edit
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('applies sinhala font class to feedback text', () => {
    const { container } = render(<QuestionFeedbackCard {...defaultProps} language="sinhala" />);
    const feedbackElements = container.querySelectorAll('.font-sinhala');
    expect(feedbackElements.length).toBeGreaterThan(0);
  });

  it('applies tamil font class to feedback text', () => {
    const { container } = render(<QuestionFeedbackCard {...defaultProps} language="tamil" />);
    const tamilElements = container.querySelectorAll('.font-tamil');
    expect(tamilElements.length).toBeGreaterThan(0);
  });

  it('shows Saving... text on save button while saving', async () => {
    // Make apiFetch hang so we can observe the saving state
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    render(<QuestionFeedbackCard {...defaultProps} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole('button'));

    // Click save
    fireEvent.click(screen.getByText('Save'));

    // Save button should now show "Saving..." and be disabled
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });
});
