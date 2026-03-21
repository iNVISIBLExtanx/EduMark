import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from './route';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockGetBatches = vi.fn();
const mockCreateBatch = vi.fn();
vi.mock('@/lib/db/batches', () => ({
  getBatchesByTutor: (...args: unknown[]) => mockGetBatches(...args),
  getBatchById: vi.fn(),
  createBatch: (...args: unknown[]) => mockCreateBatch(...args),
  updateBatchStatus: vi.fn(),
}));

const mockGetPaperById = vi.fn();
vi.mock('@/lib/db/question-papers', () => ({
  getQuestionPaperById: (...args: unknown[]) => mockGetPaperById(...args),
}));

const mockGetSchemeByPaper = vi.fn();
vi.mock('@/lib/db/marking-schemes', () => ({
  getMarkingSchemeByPaper: (...args: unknown[]) => mockGetSchemeByPaper(...args),
}));

const TEST_USER = { id: 'user-1', email: 'test@test.com' };

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Batch',
    paper_id: '550e8400-e29b-41d4-a716-446655440000',
    scheme_id: '660e8400-e29b-41d4-a716-446655440000',
    medium: 'english',
    ...overrides,
  };
}

describe('GET /api/batches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns batches on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const batches = [{ id: '1', name: 'Batch A' }];
    mockGetBatches.mockResolvedValue(batches);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(batches);
  });
});

describe('POST /api/batches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new Request('http://localhost/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid input', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const req = new Request('http://localhost/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when paper not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetPaperById.mockRejectedValue(new Error('not found'));

    const req = new Request('http://localhost/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 404 when scheme not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetPaperById.mockResolvedValue({ id: makeBody().paper_id });
    mockGetSchemeByPaper.mockRejectedValue(new Error('not found'));

    const req = new Request('http://localhost/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 when scheme does not belong to paper', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetPaperById.mockResolvedValue({ id: makeBody().paper_id });
    mockGetSchemeByPaper.mockResolvedValue({ id: 'different-scheme-id' });

    const req = new Request('http://localhost/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 201 on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetPaperById.mockResolvedValue({ id: makeBody().paper_id });
    mockGetSchemeByPaper.mockResolvedValue({ id: makeBody().scheme_id });
    mockCreateBatch.mockResolvedValue({
      id: 'batch-1',
      name: 'Test Batch',
      status: 'pending',
      medium: 'english',
      total_papers: 0,
      marked_papers: 0,
      created_at: '2026-03-21T00:00:00Z',
    });

    const req = new Request('http://localhost/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('batch-1');
    expect(body.status).toBe('pending');
  });
});
