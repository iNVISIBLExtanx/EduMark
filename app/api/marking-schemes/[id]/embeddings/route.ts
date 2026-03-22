import { createServerClient } from '@/lib/supabase/server';
import { getMarkingSchemeById } from '@/lib/db/marking-schemes';
import { generateAndStoreEmbeddings } from '@/lib/ai/embeddings';
import { NextResponse } from 'next/server';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: schemeId } = await params;

  let scheme;
  try {
    scheme = await getMarkingSchemeById(schemeId);
  } catch {
    return NextResponse.json({ error: 'Marking scheme not found' }, { status: 404 });
  }

  if (!scheme.structure_json || !scheme.structure_json.questions?.length) {
    return NextResponse.json(
      { error: 'Marking scheme has no parsed structure. Upload and parse the scheme first.' },
      { status: 400 },
    );
  }

  try {
    const result = await generateAndStoreEmbeddings(schemeId, scheme.structure_json);
    return NextResponse.json({
      success: true,
      scheme_id: schemeId,
      chunks_stored: result.chunksStored,
      embeddings_done: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate embeddings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
