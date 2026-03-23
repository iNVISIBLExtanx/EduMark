import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../__mocks__/supabase';
import {
  getMarkingSchemeByPaper,
  createMarkingScheme,
  getMarkingSchemeById,
  updateMarkingSchemeStructure,
  insertEmbeddingChunks,
  deleteEmbeddingsByScheme,
  markEmbeddingsDone,
  matchMarkingCriteria,
  type EmbeddingChunkInput,
} from '@/lib/db/marking-schemes';

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.insert.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
  mockSupabaseClient.delete.mockReturnThis();
  mockSupabaseClient.order.mockReturnThis();
});

describe('getMarkingSchemeByPaper', () => {
  it('returns scheme for the given paper', async () => {
    const scheme = { id: 'ms1', paper_id: 'p1', pdf_url: '/ms.pdf', structure_json: null, embeddings_done: false, created_at: '2025-01-01' };
    mockSupabaseClient.single.mockResolvedValue({ data: scheme, error: null });

    const result = await getMarkingSchemeByPaper('p1');

    expect(result).toEqual(scheme);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('marking_schemes');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('paper_id', 'p1');
  });

  it('throws when scheme not found', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await expect(getMarkingSchemeByPaper('bad')).rejects.toEqual({ message: 'not found' });
  });
});

describe('createMarkingScheme', () => {
  it('inserts and returns the created scheme', async () => {
    const created = { id: 'ms1', paper_id: 'p1', pdf_url: '/ms.pdf', embeddings_done: false, created_at: '2025-01-01' };
    mockSupabaseClient.single.mockResolvedValue({ data: created, error: null });

    const result = await createMarkingScheme({ paperId: 'p1', pdfUrl: '/ms.pdf' });

    expect(result).toEqual(created);
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith({ paper_id: 'p1', pdf_url: '/ms.pdf' });
  });

  it('throws on insert error', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

    await expect(createMarkingScheme({ paperId: 'p1', pdfUrl: '/x.pdf' })).rejects.toEqual({ message: 'insert failed' });
  });
});

describe('getMarkingSchemeById', () => {
  it('returns scheme by id', async () => {
    const scheme = { id: 'ms1', paper_id: 'p1', pdf_url: '/ms.pdf', structure_json: { questions: [] }, embeddings_done: true, created_at: '2025-01-01' };
    mockSupabaseClient.single.mockResolvedValue({ data: scheme, error: null });

    const result = await getMarkingSchemeById('ms1');

    expect(result).toEqual(scheme);
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'ms1');
  });

  it('throws when not found', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await expect(getMarkingSchemeById('bad')).rejects.toEqual({ message: 'not found' });
  });
});

describe('updateMarkingSchemeStructure', () => {
  it('updates structure_json for the given scheme', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: null });
    const json = { questions: [{ no: 1, marks: 10 }] };

    await updateMarkingSchemeStructure('ms1', json);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('marking_schemes');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({ structure_json: json });
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'ms1');
  });

  it('throws on update error', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: { message: 'update failed' } });

    await expect(updateMarkingSchemeStructure('ms1', {})).rejects.toEqual({ message: 'update failed' });
  });
});

describe('insertEmbeddingChunks', () => {
  it('batch inserts multiple chunks with full shape', async () => {
    mockSupabaseClient.insert.mockResolvedValue({ error: null });
    const chunks: EmbeddingChunkInput[] = [
      { scheme_id: 'ms1', chunk_text: 'Q1: Total marks: 10', chunk_type: 'mark_allocation', question_no: 1, embedding: [0.1, 0.2, 0.3] },
      { scheme_id: 'ms1', chunk_text: 'Q1 model answer: F=ma', chunk_type: 'model_answer', question_no: 1, embedding: [0.4, 0.5, 0.6] },
      { scheme_id: 'ms1', chunk_text: 'Q1 (10 marks): Expected answer: F=ma', chunk_type: 'question_criterion', question_no: 1, embedding: [0.7, 0.8, 0.9] },
    ];

    await insertEmbeddingChunks(chunks);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('ms_embeddings');
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(chunks);
    // Verify the exact call — not just that insert was called, but with all 3 chunks
    const insertedArg = mockSupabaseClient.insert.mock.calls[0][0];
    expect(insertedArg).toHaveLength(3);
    expect(insertedArg[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(insertedArg[1].chunk_type).toBe('model_answer');
    expect(insertedArg[2].question_no).toBe(1);
  });

  it('throws on insert error', async () => {
    mockSupabaseClient.insert.mockResolvedValue({ error: { message: 'insert failed' } });
    const chunks: EmbeddingChunkInput[] = [
      { scheme_id: 'ms1', chunk_text: 'test', chunk_type: 'mark_allocation', question_no: 1, embedding: [0.1] },
    ];

    await expect(insertEmbeddingChunks(chunks)).rejects.toEqual({ message: 'insert failed' });
  });
});

describe('deleteEmbeddingsByScheme', () => {
  it('deletes by scheme_id', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: null });

    await deleteEmbeddingsByScheme('ms1');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('ms_embeddings');
    expect(mockSupabaseClient.delete).toHaveBeenCalled();
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('scheme_id', 'ms1');
  });

  it('throws on delete error', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: { message: 'delete failed' } });

    await expect(deleteEmbeddingsByScheme('ms1')).rejects.toEqual({ message: 'delete failed' });
  });
});

describe('markEmbeddingsDone', () => {
  it('updates embeddings_done to true', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: null });

    await markEmbeddingsDone('ms1');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('marking_schemes');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({ embeddings_done: true });
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'ms1');
  });

  it('throws on update error', async () => {
    mockSupabaseClient.eq.mockResolvedValue({ error: { message: 'update failed' } });

    await expect(markEmbeddingsDone('ms1')).rejects.toEqual({ message: 'update failed' });
  });
});

describe('matchMarkingCriteria', () => {
  it('calls RPC with correct params', async () => {
    const matches = [{ id: 'e1', chunk_text: 'Q1', chunk_type: 'model_answer', question_no: 1, similarity: 0.95 }];
    mockSupabaseClient.rpc.mockResolvedValue({ data: matches, error: null });

    const result = await matchMarkingCriteria('ms1', [0.1, 0.2], 3);

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('match_marking_criteria', {
      p_scheme_id: 'ms1',
      p_query_embedding: [0.1, 0.2],
      p_match_count: 3,
    });
    expect(result).toEqual(matches);
  });

  it('uses default matchCount of 5', async () => {
    mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

    await matchMarkingCriteria('ms1', [0.1]);

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('match_marking_criteria', {
      p_scheme_id: 'ms1',
      p_query_embedding: [0.1],
      p_match_count: 5,
    });
  });

  it('returns empty array when no matches', async () => {
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

    const result = await matchMarkingCriteria('ms1', [0.1]);

    expect(result).toEqual([]);
  });

  it('throws on RPC error', async () => {
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

    await expect(matchMarkingCriteria('ms1', [0.1])).rejects.toEqual({ message: 'rpc failed' });
  });
});
