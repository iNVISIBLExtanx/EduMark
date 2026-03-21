import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../__mocks__/supabase';
import {
  getMarkingSchemeByPaper,
  createMarkingScheme,
  getMarkingSchemeById,
  updateMarkingSchemeStructure,
} from './marking-schemes';

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.insert.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
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
