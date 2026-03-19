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
