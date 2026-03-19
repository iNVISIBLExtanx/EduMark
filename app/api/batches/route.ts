import { createServerClient } from '@/lib/supabase/server';
import { getBatchesByTutor } from '@/lib/db/batches';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const batches = await getBatchesByTutor(user.id);
  return NextResponse.json(batches);
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  // TODO: Validate with zod, create batch
  return NextResponse.json({ message: 'Not implemented', body }, { status: 501 });
}
