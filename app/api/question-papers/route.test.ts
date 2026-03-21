import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from './route';

// Mock Supabase server client
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

// Mock db functions
const mockGetPapers = vi.fn();
const mockCreatePaper = vi.fn();
vi.mock('@/lib/db/question-papers', () => ({
  getQuestionPapersByTutor: (...args: unknown[]) => mockGetPapers(...args),
  getQuestionPaperById: vi.fn(),
  createQuestionPaper: (...args: unknown[]) => mockCreatePaper(...args),
}));

const mockGetTutorSubjects = vi.fn();
vi.mock('@/lib/db/tutors', () => ({
  getTutorSubjects: (...args: unknown[]) => mockGetTutorSubjects(...args),
}));

const TEST_USER = { id: 'user-1', email: 'test@test.com' };
const VALID_SUBJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeFormData(overrides: Record<string, string | File> = {}) {
  const formData = new FormData();
  const defaults: Record<string, string | File> = {
    file: new File(['pdf content'], 'test.pdf', { type: 'application/pdf' }),
    title: 'Test Paper',
    subject_id: VALID_SUBJECT_ID,
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    formData.append(key, value);
  }
  return formData;
}

describe('GET /api/question-papers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns list of papers on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const papers = [{ id: '1', title: 'Paper A' }];
    mockGetPapers.mockResolvedValue(papers);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(papers);
    expect(mockGetPapers).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 on db error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetPapers.mockRejectedValue(new Error('db error'));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/question-papers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new Request('http://localhost/api/question-papers', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const formData = new FormData();
    formData.append('title', 'Test');
    formData.append('subject_id', VALID_SUBJECT_ID);

    const req = new Request('http://localhost/api/question-papers', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('PDF file is required');
  });

  it('returns 400 when file is not PDF', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const formData = makeFormData({
      file: new File(['not pdf'], 'test.txt', { type: 'text/plain' }),
    });

    const req = new Request('http://localhost/api/question-papers', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('must be a PDF');
  });

  it('returns 400 when title is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const formData = new FormData();
    formData.append('file', new File(['pdf'], 'test.pdf', { type: 'application/pdf' }));
    formData.append('subject_id', VALID_SUBJECT_ID);

    const req = new Request('http://localhost/api/question-papers', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when subject is not in tutor subjects', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetTutorSubjects.mockResolvedValue([
      { subject_id: '00000000-0000-0000-0000-000000000001' },
    ]);

    const req = new Request('http://localhost/api/question-papers', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not registered');
  });

  it('returns 201 on successful upload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetTutorSubjects.mockResolvedValue([{ subject_id: VALID_SUBJECT_ID }]);
    mockStorageUpload.mockResolvedValue({ error: null });
    mockCreatePaper.mockResolvedValue({
      id: 'paper-1',
      title: 'Test Paper',
      year: null,
      pdf_url: 'user-1/paper-1/question-paper.pdf',
      subject_id: VALID_SUBJECT_ID,
      created_at: '2026-03-21T00:00:00Z',
    });

    const req = new Request('http://localhost/api/question-papers', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('paper-1');
    expect(body.title).toBe('Test Paper');
  });

  it('returns 500 on storage upload error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetTutorSubjects.mockResolvedValue([{ subject_id: VALID_SUBJECT_ID }]);
    mockStorageUpload.mockResolvedValue({ error: new Error('storage error') });

    const req = new Request('http://localhost/api/question-papers', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
