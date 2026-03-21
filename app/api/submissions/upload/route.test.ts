import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';

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

const mockGetBatchById = vi.fn();
vi.mock('@/lib/db/batches', () => ({
  getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
}));

const mockCreateStudentAndSubmission = vi.fn();
const mockUpdateBatchPaperCount = vi.fn();
vi.mock('@/lib/db/submissions', () => ({
  createStudentAndSubmission: (...args: unknown[]) => mockCreateStudentAndSubmission(...args),
  updateBatchPaperCount: (...args: unknown[]) => mockUpdateBatchPaperCount(...args),
}));

const mockGetPdfPageCount = vi.fn();
vi.mock('@/lib/pdf/pdf-to-images', () => ({
  getPdfPageCount: (...args: unknown[]) => mockGetPdfPageCount(...args),
}));

const TEST_USER = { id: 'user-1', email: 'test@test.com' };
const BATCH_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeFormData(
  fileCount = 1,
  overrides: Record<string, unknown> = {},
) {
  const formData = new FormData();
  const fileMeta = [];

  for (let i = 0; i < fileCount; i++) {
    formData.append(
      'files',
      new File(['pdf content'], `student-${i}.pdf`, { type: 'application/pdf' }),
    );
    fileMeta.push({
      student_name: `Student ${i}`,
      index_no: `IDX-${i}`,
    });
  }

  const metadata = {
    batch_id: BATCH_ID,
    files: fileMeta,
    ...overrides,
  };
  formData.append('metadata', JSON.stringify(metadata));
  return formData;
}

describe('POST /api/submissions/upload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when metadata is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const formData = new FormData();
    formData.append(
      'files',
      new File(['pdf'], 'test.pdf', { type: 'application/pdf' }),
    );
    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when metadata is invalid JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const formData = new FormData();
    formData.append('metadata', 'not-json');
    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when schema validation fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({ batch_id: 'not-uuid', files: [] }));
    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when batch not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockRejectedValue(new Error('not found'));

    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 when batch status is not pending or uploading', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID, status: 'completed', total_papers: 0 });

    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: makeFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('completed');
  });

  it('returns 400 when file count does not match metadata', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID, status: 'pending', total_papers: 0 });

    // Metadata says 2 files but we only send 1
    const formData = new FormData();
    formData.append(
      'files',
      new File(['pdf'], 'student.pdf', { type: 'application/pdf' }),
    );
    formData.append(
      'metadata',
      JSON.stringify({
        batch_id: BATCH_ID,
        files: [
          { student_name: 'A', index_no: '1' },
          { student_name: 'B', index_no: '2' },
        ],
      }),
    );

    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Expected 2');
  });

  it('returns 400 when a file is not PDF', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID, status: 'pending', total_papers: 0 });

    const formData = new FormData();
    formData.append(
      'files',
      new File(['not pdf'], 'student.txt', { type: 'text/plain' }),
    );
    formData.append(
      'metadata',
      JSON.stringify({
        batch_id: BATCH_ID,
        files: [{ student_name: 'Student A' }],
      }),
    );

    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('PDF');
  });

  it('returns 201 on successful upload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID, status: 'pending', total_papers: 0 });
    mockGetPdfPageCount.mockResolvedValue(5);
    mockStorageUpload.mockResolvedValue({ error: null });
    mockCreateStudentAndSubmission.mockResolvedValue({
      id: 'sub-1',
      student_id: 'stu-1',
      pdf_url: 'user-1/batch-1/stu-1.pdf',
      page_count: 5,
      status: 'pending',
    });
    mockUpdateBatchPaperCount.mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: makeFormData(1),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.submissions).toHaveLength(1);
    expect(mockCreateStudentAndSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: BATCH_ID,
        studentName: 'Student 0',
        pageCount: 5,
      }),
    );
    expect(mockUpdateBatchPaperCount).toHaveBeenCalledWith(BATCH_ID, 1);
  });

  it('returns 500 on storage upload failure', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetBatchById.mockResolvedValue({ id: BATCH_ID, status: 'uploading', total_papers: 0 });
    mockGetPdfPageCount.mockResolvedValue(3);
    mockStorageUpload.mockResolvedValue({ error: new Error('storage error') });

    const req = new Request('http://localhost/api/submissions/upload', {
      method: 'POST',
      body: makeFormData(1),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
