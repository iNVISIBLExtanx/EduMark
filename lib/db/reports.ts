import { createServerClient } from '@/lib/supabase/server';

export async function getReportBySubmission(submissionId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('reports')
    .select('id, submission_id, pdf_url, tutor_approved, approved_at, generated_at')
    .eq('submission_id', submissionId)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function createOrUpdateReport(submissionId: string, pdfUrl: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('reports')
    .upsert(
      {
        submission_id: submissionId,
        pdf_url: pdfUrl,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'submission_id' }
    )
    .select('id, submission_id, pdf_url, tutor_approved, generated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function approveReport(submissionId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('reports')
    .upsert(
      {
        submission_id: submissionId,
        tutor_approved: true,
        approved_at: new Date().toISOString(),
      },
      { onConflict: 'submission_id' }
    );

  if (error) throw error;
}
