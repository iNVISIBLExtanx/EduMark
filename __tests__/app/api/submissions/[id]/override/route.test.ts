import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockUpdateMarkingOverride = vi.fn();
vi.mock('@/lib/db/marking-results', () => ({
  updateMarkingOverride: (...args: unknown[]) => mockUpdateMarkingOverride(...args),
}));

import { PATCH } from '@/app/api/submissions/[id]/override/route';

const TEST_USER = { id: 'user-1', email: 'test@test.com' };
const SUBMISSION_ID = 'sub-1';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/submissions/sub-1/override', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: SUBMISSION_ID }) };
}

describe('PATCH /api/submissions/[id]/override', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(
      makeRequest({ result_id: 'r1', override_marks: 8, override_feedback: 'Good' }),
      makeParams()
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid input (missing result_id)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const res = await PATCH(
      makeRequest({ override_marks: 8, override_feedback: 'Good' }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid input (negative marks)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const res = await PATCH(
      makeRequest({ result_id: 'e47ac10b-58cc-4372-a567-0e02b2c3d479', override_marks: -1, override_feedback: 'Bad' }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful override', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockUpdateMarkingOverride.mockResolvedValue(undefined);
    const res = await PATCH(
      makeRequest({
        result_id: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
        override_marks: 8,
        override_feedback: 'Well done',
      }),
      makeParams()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it('calls updateMarkingOverride with correct args', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockUpdateMarkingOverride.mockResolvedValue(undefined);
    await PATCH(
      makeRequest({
        result_id: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
        override_marks: 7,
        override_feedback: 'Revised',
      }),
      makeParams()
    );
    expect(mockUpdateMarkingOverride).toHaveBeenCalledWith(
      'e47ac10b-58cc-4372-a567-0e02b2c3d479',
      SUBMISSION_ID,
      7,
      'Revised'
    );
  });

  it('returns 500 on DB error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockUpdateMarkingOverride.mockRejectedValue(new Error('Update failed'));
    const res = await PATCH(
      makeRequest({
        result_id: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
        override_marks: 8,
        override_feedback: 'Good',
      }),
      makeParams()
    );
    expect(res.status).toBe(500);
  });

  it('returns 400 for missing override_feedback', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const res = await PATCH(
      makeRequest({
        result_id: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
        override_marks: 8,
      }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer marks (e.g., 7.5)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const res = await PATCH(
      makeRequest({
        result_id: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
        override_marks: 7.5,
        override_feedback: 'Decent',
      }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });
});
