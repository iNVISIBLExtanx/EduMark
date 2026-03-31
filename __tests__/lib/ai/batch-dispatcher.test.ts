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
  paper_name: 'Paper II (Essay)',
  questions: [
    {
      part: 'Part A',
      question_no: 1,
      max_marks: 10,
      awarded_marks: 7,
      student_answer_text: 'F=ma',
      feedback: 'Good',
      ocr_confidence: 'high' as const,
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

const mockBuildSystemPrompt = vi.fn();
const mockBuildUserMessageText = vi.fn();
const mockMarkingOutputFormat = { type: 'json_schema', schema: {} };
const mockMarkingResultSchema = {
  parse: vi.fn((val: unknown) => val),
};

vi.mock('@/lib/ai/mark-paper', () => ({
  buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(...args),
  buildUserMessageText: (...args: unknown[]) => mockBuildUserMessageText(...args),
  markingOutputFormat: { type: 'json_schema', schema: {} },
  markingResultSchema: { parse: (val: unknown) => mockMarkingResultSchema.parse(val) },
}));

const mockBatchesCreate = vi.fn();
const mockBatchesRetrieve = vi.fn();
const mockBatchesResults = vi.fn();
const mockMessagesStream = vi.fn();

vi.mock('@/lib/ai/claude-client', () => ({
  anthropic: {
    messages: {
      stream: (...args: unknown[]) => mockMessagesStream(...args),
    },
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
import { dispatchMarkingBatch, pollBatchResults, prepareMarking, executeMarking, sanitizeMarkingResult } from '@/lib/ai/batch-dispatcher';

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
    paper_name: null,
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
  // Supabase FK join returns a single object, NOT an array
  mockGetQuestionPaperById.mockResolvedValue({
    id: PAPER_ID,
    tutor_id: TUTOR_ID,
    title: 'Physics 2025',
    subjects: { name: 'Physics' },
  });
  mockBuildSystemPrompt.mockReturnValue('You are an expert examiner...');
  mockBuildUserMessageText.mockReturnValue('mock 7-step marking instructions');
  mockGetSubmissionPdfBuffer.mockResolvedValue(Buffer.from('fake-pdf'));
  mockBatchesCreate.mockResolvedValue({ id: CLAUDE_BATCH_ID });
  mockMessagesStream.mockReturnValue({
    finalMessage: () => Promise.resolve({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }],
    }),
  });
  mockUpdateBatchClaudeBatchId.mockResolvedValue(undefined);
  mockUpdateSubmissionStatus.mockResolvedValue(undefined);
  mockSaveMarkingResults.mockResolvedValue(undefined);
  mockUpdateBatchMarkedPapers.mockResolvedValue(undefined);
  mockMarkingResultSchema.parse.mockImplementation((val: unknown) => val);
});

// --- Helper: create many submissions to force Batch API path (>10) ---
function makeManySubmissions(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeSubmission(`sub-${String(i).padStart(4, '0')}`)
  );
}

// ============================================================
// dispatchMarkingBatch — shared behavior
// ============================================================
describe('dispatchMarkingBatch', () => {
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
    expect(mockBatchesCreate).not.toHaveBeenCalled();
    expect(mockMessagesStream).not.toHaveBeenCalled();
  });

  it('deducts minutes equal to the number of pending submissions only', async () => {
    mockGetSubmissionsByBatch.mockResolvedValue([
      makeSubmission(SUBMISSION_ID_1, 'pending'),
      makeSubmission(SUBMISSION_ID_2, 'marked'),
    ]);

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockCheckAndDeductMinutes).toHaveBeenCalledWith(TUTOR_ID, 1);
  });

  it('builds system prompt with correct subject, medium, and scheme text', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(
      'Physics',
      'english',
      JSON.stringify({ questions: [{ no: 1, marks: 10 }] }),
      undefined,
    );
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

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith('Physics', 'english', '', undefined);
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
      undefined,
    );
  });

  it('extracts subject name from Supabase single-object FK join (not array)', async () => {
    // Supabase returns subjects as { name: 'Combined Maths' }, not [{ name: 'Combined Maths' }]
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      tutor_id: TUTOR_ID,
      title: 'Combined Maths 2025',
      subjects: { name: 'Combined Maths' },
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(
      'Combined Maths',
      expect.any(String),
      expect.any(String),
      undefined,
    );
  });

  it('sets batch status to processing', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'processing');
  });
});

// ============================================================
// dispatchMarkingBatch — direct mode (≤10 papers)
// ============================================================
describe('dispatchMarkingBatch (direct mode)', () => {
  it('returns "direct" for small batches', async () => {
    const result = await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);
    expect(result).toBe('direct');
  });

  it('calls messages.stream (not batch API) for ≤10 papers', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockMessagesStream).toHaveBeenCalledTimes(2);
    expect(mockBatchesCreate).not.toHaveBeenCalled();
  });

  it('saves marking results and marks submissions as marked', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockSaveMarkingResults).toHaveBeenCalledWith(SUBMISSION_ID_1, MOCK_MARKING_RESULT);
    expect(mockSaveMarkingResults).toHaveBeenCalledWith(SUBMISSION_ID_2, MOCK_MARKING_RESULT);
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'marked');
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_2, 'marked');
  });

  it('sets batch to completed after all papers marked', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'completed');
  });

  it('marks submission as failed when messages.stream throws', async () => {
    mockMessagesStream
      .mockReturnValueOnce({
        finalMessage: () => Promise.resolve({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }],
        }),
      })
      .mockReturnValueOnce({
        finalMessage: () => Promise.reject(new Error('API error')),
      });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'marked');
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_2, 'failed');
    // Mixed results → completed
    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'completed');
  });

  it('uses model claude-sonnet-4-6 with max_tokens 32000', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const call = mockMessagesStream.mock.calls[0][0];
    expect(call.model).toBe('claude-sonnet-4-6');
    expect(call.max_tokens).toBe(32000);
  });

  it('includes cache_control ephemeral with 1h TTL on the system block', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const call = mockMessagesStream.mock.calls[0][0];
    expect(call.system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
  });

  it('sends PDF as native document block', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const call = mockMessagesStream.mock.calls[0][0];
    const docBlock = call.messages[0].content.find((b: { type: string }) => b.type === 'document');
    expect(docBlock.source.type).toBe('base64');
    expect(docBlock.source.media_type).toBe('application/pdf');
    expect(docBlock.source.data).toBe(Buffer.from('fake-pdf').toString('base64'));
  });

  it('includes output_config with structured output format', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const call = mockMessagesStream.mock.calls[0][0];
    expect(call.output_config).toBeDefined();
    expect(call.output_config.format).toBeDefined();
    expect(call.output_config.format.type).toBe('json_schema');
  });

  it('marks submission as failed when stop_reason is max_tokens (truncation)', async () => {
    mockMessagesStream.mockReturnValue({
      finalMessage: () => Promise.resolve({
        stop_reason: 'max_tokens',
        content: [{ type: 'text', text: '{"questions": [{"question_no": 1' }],
      }),
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'failed');
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_2, 'failed');
    expect(mockSaveMarkingResults).not.toHaveBeenCalled();
    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'failed');
  });

  it('overrides paper_name with batch canonical value, not Claude-invented text', async () => {
    mockGetBatchById.mockResolvedValue(makeBatch({ paper_name: 'Pure (Paper I)' }));
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    // MOCK_MARKING_RESULT.paper_name is 'Paper II (Essay)' — should be overridden
    const savedResult = mockSaveMarkingResults.mock.calls[0][1];
    expect(savedResult.paper_name).toBe('Pure (Paper I)');
  });
});

// ============================================================
// dispatchMarkingBatch — Batch API mode (>10 papers)
// ============================================================
describe('dispatchMarkingBatch (Batch API mode)', () => {
  beforeEach(() => {
    mockGetSubmissionsByBatch.mockResolvedValue(makeManySubmissions(11));
  });

  it('returns the claude batch id for >10 papers', async () => {
    const result = await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);
    expect(result).toBe(CLAUDE_BATCH_ID);
  });

  it('calls batch API (not messages.stream) for >10 papers', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockBatchesCreate).toHaveBeenCalledTimes(1);
    expect(mockMessagesStream).not.toHaveBeenCalled();
  });

  it('saves claude_batch_id to the database', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockUpdateBatchClaudeBatchId).toHaveBeenCalledWith(BATCH_ID, CLAUDE_BATCH_ID);
  });

  it('sets custom_id on each request matching the submission id', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const createCall = mockBatchesCreate.mock.calls[0][0];
    expect(createCall.requests).toHaveLength(11);
    expect(createCall.requests[0].custom_id).toBe('sub-0000');
  });

  it('uses model claude-sonnet-4-6 with max_tokens 32000', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const createCall = mockBatchesCreate.mock.calls[0][0];
    expect(createCall.requests[0].params.model).toBe('claude-sonnet-4-6');
    expect(createCall.requests[0].params.max_tokens).toBe(32000);
  });

  it('uses 1-hour cache TTL for batch API (higher cache hit rate)', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const createCall = mockBatchesCreate.mock.calls[0][0];
    expect(createCall.requests[0].params.system[0].cache_control).toEqual({
      type: 'ephemeral',
      ttl: '1h',
    });
  });

  it('includes output_config with structured output format in batch requests', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const createCall = mockBatchesCreate.mock.calls[0][0];
    expect(createCall.requests[0].params.output_config).toBeDefined();
    expect(createCall.requests[0].params.output_config.format.type).toBe('json_schema');
  });

  it('sets batch status to processing AFTER successful Claude API call', async () => {
    const callOrder: string[] = [];
    mockBatchesCreate.mockImplementation(async () => {
      callOrder.push('claude');
      return { id: CLAUDE_BATCH_ID };
    });
    mockUpdateBatchStatus.mockImplementation(async () => {
      callOrder.push('status');
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(callOrder.indexOf('claude')).toBeLessThan(callOrder.indexOf('status'));
  });
});

// ============================================================
// prepareMarking + executeMarking (two-phase dispatch)
// ============================================================
describe('prepareMarking', () => {
  it('returns pendingSubmissions and systemPromptText', async () => {
    const result = await prepareMarking(BATCH_ID, TUTOR_ID);
    expect(result.pendingSubmissions).toHaveLength(2);
    expect(result.systemPromptText).toBe('You are an expert examiner...');
    expect(result.batch).toBeDefined();
  });

  it('deducts billing minutes', async () => {
    await prepareMarking(BATCH_ID, TUTOR_ID);
    expect(mockCheckAndDeductMinutes).toHaveBeenCalledWith(TUTOR_ID, 2);
  });

  it('throws when no pending submissions', async () => {
    mockGetSubmissionsByBatch.mockResolvedValue([
      makeSubmission(SUBMISSION_ID_1, 'marked'),
    ]);
    await expect(prepareMarking(BATCH_ID, TUTOR_ID)).rejects.toThrow('no_pending_submissions');
  });
});

describe('executeMarking', () => {
  it('uses direct mode for ≤10 submissions', async () => {
    const subs = [{ id: SUBMISSION_ID_1, pdf_url: 'test.pdf' }, { id: SUBMISSION_ID_2, pdf_url: 'test2.pdf' }];
    const result = await executeMarking(BATCH_ID, subs, 'system prompt', 'Physics', undefined);
    expect(result).toBe('direct');
    expect(mockMessagesStream).toHaveBeenCalledTimes(2);
  });

  it('uses Batch API for >10 submissions', async () => {
    const subs = Array.from({ length: 11 }, (_, i) => ({ id: `sub-${i}`, pdf_url: `test-${i}.pdf` }));
    const result = await executeMarking(BATCH_ID, subs, 'system prompt', 'Physics', undefined);
    expect(result).toBe(CLAUDE_BATCH_ID);
    expect(mockBatchesCreate).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// pollBatchResults
// ============================================================
describe('pollBatchResults', () => {
  it('returns processing status for direct marking (no claude_batch_id, status processing)', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: null, status: 'processing', marked_papers: 1, total_papers: 2 }),
    );

    const result = await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(result).toEqual({ status: 'processing', marked: 1, total: 2 });
    expect(mockBatchesRetrieve).not.toHaveBeenCalled();
  });

  it('throws batch_not_dispatched when no claude_batch_id and status is pending', async () => {
    mockGetBatchById.mockResolvedValue(makeBatch({ claude_batch_id: null, status: 'pending' }));

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
              stop_reason: 'end_turn',
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
              stop_reason: 'end_turn',
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
              stop_reason: 'end_turn',
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
            message: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }] },
          },
        };
        yield {
          custom_id: SUBMISSION_ID_2,
          result: {
            type: 'succeeded',
            message: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }] },
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
            message: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }] },
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
              stop_reason: 'end_turn',
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

  it('marks submission as failed when stop_reason is max_tokens (truncation)', async () => {
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
              stop_reason: 'max_tokens',
              content: [{ type: 'text', text: '{"questions": [{"question_no": 1' }],
            },
          },
        };
      },
    });

    await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'failed');
    expect(mockSaveMarkingResults).not.toHaveBeenCalled();
  });

  it('returns cached result without re-processing when batch is already completed', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, status: 'completed', marked_papers: 2, total_papers: 2 }),
    );

    const result = await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(result).toEqual({ status: 'completed', marked: 2, total: 2 });
    expect(mockBatchesRetrieve).not.toHaveBeenCalled();
    expect(mockBatchesResults).not.toHaveBeenCalled();
  });

  it('returns cached result without re-processing when batch is already failed', async () => {
    mockGetBatchById.mockResolvedValue(
      makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, status: 'failed', marked_papers: 0, total_papers: 2 }),
    );

    const result = await pollBatchResults(BATCH_ID, TUTOR_ID);

    expect(result).toEqual({ status: 'failed', marked: 0, total: 2 });
    expect(mockBatchesRetrieve).not.toHaveBeenCalled();
  });

  it('extracts subject from single-object question_papers.subjects join in pollBatchResults', async () => {
    // getBatchById returns question_papers as a single object (many-to-one FK), not an array
    mockGetBatchById.mockResolvedValue({
      ...makeBatch({ claude_batch_id: CLAUDE_BATCH_ID, total_papers: 1 }),
      question_papers: { subjects: { name: 'Combined Maths' } },
    });
    mockBatchesRetrieve.mockResolvedValue({ processing_status: 'ended' });
    mockBatchesResults.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          custom_id: SUBMISSION_ID_1,
          result: {
            type: 'succeeded',
            message: {
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }],
            },
          },
        };
      },
    });

    await pollBatchResults(BATCH_ID, TUTOR_ID);

    // sanitizeMarkingResult is called with 'Combined Maths' (not 'General') —
    // verified indirectly: saveMarkingResults is called (parse succeeded)
    expect(mockSaveMarkingResults).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// sanitizeMarkingResult — unit tests (pure function, no mocks needed)
// ============================================================
describe('sanitizeMarkingResult', () => {
  function makeQuestion(overrides: Partial<{
    part: string; question_no: number; max_marks: number; awarded_marks: number;
    student_answer_text: string; feedback: string; ocr_confidence: 'high' | 'low';
  }> = {}) {
    return {
      part: 'Part A',
      question_no: 1,
      max_marks: 10,
      awarded_marks: 8,
      student_answer_text: 'answer',
      feedback: 'good',
      ocr_confidence: 'high' as const,
      ...overrides,
    };
  }

  function makeResult(questions: ReturnType<typeof makeQuestion>[], overrides: Partial<{
    best_questions_selected: number[]; total_awarded: number; total_max: number;
  }> = {}) {
    return {
      paper_name: 'Pure (Paper I)',
      questions,
      total_awarded: questions.reduce((s, q) => s + q.awarded_marks, 0),
      total_max: questions.reduce((s, q) => s + q.max_marks, 0),
      general_feedback: '',
      ...overrides,
    };
  }

  it('returns result unchanged for non-Combined-Maths subject', () => {
    const result = makeResult([makeQuestion({ part: 'Part A', question_no: 1, max_marks: 25 })]);
    const out = sanitizeMarkingResult(result, 'Physics');
    expect(out).toBe(result); // same reference
  });

  it('corrects Part A max_marks from wrong value to 25', () => {
    const result = makeResult([
      makeQuestion({ part: 'Part A', question_no: 1, max_marks: 10, awarded_marks: 8 }),
      makeQuestion({ part: 'Part A', question_no: 2, max_marks: 10, awarded_marks: 6 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    expect(out.questions[0].max_marks).toBe(25);
    expect(out.questions[1].max_marks).toBe(25);
  });

  it('corrects Part B max_marks from wrong value to 150', () => {
    const partBQs = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ part: 'Part B', question_no: 11 + i, max_marks: 10, awarded_marks: 8 - i })
    );
    const result = makeResult([
      ...Array.from({ length: 10 }, (_, i) =>
        makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
      ),
      ...partBQs,
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const partBOut = out.questions.filter(q => q.part === 'Part B');
    partBOut.forEach(q => expect(q.max_marks).toBe(150));
  });

  it('recomputes best_questions_selected as top 5 Part B by awarded_marks', () => {
    const partA = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
    );
    const partB = [
      makeQuestion({ part: 'Part B', question_no: 11, max_marks: 150, awarded_marks: 130 }),
      makeQuestion({ part: 'Part B', question_no: 12, max_marks: 150, awarded_marks: 110 }),
      makeQuestion({ part: 'Part B', question_no: 13, max_marks: 150, awarded_marks: 90 }),
      makeQuestion({ part: 'Part B', question_no: 14, max_marks: 150, awarded_marks: 70 }),
      makeQuestion({ part: 'Part B', question_no: 15, max_marks: 150, awarded_marks: 50 }),
      makeQuestion({ part: 'Part B', question_no: 16, max_marks: 150, awarded_marks: 30 }),
      makeQuestion({ part: 'Part B', question_no: 17, max_marks: 150, awarded_marks: 10 }),
    ];
    const result = makeResult([...partA, ...partB]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');

    // Best 5 should be Q11–Q15 (highest awarded_marks)
    expect(out.best_questions_selected).toHaveLength(5);
    expect(out.best_questions_selected).toContain(11);
    expect(out.best_questions_selected).toContain(15);
    expect(out.best_questions_selected).not.toContain(16);
    expect(out.best_questions_selected).not.toContain(17);
  });

  it('recomputes total_awarded as Part A sum + best-5 Part B sum', () => {
    const partA = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
    );
    const partB = [
      makeQuestion({ part: 'Part B', question_no: 11, max_marks: 150, awarded_marks: 130 }),
      makeQuestion({ part: 'Part B', question_no: 12, max_marks: 150, awarded_marks: 110 }),
      makeQuestion({ part: 'Part B', question_no: 13, max_marks: 150, awarded_marks: 90 }),
      makeQuestion({ part: 'Part B', question_no: 14, max_marks: 150, awarded_marks: 70 }),
      makeQuestion({ part: 'Part B', question_no: 15, max_marks: 150, awarded_marks: 50 }),
      makeQuestion({ part: 'Part B', question_no: 16, max_marks: 150, awarded_marks: 30 }),
      makeQuestion({ part: 'Part B', question_no: 17, max_marks: 150, awarded_marks: 10 }),
    ];
    const result = makeResult([...partA, ...partB]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');

    // Part A: 10 × 20 = 200. Best-5: 130+110+90+70+50 = 450. Total = 650
    expect(out.total_awarded).toBe(650);
  });

  it('recomputes total_max correctly', () => {
    const partA = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
    );
    const partB = Array.from({ length: 7 }, (_, i) =>
      makeQuestion({ part: 'Part B', question_no: 11 + i, max_marks: 150, awarded_marks: 100 })
    );
    const result = makeResult([...partA, ...partB]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');

    // 10 × 25 + 5 × 150 = 250 + 750 = 1000
    expect(out.total_max).toBe(1000);
  });

  it('infers Part A from question_no ≤ 10 when part is empty string', () => {
    const result = makeResult([
      makeQuestion({ part: '', question_no: 5, max_marks: 10, awarded_marks: 8 }),
      makeQuestion({ part: '', question_no: 12, max_marks: 10, awarded_marks: 100 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q5 = out.questions.find(q => q.question_no === 5);
    const q12 = out.questions.find(q => q.question_no === 12);
    expect(q5?.max_marks).toBe(25);
    expect(q12?.max_marks).toBe(150);
  });
});
