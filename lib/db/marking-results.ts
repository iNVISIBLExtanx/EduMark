import { createServerClient } from '@/lib/supabase/server';

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
