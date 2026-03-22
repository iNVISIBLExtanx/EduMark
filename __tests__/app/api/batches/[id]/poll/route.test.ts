import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockPollBatchResults = vi.fn();
vi.mock('@/lib/ai/batch-dispatcher', () => ({
  pollBatchResults: (...args: unknown[]) => mockPollBatchResults(...args),
}));

// Import AFTER mocks
import { GET } from '@/app/api/batches/[id]/poll/route';

const TEST_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'tutor@test.lk' };
const BATCH_ID = '00000000-0000-4000-8000-000000000040';

function makeRequest() {
  return new Request('http://localhost/api/batches/test/poll');
}

function makeParams() {
  return { params: Promise.resolve({ id: BATCH_ID }) };
}

describe('GET /api/batches/[id]/poll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 with processing status when batch is still processing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockPollBatchResults.mockResolvedValue({
      status: 'processing',
      marked: 3,
      total: 10,
    });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('processing');
    expect(body.marked).toBe(3);
    expect(body.total).toBe(10);
  });

  it('returns 200 with completed status and marked count', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockPollBatchResults.mockResolvedValue({
      status: 'completed',
      marked: 10,
      total: 10,
    });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('completed');
    expect(body.marked).toBe(10);
    expect(body.total).toBe(10);
  });

  it('returns 400 when batch has not been dispatched', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockPollBatchResults.mockRejectedValue(new Error('batch_not_dispatched'));

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Batch has not been dispatched yet');
  });

  it('returns 404 when batch not found or not owned', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockPollBatchResults.mockRejectedValue(new Error('batch_not_found'));

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Batch not found');
  });

  it('passes correct batchId and userId to pollBatchResults', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockPollBatchResults.mockResolvedValue({ status: 'processing', marked: 0, total: 5 });

    await GET(makeRequest(), makeParams());

    expect(mockPollBatchResults).toHaveBeenCalledOnce();
    expect(mockPollBatchResults).toHaveBeenCalledWith(BATCH_ID, TEST_USER.id);
  });

  it('returns 200 with failed status when all results failed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockPollBatchResults.mockResolvedValue({
      status: 'failed',
      marked: 0,
      total: 5,
    });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('failed');
    expect(body.marked).toBe(0);
    expect(body.total).toBe(5);
  });

  it('returns 404 for non-Error thrown exceptions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    // When a non-Error is thrown, message defaults to 'poll_failed' which hits the 404 branch
    mockPollBatchResults.mockRejectedValue('some string error');

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Batch not found');
  });
});
