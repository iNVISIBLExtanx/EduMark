import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockGetBillingStatus = vi.fn();

vi.mock('@/lib/billing/gate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing/gate')>();
  return {
    ...actual,
    getBillingStatus: (...args: unknown[]) => mockGetBillingStatus(...args),
  };
});

const mockGetBatchById = vi.fn();
const mockUpdateBatchPaperName = vi.fn();
vi.mock('@/lib/db/batches', () => ({
  getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
  updateBatchPaperName: (...args: unknown[]) => mockUpdateBatchPaperName(...args),
}));

const mockPrepareMarking = vi.fn();
const mockExecuteMarking = vi.fn();
vi.mock('@/lib/ai/batch-dispatcher', () => ({
  prepareMarking: (...args: unknown[]) => mockPrepareMarking(...args),
  executeMarking: (...args: unknown[]) => mockExecuteMarking(...args),
}));

// Import AFTER mocks
import { POST } from '@/app/api/batches/[id]/dispatch/route';

const TEST_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'tutor@test.lk' };
const BATCH_ID = '00000000-0000-4000-8000-000000000040';

function makeRequest() {
  return new Request('http://localhost/api/batches/test/dispatch', { method: 'POST' });
}

function makeParams() {
  return { params: Promise.resolve({ id: BATCH_ID }) };
}

function activeBilling(overrides: Record<string, unknown> = {}) {
  return {
    plan: 'standard',
    ai_minutes_used: 10,
    ai_minutes_limit: 150,
    subscription_status: 'active',
    billing_period_end: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: BATCH_ID,
    name: 'Test Batch',
    status: 'pending',
    total_papers: 5,
    marked_papers: 0,
    ...overrides,
  };
}

describe('POST /api/batches/[id]/dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default happy-path mocks
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBillingStatus.mockResolvedValue(activeBilling());
    mockGetBatchById.mockResolvedValue(makeBatch());
    mockPrepareMarking.mockResolvedValue({
      batch: makeBatch(),
      pendingSubmissions: [{ id: 'sub-1', pdf_url: 'test.pdf' }],
      systemPromptText: 'system prompt',
      subject: 'Physics',
      paperName: undefined,
    });
    mockUpdateBatchPaperName.mockResolvedValue(undefined);
    mockExecuteMarking.mockResolvedValue('direct');
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockGetBillingStatus).not.toHaveBeenCalled();
  });

  it('returns 402 when subscription is past_due', async () => {
    mockGetBillingStatus.mockResolvedValue(activeBilling({ subscription_status: 'past_due' }));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe('subscription_inactive');
  });

  it('returns 402 when subscription is canceled', async () => {
    mockGetBillingStatus.mockResolvedValue(activeBilling({ subscription_status: 'canceled' }));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe('subscription_inactive');
  });

  it('returns 404 when batch not found', async () => {
    mockGetBatchById.mockRejectedValue(new Error('Not found'));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Batch not found');
  });

  it('returns 400 when batch has 0 total_papers', async () => {
    mockGetBatchById.mockResolvedValue(makeBatch({ total_papers: 0 }));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Batch has no submissions');
  });

  it('returns 402 with available/needed when insufficient AI minutes', async () => {
    mockGetBillingStatus.mockResolvedValue(activeBilling({
      ai_minutes_used: 148,
      ai_minutes_limit: 150,
    }));
    mockGetBatchById.mockResolvedValue(makeBatch({ total_papers: 5 }));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe('insufficient_ai_minutes');
    expect(body.available).toBe(2);
    expect(body.needed).toBe(5);
  });

  it('returns 402 with correct available minutes in response body', async () => {
    mockGetBillingStatus.mockResolvedValue(activeBilling({
      ai_minutes_used: 50,
      ai_minutes_limit: 50,
    }));
    mockGetBatchById.mockResolvedValue(makeBatch({ total_papers: 1 }));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.available).toBe(0);
    expect(body.needed).toBe(1);
  });

  it('returns 200 with processing status on successful dispatch', async () => {
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('processing');
  });

  it('calls prepareMarking with correct batchId and userId', async () => {
    await POST(makeRequest(), makeParams());

    expect(mockPrepareMarking).toHaveBeenCalledOnce();
    expect(mockPrepareMarking).toHaveBeenCalledWith(BATCH_ID, TEST_USER.id);
  });

  it('calls executeMarking with batch context from prepareMarking', async () => {
    await POST(makeRequest(), makeParams());

    expect(mockExecuteMarking).toHaveBeenCalledWith(
      BATCH_ID,
      [{ id: 'sub-1', pdf_url: 'test.pdf' }],
      'system prompt',
      'Physics',
      undefined,
    );
  });

  it('stores paper_name on batch when provided in body', async () => {
    const req = new Request('http://localhost/api/batches/test/dispatch', {
      method: 'POST',
      body: JSON.stringify({ paper_name: 'Pure (Paper I)' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req, makeParams());

    expect(mockUpdateBatchPaperName).toHaveBeenCalledWith(BATCH_ID, TEST_USER.id, 'Pure (Paper I)');
  });

  it('does not call updateBatchPaperName when paper_name not in body', async () => {
    await POST(makeRequest(), makeParams());

    expect(mockUpdateBatchPaperName).not.toHaveBeenCalled();
  });

  it('returns 400 when prepareMarking throws no_pending_submissions', async () => {
    mockPrepareMarking.mockRejectedValue(new Error('no_pending_submissions'));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No pending submissions in batch');
  });

  it('returns 500 when prepareMarking throws unexpected error', async () => {
    mockPrepareMarking.mockRejectedValue(new Error('claude_api_timeout'));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('claude_api_timeout');
  });

  it('checks billing status before batch lookup', async () => {
    mockGetBillingStatus.mockResolvedValue(activeBilling({ subscription_status: 'past_due' }));

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(402);
    expect(mockGetBillingStatus).toHaveBeenCalledWith(TEST_USER.id);
    expect(mockGetBatchById).not.toHaveBeenCalled();
  });

  it('passes batchId from route params to getBatchById', async () => {
    await POST(makeRequest(), makeParams());

    expect(mockGetBatchById).toHaveBeenCalledWith(BATCH_ID, TEST_USER.id);
  });

  it('returns 400 when batch is already dispatched', async () => {
    mockGetBatchById.mockResolvedValue(makeBatch({ status: 'processing' }));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('batch_already_dispatched');
    expect(mockPrepareMarking).not.toHaveBeenCalled();
  });

  it('returns 200 even if executeMarking fails (fire-and-forget)', async () => {
    mockExecuteMarking.mockRejectedValue(new Error('Background failure'));

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('processing');
  });
});
