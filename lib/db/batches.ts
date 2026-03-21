import { createServerClient } from '@/lib/supabase/server';

export async function getBatchesByTutor(tutorId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('batches')
    .select('id, name, status, medium, total_papers, marked_papers, created_at')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBatchById(batchId: string, tutorId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('batches')
    .select('id, name, status, medium, total_papers, marked_papers, created_at, paper_id, scheme_id, claude_batch_id')
    .eq('id', batchId)
    .eq('tutor_id', tutorId)
    .single();
  if (error) throw error;
  return data;
}

export async function createBatch(input: {
  tutorId: string;
  paperId: string;
  schemeId: string;
  name: string;
  medium: 'sinhala' | 'tamil' | 'english';
}) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('batches')
    .insert({
      tutor_id: input.tutorId,
      paper_id: input.paperId,
      scheme_id: input.schemeId,
      name: input.name,
      medium: input.medium,
    })
    .select('id, name, status, medium, total_papers, marked_papers, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateBatchStatus(batchId: string, status: string) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('batches')
    .update({ status })
    .eq('id', batchId);
  if (error) throw error;
}
