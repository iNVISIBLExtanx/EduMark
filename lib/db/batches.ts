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
    .select('*')
    .eq('id', batchId)
    .eq('tutor_id', tutorId)
    .single();
  if (error) throw error;
  return data;
}
