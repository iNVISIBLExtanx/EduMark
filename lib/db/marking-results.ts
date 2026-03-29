import { createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import type { MarkingResult } from '@/lib/ai/mark-paper';

export async function getMarkingResultsBySubmission(submissionId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('marking_results')
    .select('id, submission_id, part, question_no, max_marks, awarded_marks, student_answer_text, feedback, ocr_confidence, sub_questions, tutor_override, override_marks, override_feedback')
    .eq('submission_id', submissionId)
    .order('question_no', { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveMarkingResults(submissionId: string, result: MarkingResult) {
  // Use service role — this runs in background dispatch jobs, not an authenticated request.
  const supabase = createServiceRoleClient();

  const rows = result.questions.map((q) => ({
    submission_id:       submissionId,
    part:                q.part,
    question_no:         q.question_no,
    max_marks:           q.max_marks,
    awarded_marks:       q.awarded_marks,
    student_answer_text: q.student_answer_text,
    feedback:            q.feedback,
    // Defense in depth: DB constraint only allows 'high' | 'low'.
    // Structured outputs enforce this via schema, but sanitize as safety net.
    ocr_confidence:      q.ocr_confidence === 'high' ? 'high' : 'low',
    sub_questions:       q.sub_questions ?? null,
  }));

  const { error: insertError } = await supabase
    .from('marking_results')
    .insert(rows);
  if (insertError) throw insertError;

  // Save batch-level metadata on the submission row
  const { error: subError } = await supabase
    .from('submissions')
    .update({
      status:                  'marked',
      total_awarded:           result.total_awarded,
      total_max:               result.total_max,
      general_feedback:        result.general_feedback,
      best_questions_selected: result.best_questions_selected ?? null,
      paper_name:              result.paper_name,
    })
    .eq('id', submissionId);
  if (subError) throw subError;
}

export async function getMarkingResultsByBatch(batchId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('marking_results')
    .select(
      'id, submission_id, part, question_no, max_marks, awarded_marks, student_answer_text, feedback, ocr_confidence, sub_questions, tutor_override, override_marks, override_feedback, submissions!inner(batch_id)'
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
      tutor_override:    true,
      override_marks:    overrideMarks,
      override_feedback: overrideFeedback,
    })
    .eq('id', resultId)
    .eq('submission_id', submissionId);
  if (error) throw error;
}
