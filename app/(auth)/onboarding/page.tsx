import { createServerClient } from '@/lib/supabase/server';
import { getTutorByIdOrNull } from '@/lib/db/tutors';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/components/auth/OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const tutor = await getTutorByIdOrNull(user.id);
  if (tutor) {
    redirect('/dashboard');
  }

  const defaultName = user.user_metadata?.full_name ?? '';

  return <OnboardingForm defaultName={defaultName} />;
}
