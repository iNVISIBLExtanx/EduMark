import { createServerClient } from '@/lib/supabase/server';

export async function getMarkingSchemeByPaper(paperId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('marking_schemes')
    .select('*')
    .eq('paper_id', paperId)
    .single();
  if (error) throw error;
  return data;
}
