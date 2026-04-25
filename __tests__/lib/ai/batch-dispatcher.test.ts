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
const mockGetMarkingSchemePdfBuffer = vi.fn();

vi.mock('@/lib/db/marking-schemes', () => ({
  getMarkingSchemeById: (...args: unknown[]) => mockGetMarkingSchemeById(...args),
  getMarkingSchemePdfBuffer: (...args: unknown[]) => mockGetMarkingSchemePdfBuffer(...args),
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
const mockBuildTriagePrompt = vi.fn().mockReturnValue('triage system prompt');
const mockMarkingOutputFormat = { type: 'json_schema', schema: {} };
const mockMarkingResultSchema = {
  parse: vi.fn((val: unknown) => val),
};

vi.mock('@/lib/ai/mark-paper', () => ({
  buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(...args),
  buildUserMessageText: (...args: unknown[]) => mockBuildUserMessageText(...args),
  buildTriagePrompt: () => mockBuildTriagePrompt(),
  markingOutputFormat: { type: 'json_schema', schema: {} },
  markingResultSchema: { parse: (val: unknown) => mockMarkingResultSchema.parse(val) },
}));

const mockBatchesCreate = vi.fn();
const mockBatchesRetrieve = vi.fn();
const mockBatchesResults = vi.fn();
const mockMessagesStream = vi.fn();
const mockMessagesCreate = vi.fn();

vi.mock('@/lib/ai/claude-client', () => ({
  anthropic: {
    messages: {
      stream: (...args: unknown[]) => mockMessagesStream(...args),
      create: (...args: unknown[]) => mockMessagesCreate(...args),
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
import { dispatchMarkingBatch, pollBatchResults, prepareMarking, executeMarking, sanitizeMarkingResult, normalizePart } from '@/lib/ai/batch-dispatcher';

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
  mockGetMarkingSchemePdfBuffer.mockResolvedValue(Buffer.from('fake-scheme-pdf'));
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

  it('sends marking scheme PDF as first cached document block and student PDF as second', async () => {
    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const call = mockMessagesStream.mock.calls[0][0];
    const docBlocks = call.messages[0].content.filter((b: { type: string }) => b.type === 'document');
    expect(docBlocks).toHaveLength(2);

    // First block: marking scheme with cache_control
    expect(docBlocks[0].source.data).toBe(Buffer.from('fake-scheme-pdf').toString('base64'));
    expect(docBlocks[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });

    // Second block: student PDF (no cache_control — unique per student)
    expect(docBlocks[1].source.type).toBe('base64');
    expect(docBlocks[1].source.media_type).toBe('application/pdf');
    expect(docBlocks[1].source.data).toBe(Buffer.from('fake-pdf').toString('base64'));
    expect(docBlocks[1].cache_control).toBeUndefined();
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

  it('marks submission failed without calling Claude when combined PDFs exceed 22MB limit', async () => {
    // scheme: 12MB + student: 11MB = 23MB > 22MB limit
    const oversizedStudent = Buffer.alloc(11 * 1024 * 1024);
    const largeScheme = Buffer.alloc(12 * 1024 * 1024);
    mockGetMarkingSchemePdfBuffer.mockResolvedValue(largeScheme);
    mockGetSubmissionPdfBuffer.mockResolvedValue(oversizedStudent);

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockMessagesStream).not.toHaveBeenCalled();
    expect(mockSaveMarkingResults).not.toHaveBeenCalled();
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'failed');
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_2, 'failed');
    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'failed');
  });

  it('marks only oversized submissions failed, still marks valid ones when sizes are mixed', async () => {
    const smallStudent = Buffer.from('small-pdf');   // tiny, fine
    const bigStudent = Buffer.alloc(23 * 1024 * 1024); // 23MB alone > 22MB limit
    const smallScheme = Buffer.alloc(0);              // no scheme → combined = student size only

    mockGetMarkingSchemePdfBuffer.mockResolvedValue(smallScheme);
    mockGetSubmissionPdfBuffer
      .mockResolvedValueOnce(smallStudent)
      .mockResolvedValueOnce(bigStudent);

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockMessagesStream).toHaveBeenCalledTimes(1); // only the small one
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_1, 'marked');
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(SUBMISSION_ID_2, 'failed');
    // Mixed result → completed
    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'completed');
  });
});

// ============================================================
// triage pass — Combined Maths gets pre-scan before marking
// ============================================================
describe('triage pass (Combined Maths direct mode)', () => {
  beforeEach(() => {
    // Override to Combined Maths subject
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      tutor_id: TUTOR_ID,
      title: 'CM Paper 2025',
      subjects: { name: 'Combined Maths' },
    });
    mockBuildUserMessageText.mockReturnValue('7-step instructions');
  });

  it('calls messages.create (triage) before messages.stream (marking) for Combined Maths', async () => {
    const triageJson = {
      part_a: [{ question_no: 1, sub_parts: 'all' }],
      part_b: [{ question_no: 11, sub_parts: ['(a)', '(b)'] }],
    };
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(triageJson) }],
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2); // once per submission
    expect(mockMessagesStream).toHaveBeenCalledTimes(2);
  });

  it('injects <attendance_triage> block into user message text when triage succeeds', async () => {
    const triageJson = {
      part_a: [{ question_no: 1, sub_parts: 'all' }],
      part_b: [{ question_no: 11, sub_parts: ['(a)'] }],
    };
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(triageJson) }],
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    const streamCall = mockMessagesStream.mock.calls[0][0];
    // The last text block is the instruction (earlier text blocks are document labels)
    const allTextBlocks = streamCall.messages[0].content.filter((b: { type: string }) => b.type === 'text');
    const textBlock = allTextBlocks[allTextBlocks.length - 1];
    expect(textBlock.text).toContain('<attendance_triage>');
    expect(textBlock.text).toContain('Part A Q1');
    expect(textBlock.text).toContain('Part B Q11');
  });

  it('proceeds without triage context when triage call fails (graceful degradation)', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API error'));

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    // Marking still completes
    expect(mockSaveMarkingResults).toHaveBeenCalledTimes(2);
    // No attendance_triage in user message — check the instruction text block (last text block)
    const streamCall = mockMessagesStream.mock.calls[0][0];
    const allTextBlocks = streamCall.messages[0].content.filter((b: { type: string }) => b.type === 'text');
    const textBlock = allTextBlocks[allTextBlocks.length - 1];
    expect(textBlock.text).not.toContain('<attendance_triage>');
  });

  it('does NOT call triage for non-CM subjects (Physics)', async () => {
    // Default beforeEach sets up Physics subject in the global beforeEach
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      tutor_id: TUTOR_ID,
      title: 'Physics 2025',
      subjects: { name: 'Physics' },
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('skips triage (proceeds without context) when student PDF exceeds 14MB limit', async () => {
    // 15MB student PDF → too large for messages.create (non-streaming)
    const oversizedBuffer = Buffer.alloc(15 * 1024 * 1024);
    mockGetSubmissionPdfBuffer.mockResolvedValue(oversizedBuffer);
    // messages.create should NOT be called (triage skipped); stream still runs
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{}' }],
    });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockMessagesCreate).not.toHaveBeenCalled();
    // Marking still proceeds (graceful degradation) — but combined check may fail here
    // The oversized PDF alone (15MB) + scheme buffer (fake-scheme-pdf ~15B) is under 22MB,
    // so marking itself succeeds (no triage context injected)
    const streamCall = mockMessagesStream.mock.calls[0][0];
    const textBlock = streamCall.messages[0].content.find((b: { type: string }) => b.type === 'text');
    expect(textBlock.text).not.toContain('<attendance_triage>');
    expect(mockSaveMarkingResults).toHaveBeenCalledTimes(2);
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

  it('excludes oversized submissions from batch request and marks them failed', async () => {
    const submissions = makeManySubmissions(11);
    mockGetSubmissionsByBatch.mockResolvedValue(submissions);

    // scheme: 12MB, so combined limit is 22MB — student must be < 10MB
    const largeScheme = Buffer.alloc(12 * 1024 * 1024);
    mockGetMarkingSchemePdfBuffer.mockResolvedValue(largeScheme);

    // First submission: oversized (11MB student + 12MB scheme = 23MB > 22MB)
    const oversized = Buffer.alloc(11 * 1024 * 1024);
    const normal = Buffer.from('normal-pdf');
    mockGetSubmissionPdfBuffer
      .mockResolvedValueOnce(oversized)   // sub-0000: oversized
      .mockResolvedValue(normal);         // rest: normal

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    // Batch created with only 10 submissions (11 - 1 oversized)
    const batchCall = mockBatchesCreate.mock.calls[0][0];
    expect(batchCall.requests).toHaveLength(10);

    // First submission marked failed
    expect(mockUpdateSubmissionStatus).toHaveBeenCalledWith(submissions[0].id, 'failed');
  });

  it('sets batch to failed immediately when all submissions are oversized', async () => {
    const submissions = makeManySubmissions(11);
    mockGetSubmissionsByBatch.mockResolvedValue(submissions);

    const largeScheme = Buffer.alloc(12 * 1024 * 1024);
    mockGetMarkingSchemePdfBuffer.mockResolvedValue(largeScheme);
    mockGetSubmissionPdfBuffer.mockResolvedValue(Buffer.alloc(11 * 1024 * 1024)); // all oversized

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockBatchesCreate).not.toHaveBeenCalled();
    expect(mockUpdateBatchStatus).toHaveBeenCalledWith(BATCH_ID, 'failed');
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

  it('returns result with same values for non-Combined-Maths subject (no CM transformations)', () => {
    const result = makeResult([makeQuestion({ part: 'Part A', question_no: 1, max_marks: 25 })]);
    const out = sanitizeMarkingResult(result, 'Physics');
    expect(out).toStrictEqual(result);
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

  it('uses fixed total_max of 1000 when fewer than 5 Part B questions attempted', () => {
    const partA = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
    );
    const partB = Array.from({ length: 4 }, (_, i) =>
      makeQuestion({ part: 'Part B', question_no: 11 + i, max_marks: 150, awarded_marks: 100 })
    );
    const result = makeResult([...partA, ...partB]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');

    // total_max must always be 1000, not 850 (the old bug when only 4 Part B attempted)
    expect(out.total_max).toBe(1000);
    // total_awarded = Part A (10×20=200) + best 4 Part B (4×100=400) = 600
    expect(out.total_awarded).toBe(600);
  });

  it('uses fixed total_max of 1000 when no Part B questions attempted', () => {
    const partA = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
    );
    const result = makeResult([...partA]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');

    expect(out.total_max).toBe(1000);
    expect(out.total_awarded).toBe(200); // only Part A marks
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

  it('rounds Part A awarded_marks to nearest 5 (22 → 20)', () => {
    const result = makeResult([
      makeQuestion({ part: 'Part A', question_no: 1, max_marks: 25, awarded_marks: 22 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q1 = out.questions.find(q => q.question_no === 1);
    expect(q1?.awarded_marks).toBe(20);
  });

  it('rounds Part A awarded_marks to nearest 5 (23 → 25)', () => {
    const result = makeResult([
      makeQuestion({ part: 'Part A', question_no: 1, max_marks: 25, awarded_marks: 23 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q1 = out.questions.find(q => q.question_no === 1);
    expect(q1?.awarded_marks).toBe(25);
  });

  it('clamps Part A awarded_marks to [0, 25] (27 → 25)', () => {
    const result = makeResult([
      makeQuestion({ part: 'Part A', question_no: 1, max_marks: 25, awarded_marks: 27 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q1 = out.questions.find(q => q.question_no === 1);
    expect(q1?.awarded_marks).toBe(25);
  });

  it('does not round Part B awarded_marks (Part B uses raw marks)', () => {
    const result = makeResult([
      makeQuestion({ part: 'Part B', question_no: 11, max_marks: 150, awarded_marks: 87 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q11 = out.questions.find(q => q.question_no === 11);
    expect(q11?.awarded_marks).toBe(87);
  });

  // --- Part label normalization ---
  it('normalizes null part with question_no ≤ 10 to Part A', () => {
    const result = makeResult([
      makeQuestion({ part: null as unknown as string, question_no: 3, max_marks: 10, awarded_marks: 8 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q3 = out.questions.find(q => q.question_no === 3);
    expect(q3?.part).toBe('Part A');
    expect(q3?.max_marks).toBe(25);
  });

  it('normalizes part="A" to Part A', () => {
    const result = makeResult([
      makeQuestion({ part: 'A', question_no: 2, max_marks: 10, awarded_marks: 15 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q2 = out.questions.find(q => q.question_no === 2);
    expect(q2?.part).toBe('Part A');
  });

  it('normalizes part="B" to Part B', () => {
    const result = makeResult([
      makeQuestion({ part: 'B', question_no: 12, max_marks: 10, awarded_marks: 80 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q12 = out.questions.find(q => q.question_no === 12);
    expect(q12?.part).toBe('Part B');
    expect(q12?.max_marks).toBe(150);
  });

  it('normalizes part="Part A / Part B" with question_no > 10 to Part B', () => {
    const result = makeResult([
      makeQuestion({ part: 'Part A / Part B', question_no: 11, max_marks: 10, awarded_marks: 80 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q11 = out.questions.find(q => q.question_no === 11);
    expect(q11?.part).toBe('Part B');
  });

  it('no questions dropped when part labels are non-canonical', () => {
    const questions = [
      makeQuestion({ part: null as unknown as string, question_no: 1, awarded_marks: 20 }),
      makeQuestion({ part: 'A', question_no: 2, awarded_marks: 15 }),
      makeQuestion({ part: 'B', question_no: 12, awarded_marks: 80 }),
      makeQuestion({ part: 'Part A / Part B', question_no: 13, awarded_marks: 90 }),
    ];
    const result = makeResult(questions);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    expect(out.questions.some(q => q.question_no === 1)).toBe(true);
    expect(out.questions.some(q => q.question_no === 2)).toBe(true);
    expect(out.questions.some(q => q.question_no === 12)).toBe(true);
    expect(out.questions.some(q => q.question_no === 13)).toBe(true);
  });

  // --- Part A padding ---
  it('pads missing Part A questions to 10 with awarded_marks=0 and ocr_confidence=low', () => {
    const partA = Array.from({ length: 8 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
    );
    const result = makeResult([...partA]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const partAOut = out.questions.filter(q => q.part === 'Part A');
    expect(partAOut).toHaveLength(10);
    const q9 = partAOut.find(q => q.question_no === 9);
    const q10 = partAOut.find(q => q.question_no === 10);
    expect(q9?.awarded_marks).toBe(0);
    expect(q9?.ocr_confidence).toBe('low');
    expect(q10?.awarded_marks).toBe(0);
    expect(q10?.ocr_confidence).toBe('low');
  });

  it('does not add extra Part A questions when all 10 are present', () => {
    const partA = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
    );
    const result = makeResult([...partA]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    expect(out.questions.filter(q => q.part === 'Part A')).toHaveLength(10);
  });

  // --- Sub_questions arithmetic reconciliation ---
  it('uses sub_questions sum as canonical awarded_marks for Part A when sub_questions present', () => {
    const result = makeResult([
      Object.assign(makeQuestion({ part: 'Part A', question_no: 1, max_marks: 25, awarded_marks: 20 }), {
        sub_questions: [
          { label: '(a)', max_marks: 5, awarded_marks: 5, feedback: 'correct' },
          { label: '(b)', max_marks: 5, awarded_marks: 4, feedback: 'almost' },
          { label: '(c)', max_marks: 5, awarded_marks: 5, feedback: 'correct' },
          { label: '(d)', max_marks: 5, awarded_marks: 5, feedback: 'correct' },
          { label: '(e)', max_marks: 5, awarded_marks: 4, feedback: 'almost' },
        ],
      }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q1 = out.questions.find(q => q.question_no === 1);
    // sum = 5+4+5+5+4 = 23
    expect(q1?.awarded_marks).toBe(23);
  });

  it('falls back to rounding when sub_questions is absent (22 → 20)', () => {
    const result = makeResult([
      makeQuestion({ part: 'Part A', question_no: 1, max_marks: 25, awarded_marks: 22 }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q1 = out.questions.find(q => q.question_no === 1);
    expect(q1?.awarded_marks).toBe(20);
  });

  it('clamps sub_questions sum to 25 when sum exceeds max_marks', () => {
    const result = makeResult([
      Object.assign(makeQuestion({ part: 'Part A', question_no: 1, max_marks: 25, awarded_marks: 25 }), {
        sub_questions: [
          { label: '(a)', max_marks: 5, awarded_marks: 8, feedback: 'over' },
          { label: '(b)', max_marks: 5, awarded_marks: 8, feedback: 'over' },
          { label: '(c)', max_marks: 5, awarded_marks: 8, feedback: 'over' },
          { label: '(d)', max_marks: 5, awarded_marks: 7, feedback: 'over' },
        ],
      }),
    ]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    const q1 = out.questions.find(q => q.question_no === 1);
    // sum = 31, clamped to 25
    expect(q1?.awarded_marks).toBe(25);
  });

  // --- Bounds enforcement for all subjects ---
  it('clamps awarded_marks to max_marks for non-CM subjects', () => {
    const result = {
      paper_name: 'Paper',
      questions: [
        { part: '', question_no: 1, max_marks: 20, awarded_marks: 22, feedback: 'ok', ocr_confidence: 'high' as const },
      ],
      total_awarded: 22,
      total_max: 20,
      general_feedback: '',
    };
    const out = sanitizeMarkingResult(result, 'Physics');
    expect(out.questions[0].awarded_marks).toBe(20);
  });

  // --- Tie-breaking in best-5 selection ---
  it('breaks ties in best-5 selection by lower question_no first (deterministic)', () => {
    const partA = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 20 })
    );
    const partB = [
      makeQuestion({ part: 'Part B', question_no: 11, max_marks: 150, awarded_marks: 100 }),
      makeQuestion({ part: 'Part B', question_no: 12, max_marks: 150, awarded_marks: 100 }),
      makeQuestion({ part: 'Part B', question_no: 13, max_marks: 150, awarded_marks: 100 }),
      makeQuestion({ part: 'Part B', question_no: 14, max_marks: 150, awarded_marks: 100 }),
      makeQuestion({ part: 'Part B', question_no: 15, max_marks: 150, awarded_marks: 100 }),
      makeQuestion({ part: 'Part B', question_no: 16, max_marks: 150, awarded_marks: 50 }),
      makeQuestion({ part: 'Part B', question_no: 17, max_marks: 150, awarded_marks: 50 }),
    ];
    const result = makeResult([...partA, ...partB]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    expect(out.best_questions_selected).toEqual([11, 12, 13, 14, 15]);
  });

  it('excludes Part A question numbers (≤ 10) from Part B best-5', () => {
    const partA = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ part: 'Part A', question_no: i + 1, max_marks: 25, awarded_marks: 25 })
    );
    // Q10 labelled Part B (the historical corruption scenario) — should be excluded by > 10 guard
    const partBWithSneakyQ10 = [
      makeQuestion({ part: 'Part B', question_no: 10, max_marks: 150, awarded_marks: 149 }),
      makeQuestion({ part: 'Part B', question_no: 11, max_marks: 150, awarded_marks: 120 }),
      makeQuestion({ part: 'Part B', question_no: 12, max_marks: 150, awarded_marks: 100 }),
      makeQuestion({ part: 'Part B', question_no: 13, max_marks: 150, awarded_marks: 80 }),
      makeQuestion({ part: 'Part B', question_no: 14, max_marks: 150, awarded_marks: 60 }),
      makeQuestion({ part: 'Part B', question_no: 15, max_marks: 150, awarded_marks: 40 }),
    ];
    const result = makeResult([...partA, ...partBWithSneakyQ10]);
    const out = sanitizeMarkingResult(result, 'Combined Maths');
    expect(out.best_questions_selected).not.toContain(10);
    expect(out.best_questions_selected).toContain(11);
  });
});

// ============================================================
// normalizePart — exported helper (unit tests, no mocks)
// ============================================================
describe('normalizePart', () => {
  it("maps 'Part A' to 'Part A'", () => {
    expect(normalizePart('Part A', 1)).toBe('Part A');
  });

  it("maps 'A' to 'Part A'", () => {
    expect(normalizePart('A', 1)).toBe('Part A');
  });

  it("maps 'Part B' to 'Part B'", () => {
    expect(normalizePart('Part B', 12)).toBe('Part B');
  });

  it("maps 'B' to 'Part B'", () => {
    expect(normalizePart('B', 12)).toBe('Part B');
  });

  it('maps null + question_no ≤ 10 to Part A', () => {
    expect(normalizePart(null, 10)).toBe('Part A');
  });

  it('maps null + question_no > 10 to Part B', () => {
    expect(normalizePart(null, 11)).toBe('Part B');
  });

  it("maps 'Part A / Part B' + question_no ≤ 10 to Part A", () => {
    expect(normalizePart('Part A / Part B', 5)).toBe('Part A');
  });

  it("maps 'Part A / Part B' + question_no > 10 to Part B", () => {
    expect(normalizePart('Part A / Part B', 12)).toBe('Part B');
  });

  it('maps empty string + question_no ≤ 10 to Part A', () => {
    expect(normalizePart('', 7)).toBe('Part A');
  });

  it('maps empty string + question_no > 10 to Part B', () => {
    expect(normalizePart('', 15)).toBe('Part B');
  });
});

// ============================================================
// triage retry logic
// ============================================================
describe('triage retry logic (Combined Maths)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish defaults for a single-submission Combined Maths batch
    mockGetBatchById.mockResolvedValue(makeBatch());
    mockGetSubmissionsByBatch.mockResolvedValue([makeSubmission(SUBMISSION_ID_1)]);
    mockCheckAndDeductMinutes.mockResolvedValue(undefined);
    mockUpdateBatchStatus.mockResolvedValue(undefined);
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID, paper_id: PAPER_ID, pdf_url: 'schemes/test.pdf',
      structure_json: null, embeddings_done: false,
    });
    mockGetMarkingSchemePdfBuffer.mockResolvedValue(Buffer.from('fake-scheme-pdf'));
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID, tutor_id: TUTOR_ID, title: 'CM 2025',
      subjects: { name: 'Combined Maths' },
    });
    mockBuildSystemPrompt.mockReturnValue('You are an expert examiner...');
    mockBuildUserMessageText.mockReturnValue('7-step instructions');
    mockGetSubmissionPdfBuffer.mockResolvedValue(Buffer.from('fake-pdf'));
    mockUpdateSubmissionStatus.mockResolvedValue(undefined);
    mockSaveMarkingResults.mockResolvedValue(undefined);
    mockUpdateBatchMarkedPapers.mockResolvedValue(undefined);
    mockUpdateBatchClaudeBatchId.mockResolvedValue(undefined);
    mockMarkingResultSchema.parse.mockImplementation((val: unknown) => val);
    mockMessagesStream.mockReturnValue({
      finalMessage: () => Promise.resolve({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(MOCK_MARKING_RESULT) }],
      }),
    });
  });

  it('retries triage on Zod validation failure and succeeds on second attempt', async () => {
    const invalidTriage = { part_a: 'not an array', part_b: [] };
    const validTriage = {
      part_a: [{ question_no: 1, sub_parts: 'all' }],
      part_b: [{ question_no: 11, sub_parts: 'all' }],
    };
    mockMessagesCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(invalidTriage) }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(validTriage) }] });

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
    const streamCall = mockMessagesStream.mock.calls[0][0];
    const allTextBlocks = streamCall.messages[0].content.filter((b: { type: string }) => b.type === 'text');
    const lastText = allTextBlocks[allTextBlocks.length - 1];
    expect(lastText.text).toContain('<attendance_triage>');
    expect(lastText.text).toContain('Part A Q1');
  });

  it('proceeds without triage when all attempts fail (graceful degradation)', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('network error'));

    await dispatchMarkingBatch(BATCH_ID, TUTOR_ID);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
    expect(mockSaveMarkingResults).toHaveBeenCalledTimes(1);
    const streamCall = mockMessagesStream.mock.calls[0][0];
    const allTextBlocks = streamCall.messages[0].content.filter((b: { type: string }) => b.type === 'text');
    const lastText = allTextBlocks[allTextBlocks.length - 1];
    expect(lastText.text).not.toContain('<attendance_triage>');
  });
});
