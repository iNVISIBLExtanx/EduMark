import { createServerClient } from '@/lib/supabase/server';
import { getBillingStatus, isActive, hasMinutes } from '@/lib/billing/gate';
import { NextResponse } from 'next/server';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const billing = await getBillingStatus(user.id);

  if (!isActive(billing)) {
    return NextResponse.json({ error: 'subscription_inactive' }, { status: 402 });
  }

  // TODO: Get papers count from batchId, check minutes, dispatch batch
  void batchId;
  const papersCount = 0;
  if (!hasMinutes(billing, papersCount)) {
    return NextResponse.json({
      error: 'insufficient_ai_minutes',
      available: billing.ai_minutes_limit - billing.ai_minutes_used,
      needed: papersCount,
    }, { status: 402 });
  }

  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
