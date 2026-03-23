import { createServerClient } from '@/lib/supabase/server';
import { getQuestionPaperById } from '@/lib/db/question-papers';
import { createMarkingScheme } from '@/lib/db/marking-schemes';
import { markingSchemeSchema } from '@/lib/validations/schemas';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const paperId = formData.get('paper_id') as string | null;

  // Validate file (use duck typing — instanceof File fails across runtimes/environments)
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be under 20MB' }, { status: 400 });
  }

  // Validate metadata
  const parsed = markingSchemeSchema.safeParse({ paper_id: paperId });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify paper belongs to tutor
  try {
    await getQuestionPaperById(parsed.data.paper_id, user.id);
  } catch {
    return NextResponse.json({ error: 'Question paper not found' }, { status: 404 });
  }

  const storagePath = `${user.id}/${parsed.data.paper_id}/marking-scheme.pdf`;

  try {
    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('marking-schemes')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (uploadError) throw uploadError;

    // Create DB record
    const scheme = await createMarkingScheme({
      paperId: parsed.data.paper_id,
      pdfUrl: storagePath,
    });

    return NextResponse.json(scheme, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create marking scheme';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
