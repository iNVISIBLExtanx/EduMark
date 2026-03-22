import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockGetSubmissionById = vi.fn();
vi.mock('@/lib/db/submissions', () => ({
  getSubmissionById: (...args: unknown[]) => mockGetSubmissionById(...args),
}));

const mockGetBatchById = vi.fn();
vi.mock('@/lib/db/batches', () => ({
  getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
}));

const mockApproveReport = vi.fn();
vi.mock('@/lib/db/reports', () => ({
  approveReport: (...args: unknown[]) => mockApproveReport(...args),
}));

import { POST } from '@/app/api/reports/[id]/approve/route';

const TEST_USER = { id: 'user-1', email: 'test@test.com' };
const SUBMISSION_ID = 'sub-1';
const BATCH_ID = 'batch-1';

const MOCK_SUBMISSION = {
  id: SUBMISSION_ID,
  batch_id: BATCH_ID,
  status: 'marked',
  students: { name: 'John Doe', index_no: '12345' },
};

const MOCK_BATCH = {
  id: BATCH_ID,
  tutor_id: TEST_USER.id,
  paper_id: 'paper-1',
  medium: 'english',
};

function makeRequest() {
  return new Request('http://localhost/api/reports/sub-1/approve', { method: 'POST' });
}

function makeParams() {
  return { params: Promise.resolve({ id: SUBMISSION_ID }) };
}

describe('POST /api/reports/[id]/approve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when submission not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockRejectedValue(new Error('not_found'));
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Submission not found');
  });

  it('returns 400 when submission not marked', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue({ ...MOCK_SUBMISSION, status: 'pending' });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('submission_not_marked');
  });

  it('returns 404 when batch ownership fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockRejectedValue(new Error('batch_not_found'));
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Batch not found');
  });

  it('returns 200 and calls approveReport on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockResolvedValue(MOCK_BATCH);
    mockApproveReport.mockResolvedValue(undefined);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(mockApproveReport).toHaveBeenCalled();
  });

  it('passes correct submissionId to approveReport', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockResolvedValue(MOCK_BATCH);
    mockApproveReport.mockResolvedValue(undefined);
    await POST(makeRequest(), makeParams());
    expect(mockApproveReport).toHaveBeenCalledWith(SUBMISSION_ID);
  });

  it('returns { approved: true } body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockResolvedValue(MOCK_BATCH);
    mockApproveReport.mockResolvedValue(undefined);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body).toEqual({ approved: true });
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockResolvedValue(MOCK_BATCH);
    mockApproveReport.mockRejectedValue(new Error('unexpected'));
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
