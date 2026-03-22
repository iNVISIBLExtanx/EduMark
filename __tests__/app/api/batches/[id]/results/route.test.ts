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

const mockGetMarkingResultsByBatch = vi.fn();
vi.mock('@/lib/db/marking-results', () => ({
  getMarkingResultsByBatch: (...args: unknown[]) => mockGetMarkingResultsByBatch(...args),
}));

import { GET } from '@/app/api/batches/[id]/results/route';

const TEST_USER = { id: 'user-1', email: 'test@test.com' };
const BATCH_ID = 'batch-1';

function makeRequest() {
  return new Request('http://localhost/api/batches/batch-1/results');
}

function makeParams() {
  return { params: Promise.resolve({ id: BATCH_ID }) };
}

describe('GET /api/batches/[id]/results', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when batch not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockRejectedValue(new Error('batch_not_found'));
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns marking results on success', async () => {
    const mockResults = [
      { id: 'r1', submission_id: 's1', question_no: 1, awarded_marks: 8, max_marks: 10 },
    ];
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID, tutor_id: TEST_USER.id });
    mockGetMarkingResultsByBatch.mockResolvedValue(mockResults);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResults);
  });

  it('verifies batch ownership', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });
    mockGetMarkingResultsByBatch.mockResolvedValue([]);
    await GET(makeRequest(), makeParams());
    expect(mockGetBatchById).toHaveBeenCalledWith(BATCH_ID, TEST_USER.id);
  });

  it('returns empty array for batch with no results', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });
    mockGetMarkingResultsByBatch.mockResolvedValue([]);
    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });
    mockGetMarkingResultsByBatch.mockRejectedValue(new Error('db_error'));
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  it('calls getMarkingResultsByBatch with the batchId from params', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });
    mockGetMarkingResultsByBatch.mockResolvedValue([]);
    await GET(makeRequest(), makeParams());
    expect(mockGetMarkingResultsByBatch).toHaveBeenCalledWith(BATCH_ID);
  });

  it('returns response with JSON content type', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID });
    mockGetMarkingResultsByBatch.mockResolvedValue([{ id: 'r1' }]);
    const res = await GET(makeRequest(), makeParams());
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
