import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/marking-schemes/[id]/embeddings/route';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockGetMarkingSchemeById = vi.fn();
vi.mock('@/lib/db/marking-schemes', () => ({
  getMarkingSchemeById: (...args: unknown[]) => mockGetMarkingSchemeById(...args),
}));

const mockGenerateAndStoreEmbeddings = vi.fn();
vi.mock('@/lib/ai/embeddings', () => ({
  generateAndStoreEmbeddings: (...args: unknown[]) => mockGenerateAndStoreEmbeddings(...args),
}));

const TEST_USER = { id: 'user-1', email: 'test@test.com' };
const SCHEME_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeRequest() {
  return new Request('http://localhost/api/marking-schemes/test/embeddings', {
    method: 'POST',
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: SCHEME_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/marking-schemes/[id]/embeddings', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
    // Must not call any downstream functions
    expect(mockGetMarkingSchemeById).not.toHaveBeenCalled();
    expect(mockGenerateAndStoreEmbeddings).not.toHaveBeenCalled();
  });

  it('returns 404 when scheme not found and does not attempt embedding', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockRejectedValue(new Error('not found'));

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Marking scheme not found');
    expect(mockGenerateAndStoreEmbeddings).not.toHaveBeenCalled();
  });

  it('passes correct scheme ID to getMarkingSchemeById', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      structure_json: { questions: [{ no: 1, marks: 5, model_answer: 'test' }] },
    });
    mockGenerateAndStoreEmbeddings.mockResolvedValue({ chunksStored: 3 });

    await POST(makeRequest(), makeParams());

    expect(mockGetMarkingSchemeById).toHaveBeenCalledWith(SCHEME_ID);
  });

  it('returns 400 when structure_json is null and does not attempt embedding', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      structure_json: null,
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no parsed structure');
    expect(mockGenerateAndStoreEmbeddings).not.toHaveBeenCalled();
  });

  it('returns 400 when structure_json.questions is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      structure_json: { questions: [] },
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(400);
    expect(mockGenerateAndStoreEmbeddings).not.toHaveBeenCalled();
  });

  it('returns 400 when structure_json has no questions key', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      structure_json: {},
    });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(400);
    expect(mockGenerateAndStoreEmbeddings).not.toHaveBeenCalled();
  });

  it('returns 200 with correct response shape on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      structure_json: { questions: [{ no: 1, marks: 10, model_answer: 'F=ma' }] },
    });
    mockGenerateAndStoreEmbeddings.mockResolvedValue({ chunksStored: 3 });

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      scheme_id: SCHEME_ID,
      chunks_stored: 3,
      embeddings_done: true,
    });
  });

  it('passes correct args to generateAndStoreEmbeddings', async () => {
    const structureJson = { questions: [{ no: 1, marks: 5, model_answer: 'Answer' }] };
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      structure_json: structureJson,
    });
    mockGenerateAndStoreEmbeddings.mockResolvedValue({ chunksStored: 3 });

    await POST(makeRequest(), makeParams());

    expect(mockGenerateAndStoreEmbeddings).toHaveBeenCalledWith(SCHEME_ID, structureJson);
  });

  it('returns 500 with error message when embedding generation throws Error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      structure_json: { questions: [{ no: 1, marks: 10, model_answer: 'Test' }] },
    });
    mockGenerateAndStoreEmbeddings.mockRejectedValue(new Error('OpenAI timeout'));

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('OpenAI timeout');
  });

  it('returns 500 with fallback message when embedding generation throws non-Error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetMarkingSchemeById.mockResolvedValue({
      id: SCHEME_ID,
      structure_json: { questions: [{ no: 1, marks: 10, model_answer: 'Test' }] },
    });
    // Throw a non-Error (e.g. a string or object from Supabase)
    mockGenerateAndStoreEmbeddings.mockRejectedValue('unexpected string error');

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to generate embeddings');
  });
});
