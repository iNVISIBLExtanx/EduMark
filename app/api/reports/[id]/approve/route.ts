import { createServerClient } from '@/lib/supabase/server';
import { getSubmissionById } from '@/lib/db/submissions';
import { getBatchById } from '@/lib/db/batches';
import { approveReport } from '@/lib/db/reports';
import { NextResponse } from 'next/server';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: submissionId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Load submission
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
    try {
      await getBatchById(submission.batch_id, user.id);
    } catch {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Approve the report
    await approveReport(submissionId);

    return NextResponse.json({ approved: true });
  } catch (err) {
    console.error('Report approve error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
