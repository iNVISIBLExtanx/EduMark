import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockOpenAI } from '../../../__mocks__/openai';
import {
  generateEmbeddings,
  generateAndStoreEmbeddings,
  retrieveMarkingCriteria,
} from '@/lib/ai/embeddings';

const mockInsertEmbeddingChunks = vi.fn();
const mockDeleteEmbeddingsByScheme = vi.fn();
const mockMarkEmbeddingsDone = vi.fn();
const mockMatchMarkingCriteria = vi.fn();

vi.mock('@/lib/db/marking-schemes', () => ({
  insertEmbeddingChunks: (...args: unknown[]) => mockInsertEmbeddingChunks(...args),
  deleteEmbeddingsByScheme: (...args: unknown[]) => mockDeleteEmbeddingsByScheme(...args),
  markEmbeddingsDone: (...args: unknown[]) => mockMarkEmbeddingsDone(...args),
  matchMarkingCriteria: (...args: unknown[]) => mockMatchMarkingCriteria(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateEmbeddings', () => {
  it('returns embeddings sorted by index', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [
        { index: 1, embedding: [0.3, 0.4] },
        { index: 0, embedding: [0.1, 0.2] },
      ],
    });

    const result = await generateEmbeddings(['text1', 'text2']);

    expect(result).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it('passes correct model and input to OpenAI', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ index: 0, embedding: [0.1] }],
    });

    await generateEmbeddings(['hello world']);

    expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['hello world'],
    });
  });

  it('returns empty array for empty input without calling OpenAI', async () => {
    const result = await generateEmbeddings([]);

    expect(result).toEqual([]);
    expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
  });

  it('throws when OpenAI API fails', async () => {
    mockOpenAI.embeddings.create.mockRejectedValue(new Error('API rate limit'));

    await expect(generateEmbeddings(['text'])).rejects.toThrow('API rate limit');
  });
});

describe('generateAndStoreEmbeddings', () => {
  const singleQuestionStructure = {
    questions: [{ no: 1, marks: 10, model_answer: 'Force equals mass times acceleration' }],
  };

  const multiQuestionStructure = {
    questions: [
      { no: 1, marks: 10, model_answer: 'F=ma' },
      { no: 2, marks: 15, model_answer: 'E=mc^2' },
    ],
  };

  beforeEach(() => {
    mockDeleteEmbeddingsByScheme.mockResolvedValue(undefined);
    mockInsertEmbeddingChunks.mockResolvedValue(undefined);
    mockMarkEmbeddingsDone.mockResolvedValue(undefined);
  });

  it('stores all 3 chunks with correct fields for a single question', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
        { index: 2, embedding: [0.3] },
      ],
    });

    const result = await generateAndStoreEmbeddings('ms1', singleQuestionStructure);

    expect(result).toEqual({ chunksStored: 3 });

    // Verify exact inserted data — not just arrayContaining
    const insertedChunks = mockInsertEmbeddingChunks.mock.calls[0][0];
    expect(insertedChunks).toHaveLength(3);

    expect(insertedChunks[0]).toEqual({
      scheme_id: 'ms1',
      chunk_text: 'Question 1: Total marks: 10',
      chunk_type: 'mark_allocation',
      question_no: 1,
      embedding: [0.1],
    });
    expect(insertedChunks[1]).toEqual({
      scheme_id: 'ms1',
      chunk_text: 'Question 1 model answer: Force equals mass times acceleration',
      chunk_type: 'model_answer',
      question_no: 1,
      embedding: [0.2],
    });
    expect(insertedChunks[2]).toEqual({
      scheme_id: 'ms1',
      chunk_text: 'Question 1 (10 marks): Expected answer: Force equals mass times acceleration',
      chunk_type: 'question_criterion',
      question_no: 1,
      embedding: [0.3],
    });
  });

  it('handles multi-question structure with correct chunk count', async () => {
    // 2 questions × 3 chunks each = 6 chunks
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: Array.from({ length: 6 }, (_, i) => ({ index: i, embedding: [i * 0.1] })),
    });

    const result = await generateAndStoreEmbeddings('ms1', multiQuestionStructure);

    expect(result).toEqual({ chunksStored: 6 });
    const insertedChunks = mockInsertEmbeddingChunks.mock.calls[0][0];
    expect(insertedChunks).toHaveLength(6);
    // Verify Q1 and Q2 chunks have correct question_no
    expect(insertedChunks.filter((c: { question_no: number }) => c.question_no === 1)).toHaveLength(3);
    expect(insertedChunks.filter((c: { question_no: number }) => c.question_no === 2)).toHaveLength(3);
  });

  it('passes correct chunk texts to OpenAI for embedding', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
        { index: 2, embedding: [0.3] },
      ],
    });

    await generateAndStoreEmbeddings('ms1', singleQuestionStructure);

    const callArgs = mockOpenAI.embeddings.create.mock.calls[0][0];
    expect(callArgs.input).toEqual([
      'Question 1: Total marks: 10',
      'Question 1 model answer: Force equals mass times acceleration',
      'Question 1 (10 marks): Expected answer: Force equals mass times acceleration',
    ]);
  });

  it('deletes old embeddings before inserting new ones', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
        { index: 2, embedding: [0.3] },
      ],
    });

    await generateAndStoreEmbeddings('ms1', singleQuestionStructure);

    const deleteOrder = mockDeleteEmbeddingsByScheme.mock.invocationCallOrder[0];
    const insertOrder = mockInsertEmbeddingChunks.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
  });

  it('calls markEmbeddingsDone after successful insert', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
        { index: 2, embedding: [0.3] },
      ],
    });

    await generateAndStoreEmbeddings('ms1', singleQuestionStructure);

    const insertOrder = mockInsertEmbeddingChunks.mock.invocationCallOrder[0];
    const markDoneOrder = mockMarkEmbeddingsDone.mock.invocationCallOrder[0];
    expect(insertOrder).toBeLessThan(markDoneOrder);
    expect(mockMarkEmbeddingsDone).toHaveBeenCalledWith('ms1');
  });

  it('throws when no chunks generated from empty questions', async () => {
    await expect(
      generateAndStoreEmbeddings('ms1', { questions: [] }),
    ).rejects.toThrow('No chunks generated from structure_json');

    // Should not call OpenAI, delete, insert, or markDone
    expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
    expect(mockDeleteEmbeddingsByScheme).not.toHaveBeenCalled();
    expect(mockInsertEmbeddingChunks).not.toHaveBeenCalled();
    expect(mockMarkEmbeddingsDone).not.toHaveBeenCalled();
  });

  it('throws when OpenAI embedding fails and does not insert or mark done', async () => {
    mockOpenAI.embeddings.create.mockRejectedValue(new Error('OpenAI down'));

    await expect(
      generateAndStoreEmbeddings('ms1', singleQuestionStructure),
    ).rejects.toThrow('OpenAI down');

    // Delete may or may not have been called (it's called after OpenAI in current code)
    // But insert and markDone should NOT be called
    expect(mockInsertEmbeddingChunks).not.toHaveBeenCalled();
    expect(mockMarkEmbeddingsDone).not.toHaveBeenCalled();
  });

  it('throws when delete fails and does not insert or mark done', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
        { index: 2, embedding: [0.3] },
      ],
    });
    mockDeleteEmbeddingsByScheme.mockRejectedValue(new Error('delete permission denied'));

    await expect(
      generateAndStoreEmbeddings('ms1', singleQuestionStructure),
    ).rejects.toThrow('delete permission denied');

    expect(mockInsertEmbeddingChunks).not.toHaveBeenCalled();
    expect(mockMarkEmbeddingsDone).not.toHaveBeenCalled();
  });

  it('throws when DB insert fails and does not mark done', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
        { index: 2, embedding: [0.3] },
      ],
    });
    mockInsertEmbeddingChunks.mockRejectedValue(new Error('DB insert error'));

    await expect(
      generateAndStoreEmbeddings('ms1', singleQuestionStructure),
    ).rejects.toThrow('DB insert error');

    expect(mockMarkEmbeddingsDone).not.toHaveBeenCalled();
  });

  it('throws when markEmbeddingsDone fails', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
        { index: 2, embedding: [0.3] },
      ],
    });
    mockMarkEmbeddingsDone.mockRejectedValue(new Error('mark done failed'));

    await expect(
      generateAndStoreEmbeddings('ms1', singleQuestionStructure),
    ).rejects.toThrow('mark done failed');
  });
});

describe('retrieveMarkingCriteria', () => {
  it('generates query embedding and calls RPC with correct args', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ index: 0, embedding: [0.5, 0.6] }],
    });
    const matches = [{ id: 'e1', chunk_text: 'Q1', chunk_type: 'model_answer', question_no: 1, similarity: 0.9 }];
    mockMatchMarkingCriteria.mockResolvedValue(matches);

    const result = await retrieveMarkingCriteria('ms1', 'What is force?', 3);

    expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['What is force?'],
    });
    expect(mockMatchMarkingCriteria).toHaveBeenCalledWith('ms1', [0.5, 0.6], 3);
    expect(result).toEqual(matches);
  });

  it('uses default matchCount of 5', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ index: 0, embedding: [0.1] }],
    });
    mockMatchMarkingCriteria.mockResolvedValue([]);

    await retrieveMarkingCriteria('ms1', 'question text');

    expect(mockMatchMarkingCriteria).toHaveBeenCalledWith('ms1', [0.1], 5);
  });

  it('throws when OpenAI embedding fails', async () => {
    mockOpenAI.embeddings.create.mockRejectedValue(new Error('embedding failed'));

    await expect(
      retrieveMarkingCriteria('ms1', 'question text'),
    ).rejects.toThrow('embedding failed');

    expect(mockMatchMarkingCriteria).not.toHaveBeenCalled();
  });

  it('throws when matchMarkingCriteria RPC fails', async () => {
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ index: 0, embedding: [0.1] }],
    });
    mockMatchMarkingCriteria.mockRejectedValue(new Error('rpc timeout'));

    await expect(
      retrieveMarkingCriteria('ms1', 'question text'),
    ).rejects.toThrow('rpc timeout');
  });
});
