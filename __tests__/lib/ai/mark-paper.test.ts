import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, markingResultSchema, markingOutputFormat } from '@/lib/ai/mark-paper';

describe('buildSystemPrompt', () => {
  const scheme = 'Q1: 10 marks. Model answer: ...';

  it('includes subject name', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain('Physics');
  });

  it('includes marking scheme text', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain(scheme);
  });

  it('includes Sinhala instructions for sinhala medium', () => {
    const prompt = buildSystemPrompt('Physics', 'sinhala', scheme);
    expect(prompt).toContain('සිංහල');
  });

  it('includes Tamil instructions for tamil medium', () => {
    const prompt = buildSystemPrompt('Physics', 'tamil', scheme);
    expect(prompt).toContain('தமிழ்');
  });

  it('includes marking instructions with OCR confidence guidance', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain('question number');
    expect(prompt).toContain('OCR confidence');
  });

  it('falls back to english for unknown medium', () => {
    const prompt = buildSystemPrompt('Physics', 'unknown', scheme);
    expect(prompt).toContain('Generate ALL feedback in English');
  });
});

describe('markingResultSchema', () => {
  it('validates a correct marking result', () => {
    const valid = {
      questions: [{
        question_no: 1,
        max_marks: 10,
        awarded_marks: 7,
        student_answer_text: 'F=ma',
        feedback: 'Good',
        ocr_confidence: 'high' as const,
      }],
      total_awarded: 7,
      total_max: 10,
      general_feedback: 'Well done',
    };
    expect(() => markingResultSchema.parse(valid)).not.toThrow();
  });

  it('rejects ocr_confidence values other than high/low', () => {
    const invalid = {
      questions: [{
        question_no: 1,
        max_marks: 10,
        awarded_marks: 7,
        student_answer_text: 'F=ma',
        feedback: 'Good',
        ocr_confidence: 'medium',
      }],
      total_awarded: 7,
      total_max: 10,
      general_feedback: 'Well done',
    };
    expect(() => markingResultSchema.parse(invalid)).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => markingResultSchema.parse({})).toThrow();
  });
});

describe('markingOutputFormat', () => {
  it('is defined with json_schema type', () => {
    expect(markingOutputFormat).toBeDefined();
    expect(markingOutputFormat.type).toBe('json_schema');
  });
});
