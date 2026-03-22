import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/marking-schemes/route';

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

const mockGetPaperById = vi.fn();
vi.mock('@/lib/db/question-papers', () => ({
  getQuestionPaperById: (...args: unknown[]) => mockGetPaperById(...args),
}));

const mockCreateScheme = vi.fn();
vi.mock('@/lib/db/marking-schemes', () => ({
  createMarkingScheme: (...args: unknown[]) => mockCreateScheme(...args),
}));

const TEST_USER = { id: 'user-1', email: 'test@test.com' };
const VALID_PAPER_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeFormData(overrides: Record<string, string | File> = {}) {
  const formData = new FormData();
  const defaults: Record<string, string | File> = {
    file: new File(['pdf content'], 'scheme.pdf', { type: 'application/pdf' }),
    paper_id: VALID_PAPER_ID,
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    formData.append(key, value);
  }
  return formData;
}

describe('POST /api/marking-schemes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new Request('http://localhost/api/marking-schemes', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const formData = new FormData();
    formData.append('paper_id', VALID_PAPER_ID);

    const req = new Request('http://localhost/api/marking-schemes', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when file is not PDF', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const req = new Request('http://localhost/api/marking-schemes', {
      method: 'POST',
      body: makeFormData({
        file: new File(['text'], 'scheme.txt', { type: 'text/plain' }),
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when paper_id is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const req = new Request('http://localhost/api/marking-schemes', {
      method: 'POST',
      body: makeFormData({ paper_id: 'not-a-uuid' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when paper not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetPaperById.mockRejectedValue(new Error('not found'));

    const req = new Request('http://localhost/api/marking-schemes', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 201 on successful upload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetPaperById.mockResolvedValue({ id: VALID_PAPER_ID });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockCreateScheme.mockResolvedValue({
      id: 'scheme-1',
      paper_id: VALID_PAPER_ID,
      pdf_url: `user-1/${VALID_PAPER_ID}/marking-scheme.pdf`,
      embeddings_done: false,
      created_at: '2026-03-21T00:00:00Z',
    });

    const req = new Request('http://localhost/api/marking-schemes', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('scheme-1');
  });
});
