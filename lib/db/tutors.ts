import { createServerClient } from '@/lib/supabase/server';

export async function getTutorById(tutorId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('tutors')
    .select('id, email, full_name, marking_language, plan, ai_minutes_used, ai_minutes_limit, subscription_status')
    .eq('id', tutorId)
    .single();
  if (error) throw error;
  return data;
}

export async function getTutorByIdOrNull(tutorId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('tutors')
    .select('id, email, full_name, marking_language, plan')
    .eq('id', tutorId)
    .single();
  return data;
}

export async function createTutor(
  userId: string,
  email: string,
  fullName: string,
  markingLanguage: 'sinhala' | 'tamil' | 'english',
) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('tutors')
    .insert({ id: userId, email, full_name: fullName, marking_language: markingLanguage })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addTutorSubjects(tutorId: string, subjectIds: string[]) {
  const supabase = await createServerClient();
  const rows = subjectIds.map((subjectId) => ({ tutor_id: tutorId, subject_id: subjectId }));
  const { error } = await supabase.from('tutor_subjects').insert(rows);
  if (error) throw error;
}

export async function getAllSubjects() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, code')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getTutorSubjects(tutorId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('tutor_subjects')
    .select('subject_id, subjects(id, name, code)')
    .eq('tutor_id', tutorId);
  if (error) throw error;
  return data;
}
