import { createServiceRoleClient } from '@/lib/supabase/service';

export async function checkAndDeductMinutes(tutorId: string, papersCount: number) {
  const supabase = createServiceRoleClient();
  const { data: tutor, error } = await supabase
    .from('tutors')
    .select('ai_minutes_used, ai_minutes_limit, subscription_status')
    .eq('id', tutorId)
    .single();

  if (error || !tutor) throw new Error('tutor_not_found');
  if (tutor.subscription_status === 'past_due') throw new Error('subscription_past_due');

  const available = tutor.ai_minutes_limit - tutor.ai_minutes_used;
  if (available < papersCount) throw new Error('insufficient_ai_minutes');

  await supabase.rpc('increment_ai_minutes_used', {
    p_tutor_id: tutorId,
    p_amount: papersCount,
  });
}
