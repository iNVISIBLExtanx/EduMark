import { createServerClient } from '@/lib/supabase/server';

export async function getQuestionPapersByTutor(tutorId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('question_papers')
    .select('id, title, year, pdf_url, created_at, subject_id, subjects(name, code), marking_schemes(id)')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getQuestionPaperById(paperId: string, tutorId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('question_papers')
    .select('id, title, year, pdf_url, subject_id, parsed_json, created_at, subjects(name, code)')
    .eq('id', paperId)
    .eq('tutor_id', tutorId)
    .single();
  if (error) throw error;
  return data;
}

export async function getBatchCountByPaper(paperId: string): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from('batches')
    .select('id', { count: 'exact', head: true })
    .eq('paper_id', paperId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteQuestionPaper(paperId: string, tutorId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('question_papers')
    .delete()
    .eq('id', paperId)
    .eq('tutor_id', tutorId);
  if (error) throw error;
}

export async function createQuestionPaper(input: {
  tutorId: string;
  subjectId: string;
  title: string;
  year?: number;
  pdfUrl: string;
}) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('question_papers')
    .insert({
      tutor_id: input.tutorId,
      subject_id: input.subjectId,
      title: input.title,
      year: input.year ?? null,
      pdf_url: input.pdfUrl,
    })
    .select('id, title, year, pdf_url, subject_id, created_at')
    .single();
  if (error) throw error;
  return data;
}
