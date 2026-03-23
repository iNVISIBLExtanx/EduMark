import { createServerClient } from '@/lib/supabase/server';
import { getQuestionPapersByTutor, createQuestionPaper } from '@/lib/db/question-papers';
import { getTutorSubjects } from '@/lib/db/tutors';
import { questionPaperSchema } from '@/lib/validations/schemas';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const papers = await getQuestionPapersByTutor(user.id);
    return NextResponse.json(papers);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch question papers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const title = formData.get('title') as string | null;
  const subjectId = formData.get('subject_id') as string | null;
  const yearStr = formData.get('year') as string | null;

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
  const parsed = questionPaperSchema.safeParse({
    title,
    subject_id: subjectId,
    year: yearStr ? parseInt(yearStr, 10) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify subject belongs to tutor
  try {
    const tutorSubjects = await getTutorSubjects(user.id);
    const validSubjectIds = tutorSubjects.map((ts) => ts.subject_id);
    if (!validSubjectIds.includes(parsed.data.subject_id)) {
      return NextResponse.json({ error: 'Subject not registered to tutor' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to verify subject' }, { status: 500 });
  }

  // Generate paper ID for storage path
  const paperId = crypto.randomUUID();
  const storagePath = `${user.id}/${paperId}/question-paper.pdf`;

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
    const paper = await createQuestionPaper({
      tutorId: user.id,
      subjectId: parsed.data.subject_id,
      title: parsed.data.title,
      year: parsed.data.year,
      pdfUrl: storagePath,
    });

    return NextResponse.json(paper, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create question paper';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
