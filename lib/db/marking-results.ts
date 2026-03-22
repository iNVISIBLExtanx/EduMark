import { createServerClient } from '@/lib/supabase/server';
import type { MarkingResult } from '@/lib/ai/mark-paper';

export async function getMarkingResultsBySubmission(submissionId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('marking_results')
    .select('*')
    .eq('submission_id', submissionId)
    .order('question_no', { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveMarkingResults(submissionId: string, result: MarkingResult) {
  const supabase = await createServerClient();
  const rows = result.questions.map((q) => ({
    submission_id: submissionId,
    question_no: q.question_no,
    max_marks: q.max_marks,
    awarded_marks: q.awarded_marks,
    student_answer_text: q.student_answer_text,
    feedback: q.feedback,
    ocr_confidence: q.ocr_confidence,
  }));
  const { error } = await supabase
    .from('marking_results')
    .insert(rows);
  if (error) throw error;
}

export async function getMarkingResultsByBatch(batchId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('marking_results')
    .select(
      'id, submission_id, question_no, max_marks, awarded_marks, student_answer_text, feedback, ocr_confidence, tutor_override, override_marks, override_feedback, submissions!inner(batch_id)'
    )
    .eq('submissions.batch_id', batchId)
    .order('submission_id', { ascending: true })
    .order('question_no', { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateMarkingOverride(
  resultId: string,
  submissionId: string,
  overrideMarks: number,
  overrideFeedback: string
) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('marking_results')
    .update({
      tutor_override: true,
      override_marks: overrideMarks,
      override_feedback: overrideFeedback,
    })
    .eq('id', resultId)
    .eq('submission_id', submissionId);
  if (error) throw error;
}
