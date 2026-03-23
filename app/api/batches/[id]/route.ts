import { createServerClient } from '@/lib/supabase/server';
import { getBatchById, deleteBatch, updateBatchName } from '@/lib/db/batches';
import { getSubmissionsByBatch } from '@/lib/db/submissions';
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = body.name;
  if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 200) {
    return NextResponse.json({ error: 'Invalid batch name' }, { status: 400 });
  }

  try {
    await getBatchById(id, user.id); // ownership check
  } catch {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  try {
    await updateBatchName(id, user.id, name.trim());
    return NextResponse.json({ updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check
  let batch;
  try {
    batch = await getBatchById(id, user.id);
  } catch {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  // Block deletion of processing batches
  if (batch.status === 'processing') {
    return NextResponse.json(
      { error: 'Cannot delete a batch while it is being processed.' },
      { status: 409 },
    );
  }

  try {
    // Collect submission PDF URLs for storage cleanup
    const submissions = await getSubmissionsByBatch(id);
    const storagePaths = submissions
      .map((s) => s.pdf_url)
      .filter(Boolean);

    // Clean up storage files (submissions + reports)
    if (storagePaths.length > 0) {
      await supabase.storage.from('submissions').remove(storagePaths);
    }

    // Delete batch — cascades to students → submissions → marking_results via FK
    await deleteBatch(id, user.id);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
