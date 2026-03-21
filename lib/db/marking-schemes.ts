import { createServerClient } from '@/lib/supabase/server';

export async function getMarkingSchemeByPaper(paperId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('marking_schemes')
    .select('id, paper_id, pdf_url, structure_json, embeddings_done, created_at')
    .eq('paper_id', paperId)
    .single();
  if (error) throw error;
  return data;
}

export async function createMarkingScheme(input: { paperId: string; pdfUrl: string }) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('marking_schemes')
    .insert({ paper_id: input.paperId, pdf_url: input.pdfUrl })
    .select('id, paper_id, pdf_url, embeddings_done, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getMarkingSchemeById(schemeId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('marking_schemes')
    .select('id, paper_id, pdf_url, structure_json, embeddings_done, created_at')
    .eq('id', schemeId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMarkingSchemeStructure(schemeId: string, structureJson: object) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('marking_schemes')
    .update({ structure_json: structureJson })
    .eq('id', schemeId);
  if (error) throw error;
}
