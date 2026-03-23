import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_USER = { id: 'user-123', email: 'tutor@example.com' };
const PAPER_ID = '550e8400-e29b-41d4-a716-446655440000';

// --- Supabase mock (custom: async createServerClient + storage.remove) ---
const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  storage: {
    from: vi.fn().mockReturnValue({
      remove: mockRemove,
    }),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => Promise.resolve(mockSupabaseClient),
}));

// --- DB mocks ---
const mockGetQuestionPaperById = vi.fn();
const mockGetBatchCountByPaper = vi.fn();
const mockDeleteQuestionPaper = vi.fn();

vi.mock('@/lib/db/question-papers', () => ({
  getQuestionPaperById: (...args: unknown[]) => mockGetQuestionPaperById(...args),
  getBatchCountByPaper: (...args: unknown[]) => mockGetBatchCountByPaper(...args),
  deleteQuestionPaper: (...args: unknown[]) => mockDeleteQuestionPaper(...args),
}));

const mockDeleteMarkingSchemeByPaper = vi.fn();

vi.mock('@/lib/db/marking-schemes', () => ({
  deleteMarkingSchemeByPaper: (...args: unknown[]) => mockDeleteMarkingSchemeByPaper(...args),
}));

function makeRequest(): Request {
  return new Request('http://localhost/api/question-papers/' + PAPER_ID, {
    method: 'DELETE',
  });
}

async function callDelete() {
  const { DELETE } = await import('@/app/api/question-papers/[id]/route');
  return DELETE(
    makeRequest(),
    { params: Promise.resolve({ id: PAPER_ID }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish mock chains after clearAllMocks
  mockSupabaseClient.storage.from.mockReturnValue({ remove: mockRemove });
  mockRemove.mockResolvedValue({ data: null, error: null });
});

describe('DELETE /api/question-papers/[id]', () => {
  it('returns 401 for unauthenticated request', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const res = await callDelete();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when paper not found', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
    });
    mockGetQuestionPaperById.mockRejectedValue(new Error('not_found'));

    const res = await callDelete();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Question paper not found');
  });

  it('returns 409 when paper has batches', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
    });
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      pdf_url: 'papers/test.pdf',
    });
    mockGetBatchCountByPaper.mockResolvedValue(3);

    const res = await callDelete();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('Cannot delete');
    expect(body.error).toContain('batches');
  });

  it('returns 200 on successful delete with marking scheme', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
    });
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      pdf_url: 'papers/test.pdf',
    });
    mockGetBatchCountByPaper.mockResolvedValue(0);
    mockDeleteMarkingSchemeByPaper.mockResolvedValue({
      id: 'scheme-1',
      pdf_url: 'schemes/scheme.pdf',
    });
    mockDeleteQuestionPaper.mockResolvedValue(undefined);

    const res = await callDelete();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    // Verify all cleanup steps were called
    expect(mockDeleteMarkingSchemeByPaper).toHaveBeenCalledWith(PAPER_ID);
    expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('marking-schemes');
    expect(mockRemove).toHaveBeenCalledWith(['papers/test.pdf', 'schemes/scheme.pdf']);
    expect(mockDeleteQuestionPaper).toHaveBeenCalledWith(PAPER_ID, TEST_USER.id);
  });

  it('returns 200 when marking scheme does not exist (null)', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
    });
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      pdf_url: 'papers/test.pdf',
    });
    mockGetBatchCountByPaper.mockResolvedValue(0);
    mockDeleteMarkingSchemeByPaper.mockResolvedValue(null);
    mockDeleteQuestionPaper.mockResolvedValue(undefined);

    const res = await callDelete();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    // Storage remove should only include the paper PDF (no scheme)
    expect(mockRemove).toHaveBeenCalledWith(['papers/test.pdf']);
    expect(mockDeleteQuestionPaper).toHaveBeenCalledWith(PAPER_ID, TEST_USER.id);
  });

  it('returns 500 when deleteQuestionPaper throws', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
    });
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      pdf_url: 'papers/test.pdf',
    });
    mockGetBatchCountByPaper.mockResolvedValue(0);
    mockDeleteMarkingSchemeByPaper.mockResolvedValue(null);
    mockDeleteQuestionPaper.mockRejectedValue(new Error('DB delete failed'));

    const res = await callDelete();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('DB delete failed');
  });

  it('returns 500 when getBatchCountByPaper throws', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
    });
    mockGetQuestionPaperById.mockResolvedValue({
      id: PAPER_ID,
      pdf_url: 'papers/test.pdf',
    });
    mockGetBatchCountByPaper.mockRejectedValue(new Error('DB error'));

    const res = await callDelete();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to check batches');
  });
});
