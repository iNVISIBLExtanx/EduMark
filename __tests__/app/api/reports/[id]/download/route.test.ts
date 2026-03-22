import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockUpload = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    storage: { from: vi.fn().mockReturnValue({ upload: mockUpload }) },
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

const mockGetQuestionPaperById = vi.fn();
vi.mock('@/lib/db/question-papers', () => ({
  getQuestionPaperById: (...args: unknown[]) => mockGetQuestionPaperById(...args),
}));

const mockGetTutorById = vi.fn();
vi.mock('@/lib/db/tutors', () => ({
  getTutorById: (...args: unknown[]) => mockGetTutorById(...args),
}));

const mockGetMarkingResultsBySubmission = vi.fn();
vi.mock('@/lib/db/marking-results', () => ({
  getMarkingResultsBySubmission: (...args: unknown[]) => mockGetMarkingResultsBySubmission(...args),
}));

const mockGetReportBySubmission = vi.fn();
const mockCreateOrUpdateReport = vi.fn();
vi.mock('@/lib/db/reports', () => ({
  getReportBySubmission: (...args: unknown[]) => mockGetReportBySubmission(...args),
  createOrUpdateReport: (...args: unknown[]) => mockCreateOrUpdateReport(...args),
}));

const mockBuildReportHTML = vi.fn();
const mockGenerateReportPDF = vi.fn();
vi.mock('@/lib/pdf/report-renderer', () => ({
  buildReportHTML: (...args: unknown[]) => mockBuildReportHTML(...args),
  generateReportPDF: (...args: unknown[]) => mockGenerateReportPDF(...args),
}));

import { GET } from '@/app/api/reports/[id]/download/route';

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
  scheme_id: 'scheme-1',
  medium: 'english',
};

const MOCK_PAPER = {
  id: 'paper-1',
  subjects: { name: 'Physics' },
};

const MOCK_TUTOR = {
  id: TEST_USER.id,
  full_name: 'Test Tutor',
  marking_language: 'english',
};

const MOCK_RESULTS = [
  { id: 'r1', question_no: 1, awarded_marks: 8, max_marks: 10, feedback: 'Good' },
];

const MOCK_REPORT = {
  id: 'report-1',
  submission_id: SUBMISSION_ID,
  tutor_approved: true,
};

function makeRequest() {
  return new Request('http://localhost/api/reports/sub-1/download');
}

function makeParams() {
  return { params: Promise.resolve({ id: SUBMISSION_ID }) };
}

function setupSuccessMocks() {
  mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
  mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
  mockGetBatchById.mockResolvedValue(MOCK_BATCH);
  mockGetReportBySubmission.mockResolvedValue(MOCK_REPORT);
  mockGetQuestionPaperById.mockResolvedValue(MOCK_PAPER);
  mockGetTutorById.mockResolvedValue(MOCK_TUTOR);
  mockGetMarkingResultsBySubmission.mockResolvedValue(MOCK_RESULTS);
  mockBuildReportHTML.mockReturnValue('<html>report</html>');
  mockGenerateReportPDF.mockResolvedValue(Buffer.from('fake-pdf'));
  mockUpload.mockResolvedValue({ data: {}, error: null });
  mockCreateOrUpdateReport.mockResolvedValue(undefined);
}

describe('GET /api/reports/[id]/download', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when submission not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockRejectedValue(new Error('not_found'));
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Submission not found');
  });

  it('returns 400 when submission not marked', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue({ ...MOCK_SUBMISSION, status: 'pending' });
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('submission_not_marked');
  });

  it('returns 404 when batch ownership fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockRejectedValue(new Error('batch_not_found'));
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Batch not found');
  });

  it('returns 403 when no report exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockResolvedValue(MOCK_BATCH);
    mockGetReportBySubmission.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('report_not_approved');
  });

  it('returns 403 when report not approved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockResolvedValue(MOCK_BATCH);
    mockGetReportBySubmission.mockResolvedValue({ ...MOCK_REPORT, tutor_approved: false });
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('report_not_approved');
  });

  it('returns 200 with application/pdf content type', async () => {
    setupSuccessMocks();
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
  });

  it('sets Content-Disposition header with student name', async () => {
    setupSuccessMocks();
    const res = await GET(makeRequest(), makeParams());
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="report-John_Doe.pdf"'
    );
  });

  it('uploads PDF to Supabase Storage', async () => {
    setupSuccessMocks();
    await GET(makeRequest(), makeParams());
    expect(mockUpload).toHaveBeenCalledWith(
      `${TEST_USER.id}/${SUBMISSION_ID}.pdf`,
      new Uint8Array(Buffer.from('fake-pdf')),
      { contentType: 'application/pdf', upsert: true }
    );
  });

  it('calls createOrUpdateReport with submissionId and storage path', async () => {
    setupSuccessMocks();
    await GET(makeRequest(), makeParams());
    expect(mockCreateOrUpdateReport).toHaveBeenCalledWith(
      SUBMISSION_ID,
      `${TEST_USER.id}/${SUBMISSION_ID}.pdf`
    );
  });

  it('calls buildReportHTML with correct params', async () => {
    setupSuccessMocks();
    await GET(makeRequest(), makeParams());
    expect(mockBuildReportHTML).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'John Doe',
        indexNo: '12345',
        subjectName: 'Physics',
        language: 'english',
        tutorName: 'Test Tutor',
        results: MOCK_RESULTS,
      })
    );
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockGetSubmissionById.mockResolvedValue(MOCK_SUBMISSION);
    mockGetBatchById.mockResolvedValue(MOCK_BATCH);
    mockGetReportBySubmission.mockResolvedValue(MOCK_REPORT);
    mockGetQuestionPaperById.mockRejectedValue(new Error('unexpected'));
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
