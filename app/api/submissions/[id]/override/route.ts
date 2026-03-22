import { createServerClient } from '@/lib/supabase/server';
import { updateMarkingOverride } from '@/lib/db/marking-results';
import { overrideMarksSchema } from '@/lib/validations/schemas';
import { NextResponse } from 'next/server';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: submissionId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Parse and validate body
  const body = await req.json();
  const parsed = overrideMarksSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { result_id, override_marks, override_feedback } = parsed.data;

  try {
    await updateMarkingOverride(result_id, submissionId, override_marks, override_feedback);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
