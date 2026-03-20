import { createServerClient } from '@/lib/supabase/server';
import { getBatchById } from '@/lib/db/batches';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const batch = await getBatchById(id, user.id);
  return NextResponse.json(batch);
}
