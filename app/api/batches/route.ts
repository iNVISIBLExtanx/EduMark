import { createServerClient } from '@/lib/supabase/server';
import { getBatchesByTutor, createBatch } from '@/lib/db/batches';
import { getQuestionPaperById } from '@/lib/db/question-papers';
import { getMarkingSchemeByPaper } from '@/lib/db/marking-schemes';
import { createBatchSchema } from '@/lib/validations/schemas';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const batches = await getBatchesByTutor(user.id);
    return NextResponse.json(batches);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, paper_id, scheme_id, medium } = parsed.data;

  // Verify paper belongs to tutor
  try {
    await getQuestionPaperById(paper_id, user.id);
  } catch {
    return NextResponse.json({ error: 'Question paper not found' }, { status: 404 });
  }

  // Verify scheme belongs to the paper
  try {
    const scheme = await getMarkingSchemeByPaper(paper_id);
    if (scheme.id !== scheme_id) {
      return NextResponse.json({ error: 'Marking scheme does not belong to this paper' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Marking scheme not found' }, { status: 404 });
  }

  try {
    const batch = await createBatch({
      tutorId: user.id,
      paperId: paper_id,
      schemeId: scheme_id,
      name,
      medium,
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
