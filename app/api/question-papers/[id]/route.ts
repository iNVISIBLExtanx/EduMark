import { createServerClient } from '@/lib/supabase/server';
import { getQuestionPaperById, getBatchCountByPaper, deleteQuestionPaper } from '@/lib/db/question-papers';
import { deleteMarkingSchemeByPaper } from '@/lib/db/marking-schemes';
import { NextResponse } from 'next/server';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Ownership check
  let paper;
  try {
    paper = await getQuestionPaperById(id, user.id);
  } catch {
    return NextResponse.json({ error: 'Question paper not found' }, { status: 404 });
  }

  // Block deletion if paper has batches
  try {
    const batchCount = await getBatchCountByPaper(id);
    if (batchCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: paper has associated batches. Delete the batches first.' },
        { status: 409 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Failed to check batches' }, { status: 500 });
  }

  try {
    // Delete marking scheme + embeddings
    const scheme = await deleteMarkingSchemeByPaper(id);

    // Delete storage files
    const filesToRemove = [paper.pdf_url];
    if (scheme?.pdf_url) filesToRemove.push(scheme.pdf_url);
    await supabase.storage.from('marking-schemes').remove(filesToRemove);

    // Delete question paper record
    await deleteQuestionPaper(id, user.id);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete question paper';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
