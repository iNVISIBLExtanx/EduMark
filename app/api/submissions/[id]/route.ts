import { createServerClient } from '@/lib/supabase/server';
import { getMarkingResultsBySubmission } from '@/lib/db/marking-results';
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
    const results = await getMarkingResultsBySubmission(submissionId);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
