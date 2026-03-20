import useSWR from 'swr';

interface MarkingResult {
  id: string;
  question_no: number;
  max_marks: number;
  awarded_marks: number;
  student_answer_text: string;
  feedback: string;
  ocr_confidence: string;
  override_marks: number | null;
  override_feedback: string | null;
}

export function useMarkingResults(submissionId: string) {
  const { data, error, isLoading, mutate } = useSWR<MarkingResult[]>(
    submissionId ? `/api/submissions/${submissionId}` : null
  );
  return { results: data ?? [], error, isLoading, mutate };
}
