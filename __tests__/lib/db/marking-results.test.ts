import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock('@/lib/ai/mark-paper', () => ({}));

import { getMarkingResultsByBatch, updateMarkingOverride, saveMarkingResults } from '@/lib/db/marking-results';

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.order.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
});

describe('getMarkingResultsByBatch', () => {
  function setupOrderChain(resolvedValue: { data: unknown; error: unknown }) {
    // .order('submission_id') returns this, .order('question_no') resolves
    mockSupabaseClient.order
      .mockReturnValueOnce(mockSupabaseClient)
      .mockResolvedValueOnce(resolvedValue);
  }

  it('returns marking results for a batch', async () => {
    const mockResults = [
      { id: 'r1', submission_id: 's1', question_no: 1, awarded_marks: 8, max_marks: 10 },
    ];
    setupOrderChain({ data: mockResults, error: null });
    const results = await getMarkingResultsByBatch('batch-1');
    expect(results).toEqual(mockResults);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('marking_results');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('submissions.batch_id', 'batch-1');
  });

  it('throws on Supabase error', async () => {
    setupOrderChain({ data: null, error: { message: 'DB error' } });
    await expect(getMarkingResultsByBatch('batch-1')).rejects.toEqual({ message: 'DB error' });
  });

  it('returns empty array when no results', async () => {
    setupOrderChain({ data: [], error: null });
    const results = await getMarkingResultsByBatch('batch-1');
    expect(results).toEqual([]);
  });

  it('selects correct columns with inner join', async () => {
    setupOrderChain({ data: [], error: null });
    await getMarkingResultsByBatch('batch-1');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith(
      expect.stringContaining('submissions!inner(batch_id)')
    );
  });
});

describe('updateMarkingOverride', () => {
  function setupEqChain(resolvedValue: { error: unknown }) {
    // .eq('id', ...) returns this, .eq('submission_id', ...) resolves
    mockSupabaseClient.eq
      .mockReturnValueOnce(mockSupabaseClient)
      .mockResolvedValueOnce(resolvedValue);
  }

  it('updates override fields for a marking result', async () => {
    setupEqChain({ error: null });
    await updateMarkingOverride('r1', 's1', 9, 'Updated feedback');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('marking_results');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith({
      tutor_override: true,
      override_marks: 9,
      override_feedback: 'Updated feedback',
    });
  });

  it('matches on both resultId and submissionId', async () => {
    setupEqChain({ error: null });
    await updateMarkingOverride('r1', 's1', 5, 'Feedback');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'r1');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('submission_id', 's1');
  });

  it('throws on Supabase error', async () => {
    setupEqChain({ error: { message: 'Update failed' } });
    await expect(updateMarkingOverride('r1', 's1', 5, 'Feedback')).rejects.toEqual({ message: 'Update failed' });
  });

  it('sets tutor_override to true in the update payload', async () => {
    setupEqChain({ error: null });
    await updateMarkingOverride('r1', 's1', 10, 'Great work');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ tutor_override: true })
    );
  });
});

describe('saveMarkingResults', () => {
  function setupInsertChain(resolvedValue: { error: unknown }) {
    mockSupabaseClient.insert.mockResolvedValueOnce(resolvedValue);
  }

  const validResult = {
    questions: [
      {
        question_no: 1,
        max_marks: 10,
        awarded_marks: 7,
        student_answer_text: 'F=ma',
        feedback: 'Good',
        ocr_confidence: 'high' as const,
      },
    ],
    total_awarded: 7,
    total_max: 10,
    general_feedback: 'Well done',
  };

  it('inserts marking result rows into marking_results table', async () => {
    setupInsertChain({ error: null });

    await saveMarkingResults('sub-1', validResult);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('marking_results');
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        submission_id: 'sub-1',
        question_no: 1,
        max_marks: 10,
        awarded_marks: 7,
        feedback: 'Good',
        ocr_confidence: 'high',
      }),
    ]);
  });

  it('sanitizes ocr_confidence "medium" to "low"', async () => {
    setupInsertChain({ error: null });
    const resultWithMedium = {
      ...validResult,
      questions: [{
        ...validResult.questions[0],
        ocr_confidence: 'medium' as unknown as 'high' | 'low',
      }],
    };

    await saveMarkingResults('sub-1', resultWithMedium);

    const insertedRows = mockSupabaseClient.insert.mock.calls[0][0];
    expect(insertedRows[0].ocr_confidence).toBe('low');
  });

  it('sanitizes any non-high ocr_confidence to "low"', async () => {
    setupInsertChain({ error: null });
    const resultWithUnknown = {
      ...validResult,
      questions: [{
        ...validResult.questions[0],
        ocr_confidence: 'unknown' as unknown as 'high' | 'low',
      }],
    };

    await saveMarkingResults('sub-1', resultWithUnknown);

    const insertedRows = mockSupabaseClient.insert.mock.calls[0][0];
    expect(insertedRows[0].ocr_confidence).toBe('low');
  });

  it('keeps ocr_confidence "high" as "high"', async () => {
    setupInsertChain({ error: null });

    await saveMarkingResults('sub-1', validResult);

    const insertedRows = mockSupabaseClient.insert.mock.calls[0][0];
    expect(insertedRows[0].ocr_confidence).toBe('high');
  });

  it('throws on insert error', async () => {
    setupInsertChain({ error: { message: 'Insert failed' } });

    await expect(saveMarkingResults('sub-1', validResult)).rejects.toEqual({ message: 'Insert failed' });
  });
});

describe('getMarkingResultsByBatch ordering', () => {
  function setupOrderChain(resolvedValue: { data: unknown; error: unknown }) {
    mockSupabaseClient.order
      .mockReturnValueOnce(mockSupabaseClient)
      .mockResolvedValueOnce(resolvedValue);
  }

  it('orders by submission_id then question_no', async () => {
    setupOrderChain({ data: [], error: null });
    await getMarkingResultsByBatch('batch-1');
    expect(mockSupabaseClient.order).toHaveBeenCalledWith('submission_id', { ascending: true });
    expect(mockSupabaseClient.order).toHaveBeenCalledWith('question_no', { ascending: true });
  });

  it('calls from with marking_results table', async () => {
    setupOrderChain({ data: [], error: null });
    await getMarkingResultsByBatch('batch-1');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('marking_results');
  });
});
