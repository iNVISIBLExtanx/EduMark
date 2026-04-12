import { anthropic } from './claude-client';
import { buildSystemPrompt, buildTriagePrompt, buildUserMessageText, markingOutputFormat, markingResultSchema, type MarkingResult } from './mark-paper';
import { getBatchById, updateBatchStatus, updateBatchClaudeBatchId, updateBatchMarkedPapers } from '@/lib/db/batches';
import { getSubmissionsByBatch, updateSubmissionStatus, getSubmissionPdfBuffer } from '@/lib/db/submissions';
import { getMarkingSchemeById } from '@/lib/db/marking-schemes';
import { getQuestionPaperById } from '@/lib/db/question-papers';
import { checkAndDeductMinutes } from '@/lib/db/billing';
import { saveMarkingResults } from '@/lib/db/marking-results';

/** Threshold: batches with this many or fewer papers use direct (instant) marking */
const DIRECT_MARKING_THRESHOLD = 10;

/**
 * Defense-in-depth post-parse correction for Combined Maths marking results.
 *
 * The AI prompt instructs correct max_marks and BEST-5 selection, but as a
 * server-side safety net we enforce them here regardless of AI output.
 *
 * For all other subjects: no-op, returns result unchanged.
 */
export function sanitizeMarkingResult(result: MarkingResult, subject: string): MarkingResult {
  if (subject !== 'Combined Maths') return result;

  const partAQuestions = result.questions
    .filter((q) => q.part === 'Part A' || (q.part === '' && q.question_no <= 10))
    .map((q) => {
      // Combined Maths Part A: each sub-question is worth 5 marks → awarded total must be a multiple of 5
      const rounded = Math.round(q.awarded_marks / 5) * 5;
      const clamped = Math.min(Math.max(rounded, 0), 25);
      return { ...q, part: q.part || 'Part A', max_marks: 25, awarded_marks: clamped };
    });

  const partBQuestions = result.questions
    .filter((q) => q.part === 'Part B' || (q.part === '' && q.question_no > 10))
    .map((q) => ({ ...q, part: q.part || 'Part B', max_marks: 150 }));

  // Select best 5 Part B questions by awarded_marks descending
  const sortedPartB = [...partBQuestions].sort((a, b) => b.awarded_marks - a.awarded_marks);
  const best5 = sortedPartB.slice(0, 5);
  const best5Nos = best5.map((q) => q.question_no);

  const totalAwarded =
    partAQuestions.reduce((s, q) => s + q.awarded_marks, 0) +
    best5.reduce((s, q) => s + q.awarded_marks, 0);
  // Combined Maths paper structure is fixed: 10 Part A (×25) + best 5 Part B (×150) = 1000.
  // total_max is always 1000 regardless of how many questions the student attempted.
  const totalMax = 10 * 25 + 5 * 150;

  return {
    ...result,
    questions: [...partAQuestions, ...partBQuestions],
    best_questions_selected: best5Nos,
    total_awarded: totalAwarded,
    total_max: totalMax,
  };
}

/** Max output tokens — set high for Sinhala/Tamil which use ~2-3x more tokens than English */
const MAX_OUTPUT_TOKENS = 32000;

/**
 * Subjects that benefit from a triage pre-scan.
 * Combined Maths has complex multi-page Part A + Part B structure where
 * single-pass marking frequently misidentifies which questions were attempted.
 */
const TRIAGE_SUBJECTS = new Set(['Combined Maths']);

interface TriageQuestion {
  question_no: number;
  sub_parts: string | string[]; // "all" or array like ["(a)", "(b)"]
}
interface TriageResult {
  part_a: TriageQuestion[];
  part_b: TriageQuestion[];
}

/**
 * Converts a triage result to a human-readable string for injection into the
 * user message as an attendance constraint for the marking pass.
 */
function formatTriageForPrompt(triage: TriageResult): string {
  const partA = triage.part_a
    .map((q) => {
      const parts = q.sub_parts === 'all' ? 'all sub-parts' : (q.sub_parts as string[]).join(', ');
      return `  Part A Q${q.question_no}: ${parts}`;
    })
    .join('\n');

  const partB =
    triage.part_b.length > 0
      ? triage.part_b
          .map((q) => {
            const parts = q.sub_parts === 'all' ? 'all sub-parts' : (q.sub_parts as string[]).join(', ');
            return `  Part B Q${q.question_no}: ${parts}`;
          })
          .join('\n')
      : '  (none — student left all Part B questions blank)';

  return `Part A attempted:\n${partA}\n\nPart B attempted:\n${partB}`;
}

/**
 * Lightweight Claude call that scans a student PDF and returns a JSON list of
 * which questions and sub-parts were attempted. No marking scheme needed.
 *
 * Non-fatal: if triage fails for any reason, returns null and marking proceeds
 * without triage context (graceful degradation).
 */
async function triagePaper(pdfBuffer: Buffer): Promise<TriageResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildTriagePrompt(),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: 'Scan this handwritten answer script and output the attendance JSON.',
            },
          ],
        },
      ],
    });
    const text = response.content.find((c) => c.type === 'text');
    if (!text || !('text' in text)) return null;
    return JSON.parse(text.text) as TriageResult;
  } catch {
    console.warn('[triage] Failed to triage paper — proceeding without triage context');
    return null;
  }
}

/**
 * Loads batch context needed for marking: submissions, scheme, prompt.
 */
async function loadMarkingContext(batchId: string, tutorId: string) {
  const batch = await getBatchById(batchId, tutorId);
  const submissions = await getSubmissionsByBatch(batchId);
  const pendingSubmissions = submissions.filter((s) => s.status === 'pending');
  if (pendingSubmissions.length === 0) {
    throw new Error('no_pending_submissions');
  }

  await checkAndDeductMinutes(tutorId, pendingSubmissions.length);

  const scheme = await getMarkingSchemeById(batch.scheme_id);
  const schemeText = scheme.structure_json
    ? JSON.stringify(scheme.structure_json)
    : '';
  const paper = await getQuestionPaperById(batch.paper_id, tutorId);
  // Supabase returns the FK join as a single object (many-to-one), not an array
  const subjects = (paper as unknown as { subjects?: { name: string } }).subjects;
  const subjectName = subjects?.name ?? 'General';
  const paperName: string | undefined = (batch as unknown as { paper_name?: string | null }).paper_name ?? undefined;
  const systemPromptText = buildSystemPrompt(subjectName, batch.medium, schemeText, paperName);

  return { batch, pendingSubmissions, systemPromptText, subject: subjectName, paperName };
}

/**
 * Phase 1: Validates, deducts billing, loads context. Throws on errors.
 * Must be awaited before responding to the client.
 */
export async function prepareMarking(batchId: string, tutorId: string) {
  return loadMarkingContext(batchId, tutorId);
}

/**
 * Phase 2: Executes the actual marking (streaming or Batch API).
 * Designed to run in the background — errors are logged, not thrown to caller.
 */
export async function executeMarking(
  batchId: string,
  pendingSubmissions: { id: string; pdf_url: string }[],
  systemPromptText: string,
  subject: string,
  paperName?: string,
): Promise<string> {
  if (pendingSubmissions.length <= DIRECT_MARKING_THRESHOLD) {
    return dispatchDirect(batchId, pendingSubmissions, systemPromptText, subject, paperName);
  }
  return dispatchBatchAPI(batchId, pendingSubmissions, systemPromptText, subject, paperName);
}

/**
 * Dispatches marking — validates billing, then marks all papers.
 * Kept for backward compatibility (tests, etc). Awaits full completion.
 */
export async function dispatchMarkingBatch(batchId: string, tutorId: string): Promise<string> {
  const { pendingSubmissions, systemPromptText, subject, paperName } = await loadMarkingContext(batchId, tutorId);

  if (pendingSubmissions.length <= DIRECT_MARKING_THRESHOLD) {
    return dispatchDirect(batchId, pendingSubmissions, systemPromptText, subject, paperName);
  }

  return dispatchBatchAPI(batchId, pendingSubmissions, systemPromptText, subject, paperName);
}

/**
 * Direct marking: calls messages.create() for each paper sequentially.
 * Results are saved immediately — no polling needed.
 * Uses structured outputs (output_config.format) for guaranteed valid JSON.
 */
async function dispatchDirect(
  batchId: string,
  pendingSubmissions: { id: string; pdf_url: string }[],
  systemPromptText: string,
  subject: string,
  paperName?: string,
): Promise<string> {
  await updateBatchStatus(batchId, 'processing');

  let markedCount = 0;
  let failedCount = 0;

  for (const sub of pendingSubmissions) {
    await updateSubmissionStatus(sub.id, 'processing', sub.id);

    try {
      const pdfBuffer = await getSubmissionPdfBuffer(sub.pdf_url);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Triage pass: for subjects with complex multi-page structure (Combined Maths),
      // scan the paper first to build an attendance list. This prevents the marking
      // pass from hallucinating questions the student never attempted.
      let userMessageText = buildUserMessageText(subject, paperName);
      if (TRIAGE_SUBJECTS.has(subject)) {
        const triage = await triagePaper(pdfBuffer);
        if (triage) {
          const triageContext = formatTriageForPrompt(triage);
          userMessageText += `\n\n<attendance_triage>
CRITICAL — A pre-scan of this answer script identified EXACTLY these attempted questions and sub-parts:
${triageContext}

You MUST output results ONLY for the questions and sub-parts listed above.
For Part B: if a question is not listed, exclude it entirely. If listed sub-parts are "(a)" and "(c)" only, your sub_questions array must contain ONLY entries for (a) and (c).
Do NOT add any question or sub-part not in this triage list.
</attendance_triage>`;
        }
      }

      // Use streaming to avoid SDK timeout on large PDF + high max_tokens requests.
      // The SDK requires streaming for requests that may take >10 minutes.
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [
          {
            type: 'text' as const,
            text: systemPromptText,
            // 1h TTL matches dispatchBatchAPI — Combined Maths papers take 3-8 min each,
            // so a 10-paper batch spans ~50 min. Without TTL (5-min default), papers
            // 5-10 miss the cache and re-send the full marking scheme.
            cache_control: { type: 'ephemeral' as const, ttl: '1h' as const },
          },
        ],
        messages: [
          {
            role: 'user' as const,
            content: [
              {
                type: 'document' as const,
                source: {
                  type: 'base64' as const,
                  media_type: 'application/pdf' as const,
                  data: pdfBase64,
                },
              },
              {
                type: 'text' as const,
                text: userMessageText,
              },
            ],
          },
        ],
        output_config: {
          format: markingOutputFormat,
        },
      });
      const response = await stream.finalMessage();

      // Check for truncation — structured output JSON is invalid when truncated
      if (response.stop_reason === 'max_tokens') {
        console.error(`[dispatchDirect] Response truncated for submission ${sub.id} (stop_reason: max_tokens)`);
        await updateSubmissionStatus(sub.id, 'failed');
        failedCount++;
        continue;
      }

      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && 'text' in textBlock) {
        const parsed: MarkingResult = sanitizeMarkingResult(
          markingResultSchema.parse(JSON.parse(textBlock.text)),
          subject,
        );
        // Override paper_name with the authoritative batch value.
        // Claude tends to invent its own paper name (often in Sinhala or a free-form string).
        // The canonical value ('Pure (Paper I)' / 'Applied (Paper II)') comes from the batch.
        const withCorrectPaperName: MarkingResult = paperName
          ? { ...parsed, paper_name: paperName }
          : parsed;
        await saveMarkingResults(sub.id, withCorrectPaperName);
        await updateSubmissionStatus(sub.id, 'marked');
        markedCount++;
      } else {
        await updateSubmissionStatus(sub.id, 'failed');
        failedCount++;
      }
    } catch (err) {
      console.error(
        `[dispatchDirect] Failed for submission ${sub.id}:`,
        err instanceof Error ? err.message : err,
      );
      await updateSubmissionStatus(sub.id, 'failed');
      failedCount++;
    }

    await updateBatchMarkedPapers(batchId, markedCount);
  }

  const finalStatus = failedCount > 0 && markedCount === 0 ? 'failed' : 'completed';
  await updateBatchStatus(batchId, finalStatus);

  return 'direct';
}

/**
 * Batch API marking: submits all papers as a single Batch API job.
 * 50% cost discount but async — results retrieved via polling.
 * Uses 1-hour cache TTL for higher cache hit rate across batch processing.
 * Uses structured outputs (output_config.format) for guaranteed valid JSON.
 */
async function dispatchBatchAPI(
  batchId: string,
  pendingSubmissions: { id: string; pdf_url: string }[],
  systemPromptText: string,
  subject: string,
  paperName?: string,
): Promise<string> {
  const requests = await Promise.all(
    pendingSubmissions.map(async (sub) => {
      const pdfBuffer = await getSubmissionPdfBuffer(sub.pdf_url);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Triage pass for Batch API (same logic as direct dispatch)
      let userMessageText = buildUserMessageText(subject, paperName);
      if (TRIAGE_SUBJECTS.has(subject)) {
        const triage = await triagePaper(pdfBuffer);
        if (triage) {
          const triageContext = formatTriageForPrompt(triage);
          userMessageText += `\n\n<attendance_triage>
CRITICAL — A pre-scan of this answer script identified EXACTLY these attempted questions and sub-parts:
${triageContext}

You MUST output results ONLY for the questions and sub-parts listed above.
For Part B: if a question is not listed, exclude it entirely. If listed sub-parts are "(a)" and "(c)" only, your sub_questions array must contain ONLY entries for (a) and (c).
Do NOT add any question or sub-part not in this triage list.
</attendance_triage>`;
        }
      }

      return {
        custom_id: sub.id,
        params: {
          model: 'claude-sonnet-4-6' as const,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: [
            {
              type: 'text' as const,
              text: systemPromptText,
              cache_control: { type: 'ephemeral' as const, ttl: '1h' as const },
            },
          ],
          messages: [
            {
              role: 'user' as const,
              content: [
                {
                  type: 'document' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: 'application/pdf' as const,
                    data: pdfBase64,
                  },
                },
                {
                  type: 'text' as const,
                  text: userMessageText,
                },
              ],
            },
          ],
          output_config: {
            format: markingOutputFormat,
          },
        },
      };
    }),
  );

  const batchJob = await anthropic.beta.messages.batches.create({ requests });

  await updateBatchStatus(batchId, 'processing');

  await updateBatchClaudeBatchId(batchId, batchJob.id);
  await Promise.all(
    pendingSubmissions.map((sub) =>
      updateSubmissionStatus(sub.id, 'processing', sub.id),
    ),
  );

  return batchJob.id;
}

export interface PollResult {
  status: 'processing' | 'completed' | 'failed';
  marked: number;
  total: number;
}

/**
 * Polls the Claude Batch API for results and stores them when ready.
 *
 * - If batch is already completed/failed, returns cached result.
 * - If batch is still processing, returns current progress.
 * - If batch has ended, iterates results, parses JSON, saves marking_results,
 *   updates submission statuses, and marks batch as completed.
 */
export async function pollBatchResults(batchId: string, tutorId: string): Promise<PollResult> {
  const batch = await getBatchById(batchId, tutorId);

  // Guard: don't re-process already finalized batches
  if (batch.status === 'completed' || batch.status === 'failed') {
    return {
      status: batch.status as 'completed' | 'failed',
      marked: batch.marked_papers,
      total: batch.total_papers,
    };
  }

  if (!batch.claude_batch_id) {
    // Direct marking (no Batch API) — batch is being processed via streaming.
    // No claude_batch_id to poll. Return current status from DB.
    if (batch.status === 'processing') {
      return {
        status: 'processing',
        marked: batch.marked_papers,
        total: batch.total_papers,
      };
    }
    throw new Error('batch_not_dispatched');
  }

  // Check Anthropic Batch API status
  const batchJob = await anthropic.beta.messages.batches.retrieve(batch.claude_batch_id);

  console.log('[pollBatchResults] Batch API status:', {
    batchId: batch.claude_batch_id,
    processing_status: batchJob.processing_status,
    request_counts: batchJob.request_counts,
    created_at: batchJob.created_at,
    ended_at: batchJob.ended_at,
  });

  if (batchJob.processing_status !== 'ended') {
    return {
      status: 'processing',
      marked: batch.marked_papers,
      total: batch.total_papers,
    };
  }

  // Batch has ended — stream and store results
  let markedCount = 0;
  let failedCount = 0;

  const results = await anthropic.beta.messages.batches.results(batch.claude_batch_id);

  for await (const result of results) {
    const submissionId = result.custom_id;

    if (result.result.type === 'succeeded') {
      const message = result.result.message;

      // Check for truncation before parsing
      if (message.stop_reason === 'max_tokens') {
        console.error(
          `[pollBatchResults] Response truncated for submission ${submissionId} (stop_reason: max_tokens)`,
        );
        await updateSubmissionStatus(submissionId, 'failed');
        failedCount++;
        continue;
      }

      const textBlock = message.content.find(
        (block: { type: string }) => block.type === 'text',
      );

      if (textBlock && 'text' in textBlock) {
        try {
          // With structured outputs, the response is guaranteed valid JSON
          // matching our schema (when not truncated). Zod parse adds safety.
          // sanitizeMarkingResult corrects wrong max_marks + recomputes BEST-5 for Combined Maths.
          // Supabase returns FK joins as single objects (many-to-one), not arrays
          const batchSubject = (batch as unknown as { question_papers?: { subjects?: { name?: string } } })
            .question_papers?.subjects?.name ?? 'General';
          const batchPaperName = (batch as unknown as { paper_name?: string | null }).paper_name ?? undefined;
          const parsed: MarkingResult = sanitizeMarkingResult(
            markingResultSchema.parse(JSON.parse(textBlock.text)),
            batchSubject,
          );
          // Override paper_name with the authoritative batch value (same fix as dispatchDirect).
          const withCorrectPaperName: MarkingResult = batchPaperName
            ? { ...parsed, paper_name: batchPaperName }
            : parsed;
          await saveMarkingResults(submissionId, withCorrectPaperName);
          await updateSubmissionStatus(submissionId, 'marked');
          markedCount++;
        } catch (parseErr) {
          console.error(
            `[pollBatchResults] Failed to parse result for submission ${submissionId}:`,
            parseErr instanceof Error ? parseErr.message : parseErr,
            'Raw text (first 500 chars):',
            textBlock.text.slice(0, 500),
          );
          await updateSubmissionStatus(submissionId, 'failed');
          failedCount++;
        }
      } else {
        await updateSubmissionStatus(submissionId, 'failed');
        failedCount++;
      }
    } else {
      await updateSubmissionStatus(submissionId, 'failed');
      failedCount++;
    }
  }

  // Update batch progress and status
  await updateBatchMarkedPapers(batchId, markedCount);
  const finalStatus = failedCount > 0 && markedCount === 0 ? 'failed' : 'completed';
  await updateBatchStatus(batchId, finalStatus);

  return {
    status: finalStatus as 'completed' | 'failed',
    marked: markedCount,
    total: batch.total_papers,
  };
}
