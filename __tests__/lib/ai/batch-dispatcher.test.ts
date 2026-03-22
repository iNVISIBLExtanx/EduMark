import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Test IDs ---
const BATCH_ID = '00000000-0000-4000-8000-000000000040';
const TUTOR_ID = '00000000-0000-4000-8000-000000000001';
const SCHEME_ID = '00000000-0000-4000-8000-000000000030';
const PAPER_ID = '00000000-0000-4000-8000-000000000020';
const SUBMISSION_ID_1 = '00000000-0000-4000-8000-000000000061';
const SUBMISSION_ID_2 = '00000000-0000-4000-8000-000000000062';
const CLAUDE_BATCH_ID = 'msgbatch_abc123';

// --- Mock marking result ---
const MOCK_MARKING_RESULT = {
  questions: [
    {
      question_no: 1,
      max_marks: 10,
      awarded_marks: 7,
      student_answer_text: 'F=ma',
      feedback: 'Good',
      ocr_confidence: 'high',
    },
  ],
  total_awarded: 7,
  total_max: 10,
  general_feedback: 'Well done',
};

// --- Mock functions ---
const mockGetBatchById = vi.fn();
const mockUpdateBatchStatus = vi.fn();
const mockUpdateBatchClaudeBatchId = vi.fn();
const mockUpdateBatchMarkedPapers = vi.fn();

vi.mock('@/lib/db/batches', () => ({
  getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
  updateBatchStatus: (...args: unknown[]) => mockUpdateBatchStatus(...args),
  updateBatchClaudeBatchId: (...args: unknown[]) => mockUpdateBatchClaudeBatchId(...args),
  updateBatchMarkedPapers: (...args: unknown[]) => mockUpdateBatchMarkedPapers(...args),
}));

const mockGetSubmissionsByBatch = vi.fn();
const mockUpdateSubmissionStatus = vi.fn();
const mockGetSubmissionPdfBuffer = vi.fn();

vi.mock('@/lib/db/submissions', () => ({
  getSubmissionsByBatch: (...args: unknown[]) => mockGetSubmissionsByBatch(...args),
  updateSubmissionStatus: (...args: unknown[]) => mockUpdateSubmissionStatus(...args),
  getSubmissionPdfBuffer: (...args: unknown[]) => mockGetSubmissionPdfBuffer(...args),
}));

const mockGetMarkingSchemeById = vi.fn();

vi.mock('@/lib/db/marking-schemes', () => ({
  getMarkingSchemeById: (...args: unknown[]) => mockGetMarkingSchemeById(...args),
}));

const mockGetQuestionPaperById = vi.fn();

vi.mock('@/lib/db/question-papers', () => ({
  getQuestionPaperById: (...args: unknown[]) => mockGetQuestionPaperById(...args),
}));

const mockCheckAndDeductMinutes = vi.fn();

vi.mock('@/lib/db/billing', () => ({
  checkAndDeductMinutes: (...args: unknown[]) => mockCheckAndDeductMinutes(...args),
}));

const mockSaveMarkingResults = vi.fn();

vi.mock('@/lib/db/marking-results', () => ({
  saveMarkingResults: (...args: unknown[]) => mockSaveMarkingResults(...args),
}));

const mockPdfToImages = vi.fn();

vi.mock('@/lib/pdf/pdf-to-images', () => ({
  pdfToImages: (...args: unknown[]) => mockPdfToImages(...args),
}));

const mockBuildSystemPrompt = vi.fn();

vi.mock('@/lib/ai/mark-paper', () => ({
  buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(...args),
}));

const mockBatchesCreate = vi.fn();
const mockBatchesRetrieve = vi.fn();
const mockBatchesResults = vi.fn();

vi.mock('@/lib/ai/claude-client', () => ({
  anthropic: {
    beta: {
      messages: {
        batches: {
          create: (...args: unknown[]) => mockBatchesCreate(...args),
          retrieve: (...args: unknown[]) => mockBatchesRetrieve(...args),
          results: (...args: unknown[]) => mockBatchesResults(...args),
        },
      },
    },
  },
}));

// --- Import after mocks ---
import { dispatchMarkingBatch, pollBatchResults } from '@/lib/ai/batch-dispatcher';

// --- Test data factories ---
function makeBatch(overrides = {}) {
  return {
    id: BATCH_ID,
    tutor_id: TUTOR_ID,
    paper_id: PAPER_ID,
    scheme_id: SCHEME_ID,
    name: 'Test Batch',
    medium: 'english',
    status: 'pending',
    claude_batch_id: null,
    total_papers: 2,
    marked_papers: 0,
    ...overrides,
  };
}

function makeSubmission(id: string, status = 'pending') {
  return {
    id,
    student_id: `student-${id}`,
    batch_id: BATCH_ID,
    pdf_url: `submissions/${TUTOR_ID}/${BATCH_ID}/${id}.pdf`,
    page_count: 3,
    status,
    claude_req_id: null,
  };
}

// --- Setup ---
beforeEach(() => {
  vi.clearAllMocks();

  // Default happy-path returns
  mockGetBatchById.mockResolvedValue(makeBatch());
  mockGetSubmissionsByBatch.mockResolvedValue([
    makeSubmission(SUBMISSION_ID_1),
    makeSubmission(SUBMISSION_ID_2),
  ]);
  mockCheckAndDeductMinutes.mockResolvedValue(undefined);
  mockUpdateBatchStatus.mockResolvedValue(undefined);
  mockGetMarkingSchemeById.mockResolvedValue({
    id: SCHEME_ID,
    paper_id: PAPER_ID,
    pdf_url: 'schemes/test.pdf',
    structure_json: { questions: [{ no: 1, marks: 10 }] },
    embeddings_done: true,
  });
  mockGetQuestionPaperById.mockResolvedValue({
    id: PAPER_ID,
    tutor_id: TUTOR_ID,
    title: 'Physics 2025',
    subjects: [{ name: 'Physics' }],
  });
  mockBuildSystemPrompt.mockReturnValue('You are an expert examiner...');
  mockGetSubmissionPdfBuffer.mockResolvedValue(Buffer.from('fake-pdf'));
  mockPdfToImages.mockResolvedValue({ images: ['base64img1', 'base64img2'], pageCount: 2 });
  mockBatchesCreate.mockResolvedValue({ id: CLAUDE_BATCH_ID });
  mockUpdateBatchClaudeBatchId.mockResolvedValue(undefined);
  mockUpdateSubmissionStatus.mockResolvedValue(undefined);
  mockSaveMarkingResults.mockResolvedValue(undefined);
  mockUpdateBatchMarkedPapers.mockResolvedValue(undefined);
});

// ============================================================
// dispatchMarkingBatch
// ============================================================
describe('dispatchMarkingBatch', () => {
  it('returns the claude batch id on happy path', async () => {
    const result = await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);
    expect(result).toBe(CLAUDE_BATCH_ID);
  });

  it('calls checkAndDeductMinutes BEFORE anthropic batch create', async () => {
    const callOrder: string[] = [];
    mockCheckAndDeductMinutes.mockImplementation(async () => {
      callOrder.push('deduct');
    });
    mockBatchesCreate.mockImplementation(async () => {
      callOrder.push('claude');
      return { id: CLAUDE_BATCH_ID };
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(callOrder).toEqual(['deduct', 'claude']);
  });

  it('sets batch status to processing', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'processing');
  });

  it('saves claude_batch_id to the database', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockUpdateBatchClaudeBatchId).toHaveBeenCalledWith(BATCH_ID, CLAUDE_BATCH_ID);
  });

  it('throws no_pending_submissions when all submissions are already marked', async () => {
    mockGetSubmissionsByBatch.mockResolvedValue([
      makeSubmission(SUBMISSION_ID_1, 'marked'),
      makeSubmission(SUBMISSION_ID_2, 'marked'),
    ]);

    await expect(dispatchMarkingBatch(BATCH_ID, TUTOR_ID)).rejects.toThrow(
      'no_pending_submissions',
    );
  });

  it('throws when checkAndDeductMinutes fails', async () => {
    mockCheckAndDeductMinutes.mockRejectedValue(new Error('insufficient_ai_minutes'));

    await expect(dispatchMarkingBatch(BATCH_ID, TUTOR_ID)).rejects.toThrow(
      'insufficient_ai_minutes',
    );
    // Claude should NOT have been called
    expect(mockBatchesCreate).not.toHaveBeenCalled();
  });

  it('deducts minutes equal to the number of pending submissions only', async () => {
    // One pending, one already marked
    mockGetSubmissionsByBatch.mockResolvedValue([
      makeSubmission(SUBMISSION_ID_1, 'pending'),
      makeSubmission(SUBMISSION_ID_2, 'marked'),
    ]);

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockCheckAndDeductMinutes).toHaveBeenCalledWith(TUTOR_ID, 1);
  });

  it('sets custom_id on each request matching the submission id', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const createCall = mockBatchesCreate.mock.calls[0][0];
    const customIds = createCall.requests.map((r: { custom_id: string }) => r.custom_id);
    expect(customIds).toContain(SUBMISSION_ID_1);
    expect(customIds).toContain(SUBMISSION_ID_2);
  });

  it('builds system prompt with correct subject, medium, and scheme text', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(
      'Physics',
      'english',
      JSON.stringify({ questions: [{ no: 1, marks: 10 }] }),
    );
  });

  it('includes cache_control ephemeral on the system block', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const createCall = mockBatchesCreate.mock.calls[0][0];
    const systemBlock = createCall.requests[0].params.system[0];
    expect(systemBlock.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('includes base64 images from pdfToImages in each request', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const createCall = mockBatchesCreate.mock.calls[0][0];
    const userContent = createCall.requests[0].params.messages[0].content;
    const imageBlocks = userContent.filter((b: { type: string }) => b.type === 'image');
    expect(imageBlocks).toHaveLength(2);
    expect(imageBlocks[0].source.data).toBe('base64img1');
    expect(imageBlocks[1].source.data).toBe('base64img2');
    expect(imageBlocks[0].source.media_type).toBe('image/png');
  });

  it('updates each pending submission status to processing', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(
      SUBMISSION_ID_1,
      'processing',
      SUBMISSION_ID_1,
    );
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(
      SUBMISSION_ID_2,
      'processing',
      SUBMISSION_ID_2,
    );
  });

  it('uses model claude-sonnet-4-6', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const createCall = mockBatchesCreate.mock.calls[0][0];
    expect(createCall.requests[0].params.model).toBe('claude-sonnet-4-6');
  });

  it('uses empty string for scheme text when structure_json is null', async () => {
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      paper_id: PAPER_ID,
      pdf_url: 'schemes/test.pdf',
      structure_json: null,
      embeddings_done: false,
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith('Physics', 'english', '');
  });

  it('defaults subject name to General when paper has no subjects', async () => {
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      tutor_id: TUTOR_ID,
      title: 'Unknown Paper',
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(
      'General',
      expect.any(String),
      expect.any(String),
    );
  });
});

// ============================================================
// pollBatchResults
// ============================================================
describe('pollBatchResults', () => {
  it('throws batch_not_dispatched when no claude_batch_id', async () => {
    mockGetBatchById.mockResolvedValue(makeBatch({ claude_batch_id: null }));

    await expect(pollBatchResults(BATCH_ID, TUTOR_ID)).rejects.toThrow(
      'batch_not_dispatched',
    );
  });

  it('returns processing status when batch has not ended', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, marked_papers: 0, total_papers: 2 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'in_progress' });

    const result = await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(result).toEqual({ status: 'processing', marked: 0, total: 2 });
  });

  it('does not iterate results when batch is still processing', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'in_progress' });

    await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockBatchesResults).not.toHaveBeenCalled();
  });

  it('parses Claude JSON response and saves marking results', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 1 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: {
            type: 'succeeded',
            message: {
              content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }],
            },
          },
        };
      },
    });

    await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockSaveMarkingResults).toHaveBeenCalledWith(SUBMISSION_ID_1, MOCK_MARKING_RESULT);
  });

  it('updates submission status to marked on success', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 1 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: {
            type: 'succeeded',
            message: {
              content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }],
            },
          },
        };
      },
    });

    await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'marked');
  });

  it('updates submission status to failed when JSON parse fails', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 1 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: {
            type: 'succeeded',
            message: {
              content: [{ type: 'text', text: 'not valid json {{{' }],
            },
          },
        };
      },
    });

    await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'failed');
    expect(mockSaveMarkingResults).not.toHaveBeenCalled();
  });

  it('updates submission status to failed when result type is not succeeded', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 1 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: {
            type: 'errored',
            error: { message: 'rate_limit' },
          },
        };
      },
    });

    await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'failed');
  });

  it('updates batch to completed and sets marked count on success', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 2 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: {
            type: 'succeeded',
            message: { content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }] },
          },
        };
        yield {
          custom_id: SUBMISSION_ID_2,
          result: {
            type: 'succeeded',
            message: { content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }] },
          },
        };
      },
    });

    const result = await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockUpdateBatchMarkedPapers).toHaveBeenCalledWith(BATCH_ID, 2);
    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'completed');
    expect(result).toEqual({ status: 'completed', marked: 2, total: 2 });
  });

  it('updates batch to failed when all results fail', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 2 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: { type: 'errored', error: { message: 'error' } },
        };
        yield {
          custom_id: SUBMISSION_ID_2,
          result: { type: 'errored', error: { message: 'error' } },
        };
      },
    });

    const result = await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'failed');
    expect(result.status).toBe('failed');
    expect(result.marked).toBe(0);
  });

  it('marks batch completed when some succeed and some fail', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 2 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: {
            type: 'succeeded',
            message: { content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }] },
          },
        };
        yield {
          custom_id: SUBMISSION_ID_2,
          result: { type: 'errored', error: { message: 'error' } },
        };
      },
    });

    const result = await pollBatchResults(BATCH_ID, TUTOR_ID);

    // Mixed results => completed (not failed), because at least one succeeded
    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'completed');
    expect(result.status).toBe('completed');
    expect(result.marked).toBe(1);
  });

  it('handles succeeded result with no text block as failed', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 1 }),
    );
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: {
            type: 'succeeded',
            message: {
              content: [{ type: 'image', source: { type: 'base64', data: 'abc' } }],
            },
          },
        };
      },
    });

    await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'failed');
    expect(mockSaveMarkingResults).not.toHaveBeenCalled();
  });
});
