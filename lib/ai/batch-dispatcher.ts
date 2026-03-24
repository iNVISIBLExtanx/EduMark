import { anthropic } from './claude-client';
import { buildSystemPrompt, type MarkingResult } from './mark-paper';
import { getBatchById, updateBatchStatus, updateBatchClaudeBatchId, updateBatchMarkedPapers } from '@/lib/db/batches';
import { getSubmissionsByBatch, updateSubmissionStatus, getSubmissionPdfBuffer } from '@/lib/db/submissions';
import { getMarkingSchemeById } from '@/lib/db/marking-schemes';
import { getQuestionPaperById } from '@/lib/db/question-papers';
import { checkAndDeductMinutes } from '@/lib/db/billing';
import { saveMarkingResults } from '@/lib/db/marking-results';
/**
 * Dispatches all pending submissions in a batch to the Claude Batch API.
 *
 * Order of operations:
 * 1. Load batch context (submissions, scheme, paper/subject)
 * 2. Deduct AI minutes BEFORE calling Claude
 * 3. Encode PDFs as base64 for native PDF input
 * 4. Build system prompt with cache_control
 * 5. Submit Batch API job
 * 6. Save claude_batch_id to batch
 */
export async function dispatchMarkingBatch(batchId: string, tutorId: string): Promise<string> {
  // 1. Load batch and verify ownership
  const batch = await getBatchById(batchId, tutorId);

  // 2. Load all pending submissions
  const submissions = await getSubmissionsByBatch(batchId);
  const pendingSubmissions = submissions.filter((s) => s.status === 'pending');
  if (pendingSubmissions.length === 0) {
    throw new Error('no_pending_submissions');
  }

  // 3. Billing gate — deduct BEFORE touching Claude
  await checkAndDeductMinutes(tutorId, pendingSubmissions.length);

  // 4. Set batch to processing
  await updateBatchStatus(batchId, 'processing');

  // 5. Load marking scheme context
  const scheme = await getMarkingSchemeById(batch.scheme_id);
  const schemeText = scheme.structure_json
    ? JSON.stringify(scheme.structure_json)
    : '';

  // 6. Load paper to get subject name
  const paper = await getQuestionPaperById(batch.paper_id, tutorId);
  const subjects = (paper as unknown as { subjects?: { name: string }[] }).subjects;
  const subjectName = subjects?.[0]?.name ?? 'General';

  // 7. Build system prompt (cached across all papers in this batch)
  const systemPromptText = buildSystemPrompt(subjectName, batch.medium, schemeText);

  // 8. Encode each submission's PDF as base64 and build requests
  const requests = await Promise.all(
    pendingSubmissions.map(async (sub) => {
      const pdfBuffer = await getSubmissionPdfBuffer(sub.pdf_url);
      const pdfBase64 = pdfBuffer.toString('base64');

      return {
        custom_id: sub.id,
        params: {
          model: 'claude-sonnet-4-6' as const,
          max_tokens: 4000,
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
                  text: 'Mark this paper per the scheme. Return JSON only.',
                },
              ],
            },
          ],
        },
      };
    }),
  );

  // 9. Submit to Claude Batch API
  const batchJob = await anthropic.beta.messages.batches.create({ requests });

  // 10. Save claude_batch_id and update submission statuses
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
 * - If batch is still processing, returns current progress.
 * - If batch has ended, iterates results, parses JSON, saves marking_results,
 *   updates submission statuses, and marks batch as completed.
 */
export async function pollBatchResults(batchId: string, tutorId: string): Promise<PollResult> {
  const batch = await getBatchById(batchId, tutorId);

  if (!batch.claude_batch_id) {
    throw new Error('batch_not_dispatched');
  }

  // Check Anthropic Batch API status
  const batchJob = await anthropic.beta.messages.batches.retrieve(batch.claude_batch_id);

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
      const textBlock = message.content.find(
        (block: { type: string }) => block.type === 'text',
      );

      if (textBlock && 'text' in textBlock) {
        try {
          const parsed: MarkingResult = JSON.parse(textBlock.text);
          await saveMarkingResults(submissionId, parsed);
          await updateSubmissionStatus(submissionId, 'marked');
          markedCount++;
        } catch {
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
