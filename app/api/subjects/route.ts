import { createServerClient } from '@/lib/supabase/server';
import { getAllSubjects } from '@/lib/db/tutors';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const subjects = await getAllSubjects();
    return NextResponse.json(subjects);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch subjects' }, { status: 500 });
  }
}
