import { createServerClient } from '@/lib/supabase/server';
import { getTutorById, createTutor, addTutorSubjects } from '@/lib/db/tutors';
import { onboardingSchema } from '@/lib/validations/schemas';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tutor = await getTutorById(user.id);
    return NextResponse.json(tutor);
  } catch {
    return NextResponse.json({ error: 'Tutor not found' }, { status: 404 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { full_name, marking_language, subject_ids } = parsed.data;

  try {
    const tutor = await createTutor(user.id, user.email!, full_name, marking_language);
    await addTutorSubjects(user.id, subject_ids);
    return NextResponse.json(tutor, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
