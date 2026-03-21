import { createServerClient } from '@/lib/supabase/server';
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

  return (
    <>
      <PastDueBanner />
      {children}
    </>
  );
}
