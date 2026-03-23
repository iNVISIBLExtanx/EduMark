import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../__mocks__/supabase';
import {
  getBatchesByTutor,
  getBatchById,
  createBatch,
  updateBatchStatus,
  updateBatchName,
} from '@/lib/db/batches';

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.insert.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
  mockSupabaseClient.order.mockReturnThis();
});

describe('getBatchesByTutor', () => {
  it('returns batches for the given tutor', async () => {
    const batches = [
      { id: 'b1', name: 'Batch 1', status: 'pending', medium: 'english', total_papers: 5, marked_papers: 0, created_at: '2025-01-01' },
    ];
    mockSupabaseClient.order.mockResolvedValue({ data: batches, error: null });

    const result = await getBatchesByTutor('tutor-1');

    expect(result).toEqual(batches);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('batches');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('tutor_id', 'tutor-1');
  });

  it('throws on error', async () => {
    mockSupabaseClient.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(getBatchesByTutor('tutor-1')).rejects.toEqual({ message: 'DB error' });
  });
});

describe('getBatchById', () => {
  it('returns a single batch matching id and tutorId', async () => {
    const batch = { id: 'b1', name: 'Batch 1', status: 'pending', medium: 'sinhala', total_papers: 10, marked_papers: 3, created_at: '2025-01-01', paper_id: 'p1', scheme_id: 's1', claude_batch_id: null };
    mockSupabaseClient.single.mockResolvedValue({ data: batch, error: null });

    const result = await getBatchById('b1', 'tutor-1');

    expect(result).toEqual(batch);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('batches');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'b1');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('tutor_id', 'tutor-1');
  });

  it('throws when batch not found', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await expect(getBatchById('bad', 'tutor-1')).rejects.toEqual({ message: 'not found' });
  });
});

describe('createBatch', () => {
  it('inserts and returns the created batch', async () => {
    const created = { id: 'b1', name: 'New Batch', status: 'pending', medium: 'tamil', total_papers: 0, marked_papers: 0, created_at: '2025-01-01' };
    mockSupabaseClient.single.mockResolvedValue({ data: created, error: null });

    const result = await createBatch({
      tutorId: 'tutor-1',
      paperId: 'p1',
      schemeId: 'ms1',
      name: 'New Batch',
      medium: 'tamil',
    });

    expect(result).toEqual(created);
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
      tutor_id: 'tutor-1',
      paper_id: 'p1',
      scheme_id: 'ms1',
      name: 'New Batch',
      medium: 'tamil',
    });
  });

  it('throws on insert error', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

    await expect(
      createBatch({ tutorId: 't1', paperId: 'p1', schemeId: 'ms1', name: 'X', medium: 'english' }),
    ).rejects.toEqual({ message: 'insert failed' });
  });
});

describe('updateBatchStatus', () => {
  it('updates status for the given batch', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: null });

    await updateBatchStatus('b1', 'processing');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('batches');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({ status: 'processing' });
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'b1');
  });

  it('throws on update error', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: { message: 'update failed' } });

    await expect(updateBatchStatus('b1', 'failed')).rejects.toEqual({ message: 'update failed' });
  });
});

describe('updateBatchName', () => {
  it('updates name for the given batch and tutor', async () => {
    mockSupabaseClient.eq
      .mockReturnValueOnce(mockSupabaseClient) // .eq('id', ...)
      .mockResolvedValueOnce({ error: null }); // .eq('tutor_id', ...)

    await updateBatchName('b1', 'tutor-1', 'New Name');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('batches');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({ name: 'New Name' });
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'b1');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('tutor_id', 'tutor-1');
  });

  it('throws on update error', async () => {
    mockSupabaseClient.eq
      .mockReturnValueOnce(mockSupabaseClient)
      .mockResolvedValueOnce({ error: { message: 'update failed' } });

    await expect(updateBatchName('b1', 'tutor-1', 'New Name')).rejects.toEqual({ message: 'update failed' });
  });
});
