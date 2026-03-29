import useSWR from 'swr';

export interface SubQuestion {
  label: string;
  max_marks: number;
  awarded_marks: number;
  feedback: string;
}

export interface MarkingResultRow {
  id: string;
  part: string | null;
  question_no: number;
  max_marks: number;
  awarded_marks: number;
  student_answer_text: string;
  feedback: string;
  ocr_confidence: 'high' | 'low';
  sub_questions: SubQuestion[] | null;
  tutor_override: boolean;
  override_marks: number | null;
  override_feedback: string | null;
}

export interface SubmissionSummary {
  total_awarded: number | null;
  total_max: number | null;
  general_feedback: string | null;
  best_questions_selected: number[] | null;
  paper_name: string | null;
}

export function useMarkingResults(submissionId: string) {
  const { data, error, isLoading, mutate } = useSWR<{
    results: MarkingResultRow[];
    summary: SubmissionSummary | null;
  }>(
    submissionId ? `/api/submissions/${submissionId}` : null,
  );

  return {
    results: data?.results ?? [],
    summary: data?.summary ?? null,
    isLoading,
    error,
    mutate,
  };
}
