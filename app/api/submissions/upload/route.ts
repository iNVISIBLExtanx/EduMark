import { createServerClient } from '@/lib/supabase/server';
import { getBatchById } from '@/lib/db/batches';
import { createStudentAndSubmission, updateBatchPaperCount } from '@/lib/db/submissions';
import { submissionUploadSchema } from '@/lib/validations/schemas';
import { getPdfPageCount } from '@/lib/pdf/pdf-to-images';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();

  // Parse metadata JSON
  const metadataStr = formData.get('metadata') as string | null;
  if (!metadataStr) {
    return NextResponse.json({ error: 'Metadata is required' }, { status: 400 });
  }

  let metadata: unknown;
  try {
    metadata = JSON.parse(metadataStr);
  } catch {
    return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 });
  }

  const parsed = submissionUploadSchema.safeParse(metadata);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { batch_id, files: fileMeta } = parsed.data;

  // Verify batch ownership and status
  let batch;
  try {
    batch = await getBatchById(batch_id, user.id);
  } catch {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  if (!['pending', 'uploading'].includes(batch.status)) {
    return NextResponse.json(
      { error: `Cannot upload to batch with status: ${batch.status}` },
      { status: 400 },
    );
  }

  // Get all PDF files from form data
  const pdfFiles = formData.getAll('files') as File[];
  if (pdfFiles.length !== fileMeta.length) {
    return NextResponse.json(
      { error: `Expected ${fileMeta.length} files, got ${pdfFiles.length}` },
      { status: 400 },
    );
  }

  // Validate all files before processing
  for (let i = 0; i < pdfFiles.length; i++) {
    const file = pdfFiles[i];
    if (typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: `File ${i} is not a valid file` }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: `File ${i} must be a PDF` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File ${i} exceeds 20MB limit` }, { status: 400 });
    }
  }

  // Process each file
  const submissions = [];
  try {
    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      const meta = fileMeta[i];
      const studentId = crypto.randomUUID();
      const storagePath = `${user.id}/${batch_id}/${studentId}.pdf`;

      const fileBuffer = Buffer.from(await file.arrayBuffer());

      // Get page count
      const pageCount = await getPdfPageCount(fileBuffer);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(storagePath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      // Create student + submission records
      const submission = await createStudentAndSubmission({
        batchId: batch_id,
        studentName: meta.student_name,
        indexNo: meta.index_no,
        pdfUrl: storagePath,
        pageCount,
      });

      submissions.push(submission);
    }

    // Update batch paper count
    await updateBatchPaperCount(batch_id, (batch.total_papers ?? 0) + submissions.length);

    return NextResponse.json({ submissions }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload submissions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
