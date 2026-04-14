import { createServerClient } from '@/lib/supabase/server';
import { getBillingStatus, isActive, hasMinutes } from '@/lib/billing/gate';
import { getBatchById, updateBatchPaperName } from '@/lib/db/batches';
import { prepareMarking, executeMarking } from '@/lib/ai/batch-dispatcher';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // paper_name is required for Combined Maths — "Pure (Paper I)" | "Applied (Paper II)"
  // Optional for all other subjects.
  const body = await req.json().catch(() => ({}));
  const paperName: string | undefined = body.paper_name;

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

  if (batch.status !== 'pending') {
    return NextResponse.json(
      { error: 'batch_already_dispatched', status: batch.status },
      { status: 400 },
    );
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

  // Store paper_name on batch so loadMarkingContext can read it
  if (paperName) {
    await updateBatchPaperName(batchId, user.id, paperName);
  }

  try {
    // Phase 1: Validate, deduct billing, load context (awaited — errors caught here)
    const { pendingSubmissions, systemPromptText, subject, paperName: resolvedPaperName, schemePdfUrl } = await prepareMarking(batchId, user.id);

    // Phase 2: Fire and forget — streaming/Batch API runs in background.
    // The frontend polls /api/batches/[id]/poll for progress.
    executeMarking(batchId, pendingSubmissions, systemPromptText, subject, resolvedPaperName, schemePdfUrl).catch((err) => {
      console.error('[dispatch] Background marking failed:', err instanceof Error ? err.message : err);
    });

    return NextResponse.json({ status: 'processing' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'dispatch_failed';
    if (message === 'no_pending_submissions') {
      return NextResponse.json({ error: 'No pending submissions in batch' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
