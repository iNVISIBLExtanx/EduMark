import { createServerClient } from '@/lib/supabase/server';

export async function getSubmissionsByBatch(batchId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('submissions')
    .select('id, student_id, pdf_url, page_count, status, created_at, students(name, index_no)')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createStudentAndSubmission(input: {
  batchId: string;
  studentName: string;
  indexNo?: string;
  pdfUrl: string;
  pageCount: number;
}) {
  const supabase = await createServerClient();

  // Create student record
  const { data: student, error: studentErr } = await supabase
    .from('students')
    .insert({ batch_id: input.batchId, name: input.studentName, index_no: input.indexNo ?? null })
    .select('id')
    .single();
  if (studentErr) throw studentErr;

  // Create submission record
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .insert({
      student_id: student.id,
      batch_id: input.batchId,
      pdf_url: input.pdfUrl,
      page_count: input.pageCount,
    })
    .select('id, student_id, pdf_url, page_count, status, created_at')
    .single();
  if (subErr) throw subErr;

  return submission;
}

export async function updateBatchPaperCount(batchId: string, totalPapers: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('batches')
    .update({ total_papers: totalPapers })
    .eq('id', batchId);
  if (error) throw error;
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: 'pending' | 'processing' | 'marked' | 'failed',
  claudeReqId?: string,
) {
  const supabase = await createServerClient();
  const update: Record<string, unknown> = { status };
  if (claudeReqId !== undefined) {
    update.claude_req_id = claudeReqId;
  }
  const { error } = await supabase
    .from('submissions')
    .update(update)
    .eq('id', submissionId);
  if (error) throw error;
}

export async function getSubmissionPdfBuffer(pdfUrl: string): Promise<Buffer> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from('submissions')
    .download(pdfUrl);
  if (error || !data) throw new Error('Failed to download submission PDF');
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
