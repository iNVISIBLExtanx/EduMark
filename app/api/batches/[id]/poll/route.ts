import { createServerClient } from '@/lib/supabase/server';
import { pollBatchResults } from '@/lib/ai/batch-dispatcher';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await pollBatchResults(batchId, user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'poll_failed';
    if (message === 'batch_not_dispatched') {
      return NextResponse.json({ error: 'Batch has not been dispatched yet' }, { status: 400 });
    }
    // getBatchById throws when not found / not owned
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }
}
