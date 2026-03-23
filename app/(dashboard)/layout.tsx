import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { getTutorByIdOrNull } from '@/lib/db/tutors';
import { redirect } from 'next/navigation';
import { PastDueBanner } from '@/components/billing/PastDueBanner';
import { Shell } from '@/components/layout/Shell';

const getAuthenticatedTutor = cache(async () => {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const tutor = await getTutorByIdOrNull(user.id);
  return { user, tutor };
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getAuthenticatedTutor();

  if (!result?.user) {
    redirect('/login');
  }

  if (!result.tutor) {
    redirect('/onboarding');
  }

  return (
    <Shell>
      <PastDueBanner />
      {children}
    </Shell>
  );
}
