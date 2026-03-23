import { createServerClient } from '@/lib/supabase/server';
import { getBatchById } from '@/lib/db/batches';
import { getMarkingResultsByBatch } from '@/lib/db/marking-results';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await getBatchById(id, user.id);
  } catch {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  try {
    const results = await getMarkingResultsByBatch(id);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
