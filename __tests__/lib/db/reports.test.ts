import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../__mocks__/supabase';
import {
  getReportBySubmission,
  createOrUpdateReport,
  approveReport,
} from '@/lib/db/reports';

// Add upsert to mock since it's not in the shared mock
mockSupabaseClient.upsert = vi.fn().mockReturnThis();

beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish mock chains after clearAllMocks resets implementations
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
  mockSupabaseClient.upsert.mockReturnThis();
});

describe('getReportBySubmission', () => {
  it('returns report data for the given submission', async () => {
    const report = {
      id: 'report-1',
      submission_id: 'sub-1',
      pdf_url: '/reports/sub-1.pdf',
      tutor_approved: false,
      approved_at: null,
      generated_at: '2026-03-20T10:00:00Z',
    };
    mockSupabaseClient.single.mockResolvedValue({ data: report, error: null });

    const result = await getReportBySubmission('sub-1');

    expect(result).toEqual(report);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith(
      'id, submission_id, pdf_url, tutor_approved, approved_at, generated_at'
    );
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('submission_id', 'sub-1');
  });

  it('returns null when no report exists (PGRST116)', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });

    const result = await getReportBySubmission('sub-nonexistent');

    expect(result).toBeNull();
  });

  it('returns an approved report with approved_at set', async () => {
    const report = {
      id: 'report-2',
      submission_id: 'sub-2',
      pdf_url: '/reports/sub-2.pdf',
      tutor_approved: true,
      approved_at: '2026-03-21T14:00:00Z',
      generated_at: '2026-03-20T10:00:00Z',
    };
    mockSupabaseClient.single.mockResolvedValue({ data: report, error: null });

    const result = await getReportBySubmission('sub-2');

    expect(result).toEqual(report);
    expect(result!.tutor_approved).toBe(true);
    expect(result!.approved_at).toBe('2026-03-21T14:00:00Z');
  });

  it('throws on non-PGRST116 errors', async () => {
    const dbError = { code: '42P01', message: 'relation does not exist' };
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: dbError });

    await expect(getReportBySubmission('sub-1')).rejects.toEqual(dbError);
  });
});

describe('createOrUpdateReport', () => {
  it('upserts a report and returns the result', async () => {
    const report = {
      id: 'report-1',
      submission_id: 'sub-1',
      pdf_url: '/reports/sub-1.pdf',
      tutor_approved: false,
      generated_at: '2026-03-22T10:00:00Z',
    };
    mockSupabaseClient.single.mockResolvedValue({ data: report, error: null });

    const result = await createOrUpdateReport('sub-1', '/reports/sub-1.pdf');

    expect(result).toEqual(report);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
    expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        submission_id: 'sub-1',
        pdf_url: '/reports/sub-1.pdf',
        generated_at: expect.any(String),
      }),
      { onConflict: 'submission_id' }
    );
    expect(mockSupabaseClient.select).toHaveBeenCalledWith(
      'id, submission_id, pdf_url, tutor_approved, generated_at'
    );
  });

  it('passes a valid ISO timestamp for generated_at', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { id: 'r1', submission_id: 'sub-1', pdf_url: '/r.pdf', tutor_approved: false, generated_at: '2026-03-22T10:00:00Z' },
      error: null,
    });

    await createOrUpdateReport('sub-1', '/r.pdf');

    const upsertArg = mockSupabaseClient.upsert.mock.calls[0][0];
    // Verify generated_at is a valid ISO string
    expect(new Date(upsertArg.generated_at).toISOString()).toBe(upsertArg.generated_at);
  });

  it('throws on upsert error', async () => {
    const dbError = { message: 'upsert failed' };
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: dbError });

    await expect(createOrUpdateReport('sub-1', '/reports/sub-1.pdf')).rejects.toEqual(dbError);
  });
});

describe('approveReport', () => {
  it('upserts tutor_approved and approved_at for the submission', async () => {
    mockSupabaseClient.upsert.mockResolvedValue({ error: null });

    await approveReport('sub-1');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
    expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        submission_id: 'sub-1',
        tutor_approved: true,
        approved_at: expect.any(String),
      }),
      { onConflict: 'submission_id' }
    );
  });

  it('passes a valid ISO timestamp for approved_at', async () => {
    mockSupabaseClient.upsert.mockResolvedValue({ error: null });

    await approveReport('sub-1');

    const upsertArg = mockSupabaseClient.upsert.mock.calls[0][0];
    expect(new Date(upsertArg.approved_at).toISOString()).toBe(upsertArg.approved_at);
  });

  it('throws on upsert error', async () => {
    const dbError = { message: 'upsert failed' };
    mockSupabaseClient.upsert.mockResolvedValue({ error: dbError });

    await expect(approveReport('sub-1')).rejects.toEqual(dbError);
  });
});
