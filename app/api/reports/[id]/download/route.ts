import { createServerClient } from '@/lib/supabase/server';
import { getSubmissionById } from '@/lib/db/submissions';
import { getBatchById } from '@/lib/db/batches';
import { getQuestionPaperById } from '@/lib/db/question-papers';
import { getTutorById } from '@/lib/db/tutors';
import { getMarkingResultsBySubmission } from '@/lib/db/marking-results';
import { getReportBySubmission, createOrUpdateReport } from '@/lib/db/reports';
import { buildReportHTML, generateReportPDF } from '@/lib/pdf/report-renderer';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: submissionId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Load submission + student data
    let submission;
    try {
      submission = await getSubmissionById(submissionId);
    } catch {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Check submission is marked
    if (submission.status !== 'marked') {
      return NextResponse.json({ error: 'submission_not_marked' }, { status: 400 });
    }

    // Verify batch ownership
    let batch;
    try {
      batch = await getBatchById(submission.batch_id, user.id);
    } catch {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Check report is approved
    const report = await getReportBySubmission(submissionId);
    if (!report || !report.tutor_approved) {
      return NextResponse.json({ error: 'report_not_approved' }, { status: 403 });
    }

    // Load data for report
    const paper = await getQuestionPaperById(batch.paper_id, user.id);
    const tutor = await getTutorById(user.id);
    const results = await getMarkingResultsBySubmission(submissionId);

    // Supabase join returns nested object; cast for type safety
    const student = submission.students as unknown as { name: string; index_no: string | null };
    const subjects = (paper as Record<string, unknown>).subjects as { name: string } | undefined;
    const subjectName = subjects?.name ?? 'General';

    // Build HTML and generate PDF
    const submissionSummary = submission as unknown as {
      paper_name?: string | null;
      general_feedback?: string | null;
      best_questions_selected?: number[] | null;
      total_awarded?: number | null;
      total_max?: number | null;
    };
    const html = buildReportHTML({
      studentName: student.name,
      indexNo: student.index_no,
      subjectName,
      date: new Date().toISOString(),
      language: batch.medium as 'sinhala' | 'tamil' | 'english',
      tutorName: tutor.full_name,
      results,
      paperName: submissionSummary.paper_name,
      generalFeedback: submissionSummary.general_feedback,
      bestQuestionsSelected: submissionSummary.best_questions_selected,
      totalAwarded: submissionSummary.total_awarded,
      totalMax: submissionSummary.total_max,
    });

    const pdfBuffer = await generateReportPDF(html);

    // Upload to Supabase Storage
    const storagePath = `${user.id}/${submissionId}.pdf`;
    await supabase.storage
      .from('reports')
      .upload(storagePath, new Uint8Array(pdfBuffer), {
        contentType: 'application/pdf',
        upsert: true,
      });

    // Update reports table
    await createOrUpdateReport(submissionId, storagePath);

    // Return PDF
    const studentName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${studentName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Report download error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
