import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../__mocks__/supabase';
import {
  getSubmissionsByBatch,
  createStudentAndSubmission,
  updateBatchPaperCount,
} from '@/lib/db/submissions';

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.insert.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
  mockSupabaseClient.order.mockReturnThis();
});

describe('getSubmissionsByBatch', () => {
  it('returns submissions for the given batch', async () => {
    const subs = [
      { id: 's1', student_id: 'st1', pdf_url: '/s1.pdf', page_count: 3, status: 'pending', created_at: '2025-01-01', students: { name: 'Alice', index_no: '001' } },
    ];
    mockSupabaseClient.order.mockResolvedValue({ data: subs, error: null });

    const result = await getSubmissionsByBatch('batch-1');

    expect(result).toEqual(subs);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('submissions');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('batch_id', 'batch-1');
  });

  it('throws on error', async () => {
    mockSupabaseClient.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(getSubmissionsByBatch('batch-1')).rejects.toEqual({ message: 'DB error' });
  });
});

describe('createStudentAndSubmission', () => {
  it('creates student then submission and returns submission', async () => {
    const submission = { id: 'sub-1', student_id: 'student-1', pdf_url: '/paper.pdf', page_count: 5, status: 'pending', created_at: '2025-01-01' };

    // First .single() call: student insert
    mockSupabaseClient.single.mockResolvedValueOnce({ data: { id: 'student-1' }, error: null });
    // Second .single() call: submission insert
    mockSupabaseClient.single.mockResolvedValueOnce({ data: submission, error: null });

    const result = await createStudentAndSubmission({
      batchId: 'batch-1',
      studentName: 'Alice',
      indexNo: '001',
      pdfUrl: '/paper.pdf',
      pageCount: 5,
    });

    expect(result).toEqual(submission);
    // Verify both inserts were called
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('students');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('submissions');
  });

  it('throws on student insert error', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: 'student insert failed' } });

    await expect(
      createStudentAndSubmission({ batchId: 'b1', studentName: 'Bob', pdfUrl: '/x.pdf', pageCount: 1 }),
    ).rejects.toEqual({ message: 'student insert failed' });
  });

  it('throws on submission insert error', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({ data: { id: 'student-1' }, error: null });
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: 'submission insert failed' } });

    await expect(
      createStudentAndSubmission({ batchId: 'b1', studentName: 'Bob', pdfUrl: '/x.pdf', pageCount: 1 }),
    ).rejects.toEqual({ message: 'submission insert failed' });
  });

  it('passes null for indexNo when not provided', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({ data: { id: 'student-1' }, error: null });
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: 'sub-1', student_id: 'student-1', pdf_url: '/x.pdf', page_count: 2, status: 'pending', created_at: '2025-01-01' },
      error: null,
    });

    await createStudentAndSubmission({ batchId: 'b1', studentName: 'Charlie', pdfUrl: '/x.pdf', pageCount: 2 });

    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({ index_no: null }),
    );
  });
});

describe('updateBatchPaperCount', () => {
  it('updates total_papers for the batch', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: null });

    await updateBatchPaperCount('batch-1', 10);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('batches');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({ total_papers: 10 });
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'batch-1');
  });

  it('throws on update error', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: { message: 'update failed' } });

    await expect(updateBatchPaperCount('batch-1', 5)).rejects.toEqual({ message: 'update failed' });
  });
});
