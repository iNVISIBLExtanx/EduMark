import { createServerClient } from '@/lib/supabase/server';
import { getTutorByIdOrNull } from '@/lib/db/tutors';
import { redirect } from 'next/navigation';
import { PastDueBanner } from '@/components/billing/PastDueBanner';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const tutor = await getTutorByIdOrNull(user.id);
  if (!tutor) {
    redirect('/onboarding');
  }

  return (
    <>
      <PastDueBanner />
      {children}
    </>
  );
}
