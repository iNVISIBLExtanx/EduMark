import { createServerClient } from '@/lib/supabase/server';
import { getBillingStatus, isActive, hasMinutes } from '@/lib/billing/gate';
import { getBatchById } from '@/lib/db/batches';
import { dispatchMarkingBatch } from '@/lib/ai/batch-dispatcher';
import { NextResponse } from 'next/server';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Billing gate
  const billing = await getBillingStatus(user.id);

  if (!isActive(billing)) {
    return NextResponse.json({ error: 'subscription_inactive' }, { status: 402 });
  }

  // Verify batch ownership and get paper count
  let batch;
  try {
    batch = await getBatchById(batchId, user.id);
  } catch {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  if (batch.total_papers === 0) {
    return NextResponse.json({ error: 'Batch has no submissions' }, { status: 400 });
  }

  if (!hasMinutes(billing, batch.total_papers)) {
    return NextResponse.json({
      error: 'insufficient_ai_minutes',
      available: billing.ai_minutes_limit - billing.ai_minutes_used,
      needed: batch.total_papers,
    }, { status: 402 });
  }

  try {
    const claudeBatchId = await dispatchMarkingBatch(batchId, user.id);
    return NextResponse.json({ claude_batch_id: claudeBatchId, status: 'processing' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'dispatch_failed';
    if (message === 'no_pending_submissions') {
      return NextResponse.json({ error: 'No pending submissions in batch' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
