import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../__mocks__/supabase';
import {
  getQuestionPapersByTutor,
  getQuestionPaperById,
  createQuestionPaper,
} from '@/lib/db/question-papers';

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.insert.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
  mockSupabaseClient.order.mockReturnThis();
});

describe('getQuestionPapersByTutor', () => {
  it('returns papers for the given tutor', async () => {
    const papers = [
      { id: 'p1', title: 'Paper 1', year: 2025, pdf_url: '/p1.pdf', created_at: '2025-01-01', subject_id: 's1', subjects: { name: 'Physics', code: 'PHY' } },
    ];
    mockSupabaseClient.order.mockResolvedValue({ data: papers, error: null });

    const result = await getQuestionPapersByTutor('tutor-1');

    expect(result).toEqual(papers);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('question_papers');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('tutor_id', 'tutor-1');
  });

  it('throws on error', async () => {
    mockSupabaseClient.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(getQuestionPapersByTutor('tutor-1')).rejects.toEqual({ message: 'DB error' });
  });
});

describe('getQuestionPaperById', () => {
  it('returns a single paper matching id and tutorId', async () => {
    const paper = { id: 'p1', title: 'Paper 1', year: 2025, pdf_url: '/p1.pdf', subject_id: 's1', parsed_json: null, created_at: '2025-01-01', subjects: { name: 'Physics', code: 'PHY' } };
    mockSupabaseClient.single.mockResolvedValue({ data: paper, error: null });

    const result = await getQuestionPaperById('p1', 'tutor-1');

    expect(result).toEqual(paper);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('question_papers');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'p1');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('tutor_id', 'tutor-1');
  });

  it('throws when paper not found', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: { message: 'not found', code: 'PGRST116' } });

    await expect(getQuestionPaperById('bad-id', 'tutor-1')).rejects.toEqual({ message: 'not found', code: 'PGRST116' });
  });
});

describe('createQuestionPaper', () => {
  it('inserts and returns the created paper', async () => {
    const created = { id: 'p1', title: 'New Paper', year: 2025, pdf_url: '/new.pdf', subject_id: 's1', created_at: '2025-01-01' };
    mockSupabaseClient.single.mockResolvedValue({ data: created, error: null });

    const result = await createQuestionPaper({
      tutorId: 'tutor-1',
      subjectId: 's1',
      title: 'New Paper',
      year: 2025,
      pdfUrl: '/new.pdf',
    });

    expect(result).toEqual(created);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('question_papers');
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
      tutor_id: 'tutor-1',
      subject_id: 's1',
      title: 'New Paper',
      year: 2025,
      pdf_url: '/new.pdf',
    });
  });

  it('passes null for year when not provided', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { id: 'p1', title: 'No Year', year: null, pdf_url: '/x.pdf', subject_id: 's1', created_at: '2025-01-01' },
      error: null,
    });

    await createQuestionPaper({
      tutorId: 'tutor-1',
      subjectId: 's1',
      title: 'No Year',
      pdfUrl: '/x.pdf',
    });

    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({ year: null }),
    );
  });

  it('throws on insert error', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: { message: 'duplicate' } });

    await expect(
      createQuestionPaper({ tutorId: 't1', subjectId: 's1', title: 'X', pdfUrl: '/x.pdf' }),
    ).rejects.toEqual({ message: 'duplicate' });
  });

  it('returns the inserted data with all selected columns', async () => {
    const created = { id: 'p2', title: 'Full', year: 2024, pdf_url: '/full.pdf', subject_id: 's2', created_at: '2024-06-01' };
    mockSupabaseClient.single.mockResolvedValue({ data: created, error: null });

    const result = await createQuestionPaper({
      tutorId: 'tutor-2',
      subjectId: 's2',
      title: 'Full',
      year: 2024,
      pdfUrl: '/full.pdf',
    });

    expect(result.id).toBe('p2');
    expect(result.created_at).toBe('2024-06-01');
  });
});
