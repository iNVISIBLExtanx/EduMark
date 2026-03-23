import { createServerClient } from '@/lib/supabase/server';
import { getTutorByIdOrNull } from '@/lib/db/tutors';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const tutor = await getTutorByIdOrNull(user.id);
        const destination = tutor ? '/dashboard' : '/onboarding';
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
