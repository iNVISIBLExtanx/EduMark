import { createServerClient } from '@/lib/supabase/server';

export async function getSubmissionsByBatch(batchId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('submissions')
    .select('id, student_id, pdf_url, page_count, status, created_at, students(name, index_no)')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
