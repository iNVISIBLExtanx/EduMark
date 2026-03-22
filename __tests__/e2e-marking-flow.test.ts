/**
 * End-to-end integration test covering the full tutor workflow
 * from paper upload through to embedding generation (Phase 1–6).
 *
 * This test calls the actual route handlers with mocked Supabase/OpenAI
 * to verify the entire chain works together — not just individual units.
 *
 * Flow:
 *   1. POST /api/question-papers          — upload question paper PDF
 *   2. POST /api/marking-schemes           — upload marking scheme PDF
 *   3. lib/db updateMarkingSchemeStructure  — simulate scheme parsing (structure_json)
 *   4. POST /api/marking-schemes/[id]/embeddings — generate & store embeddings
 *   5. POST /api/batches                   — create a marking batch
 *   6. POST /api/submissions/upload        — upload student papers
 *   7. Verify billing gate blocks dispatch when subscription inactive
 *   8. Verify retrieveMarkingCriteria returns relevant chunks
 *   9. Verify buildSystemPrompt produces correct prompt with RAG context
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Shared IDs that flow through the chain (must be valid UUIDs for Zod validation) ---
const TEST_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'tutor@test.lk' };
const SUBJECT_ID = '00000000-0000-4000-8000-000000000010';
const PAPER_ID = '00000000-0000-4000-8000-000000000020';
const SCHEME_ID = '00000000-0000-4000-8000-000000000030';
const BATCH_ID = '00000000-0000-4000-8000-000000000040';
const STUDENT_ID = '00000000-0000-4000-8000-000000000050';
const SUBMISSION_ID = '00000000-0000-4000-8000-000000000060';

// --- Mock Supabase with stateful behavior ---
const mockGetUser = vi.fn();
const mockStorageUpload = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    storage: {
      from: vi.fn(() => ({ upload: mockStorageUpload })),
    },
  })),
}));

// --- Mock DB layer: question-papers ---
const mockGetQuestionPapersByTutor = vi.fn();
const mockGetQuestionPaperById = vi.fn();
const mockCreateQuestionPaper = vi.fn();

vi.mock('@/lib/db/question-papers', () => ({
  getQuestionPapersByTutor: (...args: unknown[]) => mockGetQuestionPapersByTutor(...args),
  getQuestionPaperById: (...args: unknown[]) => mockGetQuestionPaperById(...args),
  createQuestionPaper: (...args: unknown[]) => mockCreateQuestionPaper(...args),
}));

// --- Mock DB layer: marking-schemes ---
const mockCreateMarkingScheme = vi.fn();
const mockGetMarkingSchemeById = vi.fn();
const mockGetMarkingSchemeByPaper = vi.fn();
const mockUpdateMarkingSchemeStructure = vi.fn();
const mockInsertEmbeddingChunks = vi.fn();
const mockDeleteEmbeddingsByScheme = vi.fn();
const mockMarkEmbeddingsDone = vi.fn();
const mockMatchMarkingCriteria = vi.fn();

vi.mock('@/lib/db/marking-schemes', () => ({
  createMarkingScheme: (...args: unknown[]) => mockCreateMarkingScheme(...args),
  getMarkingSchemeById: (...args: unknown[]) => mockGetMarkingSchemeById(...args),
  getMarkingSchemeByPaper: (...args: unknown[]) => mockGetMarkingSchemeByPaper(...args),
  updateMarkingSchemeStructure: (...args: unknown[]) => mockUpdateMarkingSchemeStructure(...args),
  insertEmbeddingChunks: (...args: unknown[]) => mockInsertEmbeddingChunks(...args),
  deleteEmbeddingsByScheme: (...args: unknown[]) => mockDeleteEmbeddingsByScheme(...args),
  markEmbeddingsDone: (...args: unknown[]) => mockMarkEmbeddingsDone(...args),
  matchMarkingCriteria: (...args: unknown[]) => mockMatchMarkingCriteria(...args),
}));

// --- Mock DB layer: tutors ---
const mockGetTutorSubjects = vi.fn();

vi.mock('@/lib/db/tutors', () => ({
  getTutorSubjects: (...args: unknown[]) => mockGetTutorSubjects(...args),
}));

// --- Mock DB layer: batches ---
const mockCreateBatch = vi.fn();
const mockGetBatchById = vi.fn();
const mockGetBatchesByTutor = vi.fn();

vi.mock('@/lib/db/batches', () => ({
  createBatch: (...args: unknown[]) => mockCreateBatch(...args),
  getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
  getBatchesByTutor: (...args: unknown[]) => mockGetBatchesByTutor(...args),
}));

// --- Mock DB layer: submissions ---
const mockCreateStudentAndSubmission = vi.fn();
const mockUpdateBatchPaperCount = vi.fn();
const mockGetSubmissionsByBatch = vi.fn();

vi.mock('@/lib/db/submissions', () => ({
  createStudentAndSubmission: (...args: unknown[]) => mockCreateStudentAndSubmission(...args),
  updateBatchPaperCount: (...args: unknown[]) => mockUpdateBatchPaperCount(...args),
  getSubmissionsByBatch: (...args: unknown[]) => mockGetSubmissionsByBatch(...args),
}));

// --- Mock PDF processing ---
const mockGetPdfPageCount = vi.fn();

vi.mock('@/lib/pdf/pdf-to-images', () => ({
  getPdfPageCount: (...args: unknown[]) => mockGetPdfPageCount(...args),
}));

// --- Mock billing ---
const mockGetBillingStatus = vi.fn();

vi.mock('@/lib/billing/gate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing/gate')>();
  return {
    ...actual,
    getBillingStatus: (...args: unknown[]) => mockGetBillingStatus(...args),
  };
});

// --- Mock OpenAI ---
const mockOpenAICreate = vi.fn();

vi.mock('@/lib/ai/openai-client', () => ({
  openai: {
    embeddings: {
      create: (...args: unknown[]) => mockOpenAICreate(...args),
    },
  },
}));

// --- Import route handlers and lib functions AFTER mocks ---
import { POST as postQuestionPaper, GET as getQuestionPapers } from '@/app/api/question-papers/route';
import { POST as postMarkingScheme } from '@/app/api/marking-schemes/route';
import { POST as postEmbeddings } from '@/app/api/marking-schemes/[id]/embeddings/route';
import { POST as postBatch, GET as getBatches } from '@/app/api/batches/route';
import { POST as postSubmissions } from '@/app/api/submissions/upload/route';
import { GET as getSubmissions } from '@/app/api/batches/[id]/submissions/route';
import { POST as postDispatch } from '@/app/api/batches/[id]/dispatch/route';
import { retrieveMarkingCriteria } from '@/lib/ai/embeddings';
import { buildSystemPrompt } from '@/lib/ai/mark-paper';
import { chunkMarkingScheme } from '@/lib/ai/chunking';

// --- Helpers ---
function makePdfFile(name = 'test.pdf', size = 1024): File {
  const buffer = new Uint8Array(size);
  return new File([buffer], name, { type: 'application/pdf' });
}

function authedUser() {
  mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
}

const MARKING_SCHEME_STRUCTURE = {
  questions: [
    { no: 1, marks: 10, model_answer: 'Newton\'s second law: F = ma. Force is proportional to mass and acceleration.' },
    { no: 2, marks: 15, model_answer: 'Conservation of energy: energy cannot be created or destroyed, only transformed.' },
    { no: 3, marks: 25, model_answer: 'Electromagnetic induction occurs when a conductor moves through a magnetic field.' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageUpload.mockResolvedValue({ error: null });
});

describe('E2E: Tutor marking workflow (Phase 1–6)', () => {
  // ─── Step 1: Upload question paper ───────────────────────────
  describe('Step 1: Upload question paper', () => {
    it('creates question paper with correct tutor ownership and subject', async () => {
      authedUser();
      mockGetTutorSubjects.mockResolvedValue([{ subject_id: SUBJECT_ID }]);
      mockCreateQuestionPaper.mockResolvedValue({
        id: PAPER_ID,
        title: '2024 A/L Physics Paper I',
        year: 2024,
        subject_id: SUBJECT_ID,
        pdf_url: `${TEST_USER.id}/${PAPER_ID}/question-paper.pdf`,
      });

      const formData = new FormData();
      formData.append('file', makePdfFile());
      formData.append('title', '2024 A/L Physics Paper I');
      formData.append('subject_id', SUBJECT_ID);
      formData.append('year', '2024');

      const res = await postQuestionPaper(new Request('http://localhost/api/question-papers', {
        method: 'POST',
        body: formData,
      }));

      expect(res.status).toBe(201);
      const paper = await res.json();
      expect(paper.id).toBe(PAPER_ID);
      expect(paper.title).toBe('2024 A/L Physics Paper I');

      // Verify tutor subject ownership was checked
      expect(mockGetTutorSubjects).toHaveBeenCalledWith(TEST_USER.id);
      // Verify paper was created with tutor ID
      expect(mockCreateQuestionPaper).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorId: TEST_USER.id,
          subjectId: SUBJECT_ID,
          title: '2024 A/L Physics Paper I',
          year: 2024,
        }),
      );
      // Verify PDF was uploaded to storage
      expect(mockStorageUpload).toHaveBeenCalled();
    });

    it('rejects paper upload when subject not registered to tutor', async () => {
      authedUser();
      mockGetTutorSubjects.mockResolvedValue([{ subject_id: 'other-subject' }]);

      const formData = new FormData();
      formData.append('file', makePdfFile());
      formData.append('title', 'Physics Paper');
      formData.append('subject_id', SUBJECT_ID);

      const res = await postQuestionPaper(new Request('http://localhost/api/question-papers', {
        method: 'POST',
        body: formData,
      }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Subject not registered');
    });
  });

  // ─── Step 2: Upload marking scheme ───────────────────────────
  describe('Step 2: Upload marking scheme linked to paper', () => {
    it('creates marking scheme linked to the question paper', async () => {
      authedUser();
      mockGetQuestionPaperById.mockResolvedValue({ id: PAPER_ID, tutor_id: TEST_USER.id });
      mockCreateMarkingScheme.mockResolvedValue({
        id: SCHEME_ID,
        paper_id: PAPER_ID,
        pdf_url: `${TEST_USER.id}/${PAPER_ID}/marking-scheme.pdf`,
        embeddings_done: false,
      });

      const formData = new FormData();
      formData.append('file', makePdfFile('scheme.pdf'));
      formData.append('paper_id', PAPER_ID);

      const res = await postMarkingScheme(new Request('http://localhost/api/marking-schemes', {
        method: 'POST',
        body: formData,
      }));

      expect(res.status).toBe(201);
      const scheme = await res.json();
      expect(scheme.id).toBe(SCHEME_ID);
      expect(scheme.paper_id).toBe(PAPER_ID);
      expect(scheme.embeddings_done).toBe(false);

      // Verify paper ownership was checked
      expect(mockGetQuestionPaperById).toHaveBeenCalledWith(PAPER_ID, TEST_USER.id);
    });

    it('rejects marking scheme when paper does not belong to tutor', async () => {
      authedUser();
      mockGetQuestionPaperById.mockRejectedValue(new Error('not found'));

      const formData = new FormData();
      formData.append('file', makePdfFile());
      formData.append('paper_id', PAPER_ID);

      const res = await postMarkingScheme(new Request('http://localhost/api/marking-schemes', {
        method: 'POST',
        body: formData,
      }));

      expect(res.status).toBe(404);
    });
  });

  // ─── Step 3: Chunking logic ──────────────────────────────────
  describe('Step 3: Marking scheme chunking', () => {
    it('chunks a real 3-question physics scheme into 9 chunks', () => {
      const chunks = chunkMarkingScheme(MARKING_SCHEME_STRUCTURE);

      // 3 questions × 3 chunks each = 9
      expect(chunks).toHaveLength(9);

      // Verify each question produced all 3 chunk types
      for (const qNo of [1, 2, 3]) {
        const qChunks = chunks.filter((c) => c.question_no === qNo);
        expect(qChunks).toHaveLength(3);
        const types = qChunks.map((c) => c.chunk_type).sort();
        expect(types).toEqual(['mark_allocation', 'model_answer', 'question_criterion']);
      }

      // Verify Q3 mark allocation reflects 25 marks
      const q3Marks = chunks.find((c) => c.question_no === 3 && c.chunk_type === 'mark_allocation')!;
      expect(q3Marks.chunk_text).toBe('Question 3: Total marks: 25');
    });
  });

  // ─── Step 4: Generate embeddings ─────────────────────────────
  describe('Step 4: Generate and store embeddings', () => {
    it('generates embeddings for parsed marking scheme structure', async () => {
      authedUser();
      mockGetMarkingSchemeById.mockResolvedValue({
        id: SCHEME_ID,
        paper_id: PAPER_ID,
        structure_json: MARKING_SCHEME_STRUCTURE,
        embeddings_done: false,
      });

      // OpenAI returns 9 embeddings (3 questions × 3 chunks)
      mockOpenAICreate.mockResolvedValue({
        data: Array.from({ length: 9 }, (_, i) => ({
          index: i,
          embedding: Array.from({ length: 1536 }, (__, j) => (i + j) * 0.001),
        })),
      });
      mockDeleteEmbeddingsByScheme.mockResolvedValue(undefined);
      mockInsertEmbeddingChunks.mockResolvedValue(undefined);
      mockMarkEmbeddingsDone.mockResolvedValue(undefined);

      const res = await postEmbeddings(
        new Request('http://localhost/api/marking-schemes/test/embeddings', { method: 'POST' }),
        { params: Promise.resolve({ id: SCHEME_ID }) },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.chunks_stored).toBe(9);
      expect(body.embeddings_done).toBe(true);

      // Verify OpenAI was called with correct model and 9 chunk texts
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'text-embedding-3-small',
          input: expect.any(Array),
        }),
      );
      const inputTexts = mockOpenAICreate.mock.calls[0][0].input;
      expect(inputTexts).toHaveLength(9);
      // First chunk should be Q1 mark allocation
      expect(inputTexts[0]).toBe('Question 1: Total marks: 10');

      // Verify old embeddings were deleted first
      expect(mockDeleteEmbeddingsByScheme).toHaveBeenCalledWith(SCHEME_ID);

      // Verify 9 chunks were inserted with 1536-dim embeddings
      const insertedChunks = mockInsertEmbeddingChunks.mock.calls[0][0];
      expect(insertedChunks).toHaveLength(9);
      expect(insertedChunks[0].scheme_id).toBe(SCHEME_ID);
      expect(insertedChunks[0].embedding).toHaveLength(1536);

      // Verify embeddings_done flag was set
      expect(mockMarkEmbeddingsDone).toHaveBeenCalledWith(SCHEME_ID);
    });

    it('rejects embedding generation when structure_json not yet parsed', async () => {
      authedUser();
      mockGetMarkingSchemeById.mockResolvedValue({
        id: SCHEME_ID,
        structure_json: null,
        embeddings_done: false,
      });

      const res = await postEmbeddings(
        new Request('http://localhost/api/marking-schemes/test/embeddings', { method: 'POST' }),
        { params: Promise.resolve({ id: SCHEME_ID }) },
      );

      expect(res.status).toBe(400);
      expect(mockOpenAICreate).not.toHaveBeenCalled();
      expect(mockInsertEmbeddingChunks).not.toHaveBeenCalled();
    });
  });

  // ─── Step 5: Create batch ────────────────────────────────────
  describe('Step 5: Create marking batch', () => {
    it('creates batch linking paper, scheme, and medium', async () => {
      authedUser();
      mockGetQuestionPaperById.mockResolvedValue({ id: PAPER_ID });
      mockGetMarkingSchemeByPaper.mockResolvedValue({ id: SCHEME_ID });
      mockCreateBatch.mockResolvedValue({
        id: BATCH_ID,
        name: 'Physics 2024 - Class A',
        status: 'pending',
        medium: 'english',
        total_papers: 0,
        marked_papers: 0,
      });

      const res = await postBatch(new Request('http://localhost/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Physics 2024 - Class A',
          paper_id: PAPER_ID,
          scheme_id: SCHEME_ID,
          medium: 'english',
        }),
      }));

      expect(res.status).toBe(201);
      const batch = await res.json();
      expect(batch.status).toBe('pending');

      // Verify paper ownership and scheme linkage were checked
      expect(mockGetQuestionPaperById).toHaveBeenCalledWith(PAPER_ID, TEST_USER.id);
      expect(mockGetMarkingSchemeByPaper).toHaveBeenCalledWith(PAPER_ID);

      // Verify batch was created with correct data
      expect(mockCreateBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorId: TEST_USER.id,
          paperId: PAPER_ID,
          schemeId: SCHEME_ID,
          name: 'Physics 2024 - Class A',
          medium: 'english',
        }),
      );
    });

    it('rejects batch when scheme does not belong to paper', async () => {
      authedUser();
      mockGetQuestionPaperById.mockResolvedValue({ id: PAPER_ID });
      mockGetMarkingSchemeByPaper.mockResolvedValue({ id: 'different-scheme-id' });

      const res = await postBatch(new Request('http://localhost/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Batch',
          paper_id: PAPER_ID,
          scheme_id: SCHEME_ID,
          medium: 'english',
        }),
      }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('does not belong');
    });
  });

  // ─── Step 6: Upload student submissions ──────────────────────
  describe('Step 6: Upload student submissions', () => {
    it('uploads student papers to a pending batch', async () => {
      authedUser();
      mockGetBatchById.mockResolvedValue({
        id: BATCH_ID,
        status: 'pending',
        total_papers: 0,
      });
      mockGetPdfPageCount.mockResolvedValue(4);
      mockCreateStudentAndSubmission.mockResolvedValue({
        id: SUBMISSION_ID,
        student_id: STUDENT_ID,
        pdf_url: `${TEST_USER.id}/${BATCH_ID}/${STUDENT_ID}.pdf`,
        page_count: 4,
        status: 'pending',
      });
      mockUpdateBatchPaperCount.mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append('metadata', JSON.stringify({
        batch_id: BATCH_ID,
        files: [
          { student_name: 'Kasun Perera', index_no: '12345' },
        ],
      }));
      formData.append('files', makePdfFile('kasun.pdf'));

      const res = await postSubmissions(new Request('http://localhost/api/submissions/upload', {
        method: 'POST',
        body: formData,
      }));

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.submissions).toHaveLength(1);
      expect(body.submissions[0].page_count).toBe(4);

      // Verify batch ownership was checked
      expect(mockGetBatchById).toHaveBeenCalledWith(BATCH_ID, TEST_USER.id);
      // Verify PDF was uploaded to storage
      expect(mockStorageUpload).toHaveBeenCalled();
      // Verify page count was extracted
      expect(mockGetPdfPageCount).toHaveBeenCalled();
      // Verify batch paper count was updated
      expect(mockUpdateBatchPaperCount).toHaveBeenCalledWith(BATCH_ID, 1);
    });

    it('rejects upload to a batch that is already processing', async () => {
      authedUser();
      mockGetBatchById.mockResolvedValue({
        id: BATCH_ID,
        status: 'processing',
        total_papers: 5,
      });

      const formData = new FormData();
      formData.append('metadata', JSON.stringify({
        batch_id: BATCH_ID,
        files: [{ student_name: 'Test' }],
      }));
      formData.append('files', makePdfFile());

      const res = await postSubmissions(new Request('http://localhost/api/submissions/upload', {
        method: 'POST',
        body: formData,
      }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('processing');
    });
  });

  // ─── Step 6.5: List submissions for a batch ─────────────────
  describe('Step 6.5: List submissions for a batch', () => {
    it('returns submissions for an owned batch', async () => {
      authedUser();
      mockGetBatchById.mockResolvedValue({ id: BATCH_ID, status: 'pending' });
      mockGetSubmissionsByBatch.mockResolvedValue([
        {
          id: SUBMISSION_ID,
          student_id: STUDENT_ID,
          pdf_url: `${TEST_USER.id}/${BATCH_ID}/${STUDENT_ID}.pdf`,
          page_count: 4,
          status: 'pending',
          created_at: '2026-03-22T00:00:00Z',
          students: { name: 'Kasun Perera', index_no: '12345' },
        },
      ]);

      const res = await getSubmissions(
        new Request('http://localhost/api/batches/test/submissions'),
        { params: Promise.resolve({ id: BATCH_ID }) },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      // Verify response shape matches useSubmissions Submission interface
      expect(body[0]).toEqual(expect.objectContaining({
        id: SUBMISSION_ID,
        student_id: STUDENT_ID,
        pdf_url: expect.stringContaining(BATCH_ID),
        page_count: 4,
        status: 'pending',
        created_at: expect.any(String),
        students: { name: 'Kasun Perera', index_no: '12345' },
      }));
      // Verify ownership was checked with correct user
      expect(mockGetBatchById).toHaveBeenCalledWith(BATCH_ID, TEST_USER.id);
      expect(mockGetSubmissionsByBatch).toHaveBeenCalledWith(BATCH_ID);
    });

    it('returns 404 when batch belongs to different tutor', async () => {
      authedUser();
      mockGetBatchById.mockRejectedValue(new Error('not found'));

      const res = await getSubmissions(
        new Request('http://localhost/api/batches/test/submissions'),
        { params: Promise.resolve({ id: BATCH_ID }) },
      );

      expect(res.status).toBe(404);
      // Submissions should never be fetched if ownership fails
      expect(mockGetSubmissionsByBatch).not.toHaveBeenCalled();
    });

    it('returns consistent data shape after upload step', async () => {
      // Simulate: after Step 6 uploaded a submission, listing should return matching IDs
      authedUser();
      mockGetBatchById.mockResolvedValue({ id: BATCH_ID, status: 'pending' });
      mockGetSubmissionsByBatch.mockResolvedValue([
        {
          id: SUBMISSION_ID,
          student_id: STUDENT_ID,
          pdf_url: `${TEST_USER.id}/${BATCH_ID}/${STUDENT_ID}.pdf`,
          page_count: 4,
          status: 'pending',
          created_at: '2026-03-22T00:00:00Z',
          students: { name: 'Kasun Perera', index_no: '12345' },
        },
      ]);

      const res = await getSubmissions(
        new Request('http://localhost/api/batches/test/submissions'),
        { params: Promise.resolve({ id: BATCH_ID }) },
      );

      const body = await res.json();
      // The submission ID and student ID from listing must match what upload created
      expect(body[0].id).toBe(SUBMISSION_ID);
      expect(body[0].student_id).toBe(STUDENT_ID);
      // pdf_url must contain the batch path used during upload
      expect(body[0].pdf_url).toContain(BATCH_ID);
    });
  });

  // ─── Step 7: Billing gate on dispatch ────────────────────────
  describe('Step 7: Billing gate blocks dispatch when inactive', () => {
    it('returns 402 when subscription is past_due', async () => {
      authedUser();
      mockGetBillingStatus.mockResolvedValue({
        plan: 'standard',
        ai_minutes_used: 0,
        ai_minutes_limit: 150,
        subscription_status: 'past_due',
        billing_period_end: '2026-04-01',
      });

      const res = await postDispatch(
        new Request('http://localhost/api/batches/test/dispatch', { method: 'POST' }),
        { params: Promise.resolve({ id: BATCH_ID }) },
      );

      expect(res.status).toBe(402);
      const body = await res.json();
      expect(body.error).toBe('subscription_inactive');
    });

    it('returns 402 when subscription is canceled', async () => {
      authedUser();
      mockGetBillingStatus.mockResolvedValue({
        plan: 'free',
        ai_minutes_used: 10,
        ai_minutes_limit: 10,
        subscription_status: 'canceled',
        billing_period_end: null,
      });

      const res = await postDispatch(
        new Request('http://localhost/api/batches/test/dispatch', { method: 'POST' }),
        { params: Promise.resolve({ id: BATCH_ID }) },
      );

      expect(res.status).toBe(402);
    });
  });

  // ─── Step 8: RAG retrieval ───────────────────────────────────
  describe('Step 8: Retrieve marking criteria via RAG', () => {
    it('retrieves relevant chunks for a question query', async () => {
      mockOpenAICreate.mockResolvedValue({
        data: [{ index: 0, embedding: [0.5, 0.6, 0.7] }],
      });
      mockMatchMarkingCriteria.mockResolvedValue([
        { id: 'emb-1', chunk_text: 'Question 1 model answer: Newton\'s second law: F = ma.', chunk_type: 'model_answer', question_no: 1, similarity: 0.95 },
        { id: 'emb-2', chunk_text: 'Question 1 (10 marks): Expected answer: Newton\'s second law', chunk_type: 'question_criterion', question_no: 1, similarity: 0.88 },
      ]);

      const results = await retrieveMarkingCriteria(SCHEME_ID, 'Explain F=ma with an example');

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.95);
      expect(results[0].chunk_type).toBe('model_answer');

      // Verify embedding was generated for the query text
      expect(mockOpenAICreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['Explain F=ma with an example'],
      });

      // Verify RPC was called with correct scheme and default match count
      expect(mockMatchMarkingCriteria).toHaveBeenCalledWith(
        SCHEME_ID,
        [0.5, 0.6, 0.7],
        5, // default matchCount
      );
    });

    it('returns empty array when no relevant chunks found', async () => {
      mockOpenAICreate.mockResolvedValue({
        data: [{ index: 0, embedding: [0.1] }],
      });
      mockMatchMarkingCriteria.mockResolvedValue([]);

      const results = await retrieveMarkingCriteria(SCHEME_ID, 'completely unrelated query');

      expect(results).toEqual([]);
    });
  });

  // ─── Step 9: System prompt with RAG context ──────────────────
  describe('Step 9: System prompt includes RAG-retrieved marking criteria', () => {
    it('builds correct prompt with subject, language, and scheme text', () => {
      // Simulate what batch-dispatcher will do: retrieve chunks, build scheme text, build prompt
      const retrievedChunks = [
        'Question 1 model answer: F = ma. Force is proportional to mass and acceleration.',
        'Question 1 (10 marks): Expected answer: Newton\'s second law',
        'Question 2 model answer: Conservation of energy: energy cannot be created or destroyed.',
      ];
      const markingSchemeText = retrievedChunks.join('\n\n');

      const prompt = buildSystemPrompt('Physics', 'sinhala', markingSchemeText);

      // Verify prompt contains all critical parts
      expect(prompt).toContain('expert Sri Lankan A/L Physics examiner');
      expect(prompt).toContain('සිංහල'); // Sinhala script in language instruction
      expect(prompt).toContain('F = ma'); // RAG-retrieved content
      expect(prompt).toContain('Conservation of energy'); // RAG-retrieved content
      expect(prompt).toContain('"question_no"'); // JSON output schema
      expect(prompt).toContain('"awarded_marks"'); // JSON output schema
    });

    it('uses English instructions for English medium', () => {
      const prompt = buildSystemPrompt('Chemistry', 'english', 'Test scheme text');

      expect(prompt).toContain('Generate ALL feedback in English');
      expect(prompt).not.toContain('සිංහල');
      expect(prompt).not.toContain('தமிழ்');
    });

    it('uses Tamil instructions for Tamil medium', () => {
      const prompt = buildSystemPrompt('Biology', 'tamil', 'Test scheme text');

      expect(prompt).toContain('தமிழ்'); // Tamil script
      expect(prompt).toContain('Tamil script');
    });
  });

  // ─── Cross-cutting: Auth enforcement ─────────────────────────
  describe('Cross-cutting: All routes reject unauthenticated requests', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it('GET /api/question-papers returns 401', async () => {
      const res = await getQuestionPapers();
      expect(res.status).toBe(401);
    });

    it('POST /api/question-papers returns 401', async () => {
      const formData = new FormData();
      formData.append('file', makePdfFile());
      formData.append('title', 'Test');
      formData.append('subject_id', SUBJECT_ID);
      const res = await postQuestionPaper(new Request('http://localhost/test', { method: 'POST', body: formData }));
      expect(res.status).toBe(401);
    });

    it('POST /api/marking-schemes returns 401', async () => {
      const formData = new FormData();
      formData.append('file', makePdfFile());
      formData.append('paper_id', PAPER_ID);
      const res = await postMarkingScheme(new Request('http://localhost/test', { method: 'POST', body: formData }));
      expect(res.status).toBe(401);
    });

    it('POST /api/marking-schemes/[id]/embeddings returns 401', async () => {
      const res = await postEmbeddings(
        new Request('http://localhost/test', { method: 'POST' }),
        { params: Promise.resolve({ id: SCHEME_ID }) },
      );
      expect(res.status).toBe(401);
    });

    it('POST /api/batches returns 401', async () => {
      const res = await postBatch(new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x', paper_id: PAPER_ID, scheme_id: SCHEME_ID, medium: 'english' }),
      }));
      expect(res.status).toBe(401);
    });

    it('GET /api/batches returns 401', async () => {
      const res = await getBatches();
      expect(res.status).toBe(401);
    });

    it('POST /api/submissions/upload returns 401', async () => {
      const formData = new FormData();
      formData.append('metadata', JSON.stringify({ batch_id: BATCH_ID, files: [{ student_name: 'x' }] }));
      formData.append('files', makePdfFile());
      const res = await postSubmissions(new Request('http://localhost/test', { method: 'POST', body: formData }));
      expect(res.status).toBe(401);
    });

    it('POST /api/batches/[id]/dispatch returns 401', async () => {
      const res = await postDispatch(
        new Request('http://localhost/test', { method: 'POST' }),
        { params: Promise.resolve({ id: BATCH_ID }) },
      );
      expect(res.status).toBe(401);
    });

    it('GET /api/batches/[id]/submissions returns 401', async () => {
      const res = await getSubmissions(
        new Request('http://localhost/test'),
        { params: Promise.resolve({ id: BATCH_ID }) },
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── Cross-cutting: Data flows correctly between steps ───────
  describe('Cross-cutting: Paper → Scheme → Embeddings data integrity', () => {
    it('scheme references the correct paper_id from step 1', async () => {
      authedUser();
      mockGetQuestionPaperById.mockResolvedValue({ id: PAPER_ID, tutor_id: TEST_USER.id });
      mockCreateMarkingScheme.mockResolvedValue({
        id: SCHEME_ID,
        paper_id: PAPER_ID,
      });

      const formData = new FormData();
      formData.append('file', makePdfFile());
      formData.append('paper_id', PAPER_ID);

      await postMarkingScheme(new Request('http://localhost/test', { method: 'POST', body: formData }));

      // The paper_id passed to createMarkingScheme must match the paper from step 1
      expect(mockCreateMarkingScheme).toHaveBeenCalledWith({
        paperId: PAPER_ID,
        pdfUrl: expect.stringContaining(PAPER_ID),
      });
    });

    it('embeddings endpoint uses the scheme_id and structure_json together', async () => {
      authedUser();
      mockGetMarkingSchemeById.mockResolvedValue({
        id: SCHEME_ID,
        paper_id: PAPER_ID,
        structure_json: MARKING_SCHEME_STRUCTURE,
      });
      mockOpenAICreate.mockResolvedValue({
        data: Array.from({ length: 9 }, (_, i) => ({ index: i, embedding: [i * 0.1] })),
      });
      mockDeleteEmbeddingsByScheme.mockResolvedValue(undefined);
      mockInsertEmbeddingChunks.mockResolvedValue(undefined);
      mockMarkEmbeddingsDone.mockResolvedValue(undefined);

      await postEmbeddings(
        new Request('http://localhost/test', { method: 'POST' }),
        { params: Promise.resolve({ id: SCHEME_ID }) },
      );

      // All inserted chunks must reference SCHEME_ID
      const insertedChunks = mockInsertEmbeddingChunks.mock.calls[0][0];
      for (const chunk of insertedChunks) {
        expect(chunk.scheme_id).toBe(SCHEME_ID);
      }

      // embeddings_done marked for SCHEME_ID
      expect(mockMarkEmbeddingsDone).toHaveBeenCalledWith(SCHEME_ID);
    });

    it('batch creation validates scheme belongs to the specific paper', async () => {
      authedUser();
      mockGetQuestionPaperById.mockResolvedValue({ id: PAPER_ID });
      // Scheme for this paper has a DIFFERENT id
      mockGetMarkingSchemeByPaper.mockResolvedValue({ id: 'wrong-scheme-id' });

      const res = await postBatch(new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          paper_id: PAPER_ID,
          scheme_id: SCHEME_ID, // doesn't match
          medium: 'english',
        }),
      }));

      expect(res.status).toBe(400);
    });
  });
});
