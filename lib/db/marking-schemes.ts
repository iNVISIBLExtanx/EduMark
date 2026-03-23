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

// --- Embedding functions ---

export interface EmbeddingChunkInput {
  scheme_id: string;
  chunk_text: string;
  chunk_type: 'question_criterion' | 'model_answer' | 'mark_allocation';
  question_no: number;
  embedding: number[];
}

export interface MarkingCriteriaMatch {
  id: string;
  chunk_text: string;
  chunk_type: string;
  question_no: number;
  similarity: number;
}

export async function insertEmbeddingChunks(chunks: EmbeddingChunkInput[]) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('ms_embeddings')
    .insert(chunks);
  if (error) throw error;
}

export async function deleteEmbeddingsByScheme(schemeId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('ms_embeddings')
    .delete()
    .eq('scheme_id', schemeId);
  if (error) throw error;
}

export async function markEmbeddingsDone(schemeId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('marking_schemes')
    .update({ embeddings_done: true })
    .eq('id', schemeId);
  if (error) throw error;
}

export async function matchMarkingCriteria(
  schemeId: string,
  queryEmbedding: number[],
  matchCount: number = 5,
): Promise<MarkingCriteriaMatch[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('match_marking_criteria', {
    p_scheme_id: schemeId,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });
  if (error) throw error;
  return data ?? [];
}
