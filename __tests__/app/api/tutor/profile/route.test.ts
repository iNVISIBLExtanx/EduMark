import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '@/__mocks__/supabase';

// Mock lib/db/tutors functions
const mockGetTutorById = vi.fn();
const mockCreateTutor = vi.fn();
const mockAddTutorSubjects = vi.fn();
const mockUpdateTutorProfile = vi.fn();
const mockReplaceTutorSubjects = vi.fn();

vi.mock('@/lib/db/tutors', () => ({
  getTutorById: (...args: unknown[]) => mockGetTutorById(...args),
  createTutor: (...args: unknown[]) => mockCreateTutor(...args),
  addTutorSubjects: (...args: unknown[]) => mockAddTutorSubjects(...args),
  updateTutorProfile: (...args: unknown[]) => mockUpdateTutorProfile(...args),
  replaceTutorSubjects: (...args: unknown[]) => mockReplaceTutorSubjects(...args),
}));

import { GET, POST, PATCH } from '@/app/api/tutor/profile/route';

const TEST_USER = { id: 'user-123', email: 'tutor@example.com' };
const TEST_TUTOR = {
  id: 'user-123',
  email: 'tutor@example.com',
  full_name: 'John Doe',
  marking_language: 'english',
  plan: 'free',
  ai_minutes_used: 0,
  ai_minutes_limit: 10,
  subscription_status: 'active',
};
const VALID_SUBJECT_IDS = [
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01',
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02',
];

function makeRequest(method: string, body?: unknown) {
  const url = 'http://localhost:3000/api/tutor/profile';
  if (body) {
    return new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return new Request(url, { method });
}

function setAuthenticated(user = TEST_USER) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  });
}

function setUnauthenticated() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────
// GET /api/tutor/profile
// ──────────────────────────────────────────────
describe('GET /api/tutor/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns tutor on success', async () => {
    setAuthenticated();
    mockGetTutorById.mockResolvedValue(TEST_TUTOR);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(TEST_TUTOR);
    expect(mockGetTutorById).toHaveBeenCalledWith('user-123');
  });

  it('returns 404 when tutor not found', async () => {
    setAuthenticated();
    mockGetTutorById.mockRejectedValue(new Error('Not found'));

    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Tutor not found');
  });
});

// ──────────────────────────────────────────────
// POST /api/tutor/profile
// ──────────────────────────────────────────────
describe('POST /api/tutor/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated();
    const req = makeRequest('POST', {
      full_name: 'Jane',
      marking_language: 'sinhala',
      subject_ids: VALID_SUBJECT_IDS,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    setAuthenticated();
    const req = makeRequest('POST', { full_name: '' }); // missing required fields
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 201 on success', async () => {
    setAuthenticated();
    const createdTutor = {
      id: 'user-123',
      email: 'tutor@example.com',
      full_name: 'Jane Doe',
      marking_language: 'sinhala',
    };
    mockCreateTutor.mockResolvedValue(createdTutor);
    mockAddTutorSubjects.mockResolvedValue(undefined);

    const req = makeRequest('POST', {
      full_name: 'Jane Doe',
      marking_language: 'sinhala',
      subject_ids: VALID_SUBJECT_IDS,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual(createdTutor);
    expect(mockCreateTutor).toHaveBeenCalledWith(
      'user-123',
      'tutor@example.com',
      'Jane Doe',
      'sinhala',
    );
    expect(mockAddTutorSubjects).toHaveBeenCalledWith('user-123', VALID_SUBJECT_IDS);
  });
});

// ──────────────────────────────────────────────
// PATCH /api/tutor/profile
// ──────────────────────────────────────────────
describe('PATCH /api/tutor/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated();
    const req = makeRequest('PATCH', {
      full_name: 'Updated',
      marking_language: 'english',
      subject_ids: VALID_SUBJECT_IDS,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 on invalid body (missing full_name)', async () => {
    setAuthenticated();
    const req = makeRequest('PATCH', {
      marking_language: 'english',
      subject_ids: VALID_SUBJECT_IDS,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 when subject_ids is empty', async () => {
    setAuthenticated();
    const req = makeRequest('PATCH', {
      full_name: 'Updated Name',
      marking_language: 'english',
      subject_ids: [],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 200 on success with updated tutor', async () => {
    setAuthenticated();
    const updatedTutor = {
      id: 'user-123',
      email: 'tutor@example.com',
      full_name: 'Updated Name',
      marking_language: 'tamil',
      plan: 'free',
    };
    mockUpdateTutorProfile.mockResolvedValue(updatedTutor);
    mockReplaceTutorSubjects.mockResolvedValue(undefined);

    const req = makeRequest('PATCH', {
      full_name: 'Updated Name',
      marking_language: 'tamil',
      subject_ids: VALID_SUBJECT_IDS,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(updatedTutor);
  });

  it('returns 500 when updateTutorProfile throws', async () => {
    setAuthenticated();
    mockUpdateTutorProfile.mockRejectedValue(new Error('DB connection lost'));

    const req = makeRequest('PATCH', {
      full_name: 'Updated Name',
      marking_language: 'english',
      subject_ids: VALID_SUBJECT_IDS,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('DB connection lost');
  });

  it('calls updateTutorProfile and replaceTutorSubjects with correct args', async () => {
    setAuthenticated();
    const updatedTutor = {
      id: 'user-123',
      email: 'tutor@example.com',
      full_name: 'New Name',
      marking_language: 'sinhala',
      plan: 'free',
    };
    mockUpdateTutorProfile.mockResolvedValue(updatedTutor);
    mockReplaceTutorSubjects.mockResolvedValue(undefined);

    const req = makeRequest('PATCH', {
      full_name: 'New Name',
      marking_language: 'sinhala',
      subject_ids: VALID_SUBJECT_IDS,
    });
    await PATCH(req);

    expect(mockUpdateTutorProfile).toHaveBeenCalledWith('user-123', 'New Name', 'sinhala');
    expect(mockReplaceTutorSubjects).toHaveBeenCalledWith('user-123', VALID_SUBJECT_IDS);
  });
});
