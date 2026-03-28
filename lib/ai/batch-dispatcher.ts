import { anthropic } from './claude-client';
import { buildSystemPrompt, markingOutputFormat, markingResultSchema, type MarkingResult } from './mark-paper';
import { getBatchById, updateBatchStatus, updateBatchClaudeBatchId, updateBatchMarkedPapers } from '@/lib/db/batches';
import { getSubmissionsByBatch, updateSubmissionStatus, getSubmissionPdfBuffer } from '@/lib/db/submissions';
import { getMarkingSchemeById } from '@/lib/db/marking-schemes';
import { getQuestionPaperById } from '@/lib/db/question-papers';
import { checkAndDeductMinutes } from '@/lib/db/billing';
import { saveMarkingResults } from '@/lib/db/marking-results';

/** Threshold: batches with this many or fewer papers use direct (instant) marking */
const DIRECT_MARKING_THRESHOLD = 10;

/** Max output tokens — set high for Sinhala/Tamil which use ~2-3x more tokens than English */
const MAX_OUTPUT_TOKENS = 32000;

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
  const subjects = (paper as unknown as { subjects?: { name: string }[] }).subjects;
  const subjectName = subjects?.[0]?.name ?? 'General';
  const systemPromptText = buildSystemPrompt(subjectName, batch.medium, schemeText);

  return { batch, pendingSubmissions, systemPromptText };
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
): Promise<string> {
  if (pendingSubmissions.length <= DIRECT_MARKING_THRESHOLD) {
    return dispatchDirect(batchId, pendingSubmissions, systemPromptText);
  }
  return dispatchBatchAPI(batchId, pendingSubmissions, systemPromptText);
}

/**
 * Dispatches marking — validates billing, then marks all papers.
 * Kept for backward compatibility (tests, etc). Awaits full completion.
 */
export async function dispatchMarkingBatch(batchId: string, tutorId: string): Promise<string> {
  const { pendingSubmissions, systemPromptText } = await loadMarkingContext(batchId, tutorId);

  if (pendingSubmissions.length <= DIRECT_MARKING_THRESHOLD) {
    return dispatchDirect(batchId, pendingSubmissions, systemPromptText);
  }

  return dispatchBatchAPI(batchId, pendingSubmissions, systemPromptText);
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
): Promise<string> {
  await updateBatchStatus(batchId, 'processing');

  let markedCount = 0;
  let failedCount = 0;

  for (const sub of pendingSubmissions) {
    await updateSubmissionStatus(sub.id, 'processing', sub.id);

    try {
      const pdfBuffer = await getSubmissionPdfBuffer(sub.pdf_url);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Use streaming to avoid SDK timeout on large PDF + high max_tokens requests.
      // The SDK requires streaming for requests that may take >10 minutes.
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [
          {
            type: 'text' as const,
            text: systemPromptText,
            cache_control: { type: 'ephemeral' as const },
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
                text: 'Mark this paper per the scheme.',
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
        const parsed: MarkingResult = markingResultSchema.parse(JSON.parse(textBlock.text));
        await saveMarkingResults(sub.id, parsed);
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
): Promise<string> {
  const requests = await Promise.all(
    pendingSubmissions.map(async (sub) => {
      const pdfBuffer = await getSubmissionPdfBuffer(sub.pdf_url);
      const pdfBase64 = pdfBuffer.toString('base64');

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
                  text: 'Mark this paper per the scheme.',
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
          const parsed: MarkingResult = markingResultSchema.parse(JSON.parse(textBlock.text));
          await saveMarkingResults(submissionId, parsed);
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
