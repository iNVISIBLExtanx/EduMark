import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockGetBatchById = vi.fn();
vi.mock('@/lib/db/batches', () => ({
  getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
}));

const mockGetSubmissionsByBatch = vi.fn();
vi.mock('@/lib/db/submissions', () => ({
  getSubmissionsByBatch: (...args: unknown[]) => mockGetSubmissionsByBatch(...args),
}));

import { GET } from '@/app/api/batches/[id]/submissions/route';

const TEST_USER = { id: 'user-1', email: 'test@test.com' };
const BATCH_ID = 'batch-1';

function makeRequest() {
  return new Request('http://localhost/api/batches/batch-1/submissions');
}

function makeParams() {
  return { params: Promise.resolve({ id: BATCH_ID }) };
}

describe('GET /api/batches/[id]/submissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when batch not found or not owned', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockRejectedValue(new Error('not found'));

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('returns 200 with empty array when no submissions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });
    mockGetSubmissionsByBatch.mockResolvedValue([]);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 200 with submissions including nested students data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });

    const submissions = [
      {
        id: 'sub-1',
        student_id: 'st-1',
        pdf_url: 'user-1/batch-1/st-1.pdf',
        page_count: 4,
        status: 'pending',
        created_at: '2026-03-22T00:00:00Z',
        students: { name: 'Kasun Perera', index_no: '12345' },
      },
      {
        id: 'sub-2',
        student_id: 'st-2',
        pdf_url: 'user-1/batch-1/st-2.pdf',
        page_count: 3,
        status: 'pending',
        created_at: '2026-03-22T00:00:00Z',
        students: { name: 'Dilshan Silva', index_no: null },
      },
    ];
    mockGetSubmissionsByBatch.mockResolvedValue(submissions);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(2);
    // Verify shape matches useSubmissions interface
    expect(body[0]).toEqual(expect.objectContaining({
      id: 'sub-1',
      student_id: 'st-1',
      pdf_url: expect.any(String),
      page_count: 4,
      status: 'pending',
      created_at: expect.any(String),
      students: { name: 'Kasun Perera', index_no: '12345' },
    }));
    expect(body[1].students.index_no).toBeNull();
  });

  it('returns 500 when getSubmissionsByBatch throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });
    mockGetSubmissionsByBatch.mockRejectedValue(new Error('db error'));

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  it('passes correct arguments to getBatchById and getSubmissionsByBatch', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });
    mockGetSubmissionsByBatch.mockResolvedValue([]);

    await GET(makeRequest(), makeParams());

    expect(mockGetBatchById).toHaveBeenCalledWith(BATCH_ID, TEST_USER.id);
    expect(mockGetSubmissionsByBatch).toHaveBeenCalledWith(BATCH_ID);
  });
});
