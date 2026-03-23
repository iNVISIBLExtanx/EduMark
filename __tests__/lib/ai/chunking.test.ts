import { describe, it, expect } from 'vitest';
import { chunkMarkingScheme, type StructureJson } from '@/lib/ai/chunking';

describe('chunkMarkingScheme', () => {
  it('produces 3 chunks per question when model_answer is present', () => {
    const structure: StructureJson = {
      questions: [{ no: 1, marks: 10, model_answer: 'Force equals mass times acceleration' }],
    };

    const chunks = chunkMarkingScheme(structure);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].chunk_type).toBe('mark_allocation');
    expect(chunks[1].chunk_type).toBe('model_answer');
    expect(chunks[2].chunk_type).toBe('question_criterion');
  });

  it('produces correct text in model_answer chunk', () => {
    const structure: StructureJson = {
      questions: [{ no: 3, marks: 5, model_answer: 'Mitosis produces two identical cells' }],
    };

    const chunks = chunkMarkingScheme(structure);
    const modelChunk = chunks.find((c) => c.chunk_type === 'model_answer')!;

    expect(modelChunk.chunk_text).toBe('Question 3 model answer: Mitosis produces two identical cells');
  });

  it('skips model_answer chunk when model_answer is empty string', () => {
    const structure: StructureJson = {
      questions: [{ no: 1, marks: 5, model_answer: '' }],
    };

    const chunks = chunkMarkingScheme(structure);

    expect(chunks).toHaveLength(2);
    expect(chunks.find((c) => c.chunk_type === 'model_answer')).toBeUndefined();
  });

  it('skips model_answer chunk when model_answer is whitespace only', () => {
    const structure: StructureJson = {
      questions: [{ no: 1, marks: 5, model_answer: '   \t  ' }],
    };

    const chunks = chunkMarkingScheme(structure);

    expect(chunks).toHaveLength(2);
    expect(chunks.find((c) => c.chunk_type === 'model_answer')).toBeUndefined();
  });

  it('skips model_answer chunk when model_answer is null', () => {
    const structure: StructureJson = {
      questions: [{ no: 1, marks: 5, model_answer: null }],
    };

    const chunks = chunkMarkingScheme(structure);

    expect(chunks).toHaveLength(2);
    expect(chunks.find((c) => c.chunk_type === 'model_answer')).toBeUndefined();
  });

  it('skips model_answer chunk when model_answer is undefined', () => {
    const structure: StructureJson = {
      questions: [{ no: 2, marks: 8 }],
    };

    const chunks = chunkMarkingScheme(structure);

    expect(chunks).toHaveLength(2);
    expect(chunks.find((c) => c.chunk_type === 'model_answer')).toBeUndefined();
  });

  it('question_criterion shows N/A when model_answer is null', () => {
    const structure: StructureJson = {
      questions: [{ no: 4, marks: 12, model_answer: null }],
    };

    const chunks = chunkMarkingScheme(structure);
    const criterion = chunks.find((c) => c.chunk_type === 'question_criterion')!;

    expect(criterion.chunk_text).toBe('Question 4 (12 marks): Expected answer: N/A');
  });

  it('question_criterion shows N/A when model_answer is undefined', () => {
    const structure: StructureJson = {
      questions: [{ no: 1, marks: 5 }],
    };

    const chunks = chunkMarkingScheme(structure);
    const criterion = chunks.find((c) => c.chunk_type === 'question_criterion')!;

    expect(criterion.chunk_text).toContain('Expected answer: N/A');
  });

  it('returns empty array for empty questions array', () => {
    const structure: StructureJson = { questions: [] };

    const chunks = chunkMarkingScheme(structure);

    expect(chunks).toEqual([]);
  });

  it('preserves question_no on all chunks for multiple questions', () => {
    const structure: StructureJson = {
      questions: [
        { no: 3, marks: 15, model_answer: 'Answer here' },
        { no: 7, marks: 20, model_answer: 'Another answer' },
      ],
    };

    const chunks = chunkMarkingScheme(structure);

    const q3Chunks = chunks.filter((c) => c.question_no === 3);
    const q7Chunks = chunks.filter((c) => c.question_no === 7);
    expect(q3Chunks).toHaveLength(3);
    expect(q7Chunks).toHaveLength(3);
  });

  it('interleaves chunks correctly across multiple questions', () => {
    const structure: StructureJson = {
      questions: [
        { no: 1, marks: 10, model_answer: 'A1' },
        { no: 2, marks: 20, model_answer: 'A2' },
      ],
    };

    const chunks = chunkMarkingScheme(structure);

    // Q1 chunks first, then Q2 chunks
    expect(chunks[0]).toEqual({ chunk_text: 'Question 1: Total marks: 10', chunk_type: 'mark_allocation', question_no: 1 });
    expect(chunks[1]).toEqual({ chunk_text: 'Question 1 model answer: A1', chunk_type: 'model_answer', question_no: 1 });
    expect(chunks[2]).toEqual({ chunk_text: 'Question 1 (10 marks): Expected answer: A1', chunk_type: 'question_criterion', question_no: 1 });
    expect(chunks[3]).toEqual({ chunk_text: 'Question 2: Total marks: 20', chunk_type: 'mark_allocation', question_no: 2 });
    expect(chunks[4]).toEqual({ chunk_text: 'Question 2 model answer: A2', chunk_type: 'model_answer', question_no: 2 });
    expect(chunks[5]).toEqual({ chunk_text: 'Question 2 (20 marks): Expected answer: A2', chunk_type: 'question_criterion', question_no: 2 });
  });

  it('includes marks in mark_allocation chunk text', () => {
    const structure: StructureJson = {
      questions: [{ no: 1, marks: 25, model_answer: 'Test' }],
    };

    const chunks = chunkMarkingScheme(structure);
    const markAlloc = chunks.find((c) => c.chunk_type === 'mark_allocation')!;

    expect(markAlloc.chunk_text).toBe('Question 1: Total marks: 25');
  });

  it('includes marks and model_answer in question_criterion chunk', () => {
    const structure: StructureJson = {
      questions: [{ no: 2, marks: 10, model_answer: 'Photosynthesis uses light energy' }],
    };

    const chunks = chunkMarkingScheme(structure);
    const criterion = chunks.find((c) => c.chunk_type === 'question_criterion')!;

    expect(criterion.chunk_text).toBe('Question 2 (10 marks): Expected answer: Photosynthesis uses light energy');
  });
});
