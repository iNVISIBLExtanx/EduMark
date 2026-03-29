import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  buildUserMessageText,
  markingResultSchema,
  markingOutputFormat,
} from '@/lib/ai/mark-paper';

describe('buildSystemPrompt', () => {
  const scheme = 'Q1: 10 marks. Model answer: ...';

  it('includes subject name', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain('Physics');
  });

  it('includes marking scheme text inside <marking_scheme> block', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain(scheme);
    expect(prompt).toContain('<marking_scheme>');
  });

  it('includes Sinhala instructions for sinhala medium', () => {
    const prompt = buildSystemPrompt('Physics', 'sinhala', scheme);
    expect(prompt).toContain('සිංහල');
  });

  it('includes Tamil instructions for tamil medium', () => {
    const prompt = buildSystemPrompt('Physics', 'tamil', scheme);
    expect(prompt).toContain('தமிழ்');
  });

  it('includes 12 explicit marking rules', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain('<marking_rules>');
    expect(prompt).toContain('ocr_confidence');
  });

  it('falls back to english for unknown medium', () => {
    const prompt = buildSystemPrompt('Physics', 'unknown', scheme);
    expect(prompt).toContain('Generate ALL feedback');
    expect(prompt).toContain('in English');
  });

  it('includes paper_structure XML for known subject', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme);
    expect(prompt).toContain('<paper_structure subject="Combined Maths">');
    expect(prompt).toContain('Part A');
    expect(prompt).toContain('Part B');
  });

  it('Combined Maths Part B specifies BEST 5 of 7', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('7');
    expect(prompt).toContain('5');
    expect(prompt).toContain('BEST 5');
  });

  it('Combined Maths Part A specifies ALL 10 compulsory', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('ALL 10');
  });

  it('includes paper_name in system prompt context when provided', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Applied (Paper II)');
    expect(prompt).toContain('Applied (Paper II)');
  });

  it('falls back to general essay instruction for unknown subject', () => {
    const prompt = buildSystemPrompt('Unknown Subject', 'english', scheme);
    expect(prompt).toContain('general essay paper');
  });

  it('includes best-N selection rule instruction in marking rules', () => {
    const prompt = buildSystemPrompt('Chemistry', 'english', scheme);
    expect(prompt).toContain('BEST-N selection');
    expect(prompt).toContain('best_questions_selected');
  });
});

describe('buildUserMessageText', () => {
  it('includes subject name', () => {
    const text = buildUserMessageText('Physics');
    expect(text).toContain('Physics');
  });

  it('includes all 7 steps', () => {
    const text = buildUserMessageText('Physics');
    expect(text).toContain('Step 1');
    expect(text).toContain('Step 7');
  });

  it('includes paper label when paperName is provided', () => {
    const text = buildUserMessageText('Combined Maths', 'Pure (Paper I)');
    expect(text).toContain('Pure (Paper I)');
  });

  it('omits paper label when paperName is not provided', () => {
    const text = buildUserMessageText('Physics');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain(' — ');
  });

  it('instructs to transcribe student answers', () => {
    const text = buildUserMessageText('Biology');
    expect(text).toContain('student_answer_text');
  });

  it('instructs to apply best-N selection rule', () => {
    const text = buildUserMessageText('Combined Maths');
    expect(text).toContain('best-N selection rule');
  });
});

describe('markingResultSchema', () => {
  it('validates a correct marking result with new fields', () => {
    const valid = {
      paper_name: 'Paper II (Essay)',
      questions: [{
        part: 'Part A',
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

  it('accepts optional sub_questions', () => {
    const valid = {
      paper_name: 'Paper II (Essay)',
      questions: [{
        part: 'Part A',
        question_no: 1,
        max_marks: 10,
        awarded_marks: 7,
        student_answer_text: 'F=ma',
        feedback: 'Good',
        ocr_confidence: 'high' as const,
        sub_questions: [
          { label: '(a)(i)', max_marks: 5, awarded_marks: 4, feedback: 'Good derivation' },
        ],
      }],
      total_awarded: 7,
      total_max: 10,
      general_feedback: 'Well done',
    };
    expect(() => markingResultSchema.parse(valid)).not.toThrow();
  });

  it('accepts optional best_questions_selected', () => {
    const valid = {
      paper_name: 'Pure (Paper I)',
      questions: [],
      best_questions_selected: [1, 3, 5, 6, 7],
      total_awarded: 700,
      total_max: 1000,
      general_feedback: 'Well done',
    };
    expect(() => markingResultSchema.parse(valid)).not.toThrow();
  });

  it('rejects ocr_confidence values other than high/low', () => {
    const invalid = {
      paper_name: 'Paper II (Essay)',
      questions: [{
        part: 'Part A',
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

  it('requires paper_name', () => {
    const missing = {
      questions: [],
      total_awarded: 0,
      total_max: 0,
      general_feedback: '',
    };
    expect(() => markingResultSchema.parse(missing)).toThrow();
  });
});

describe('markingOutputFormat', () => {
  it('is defined with json_schema type', () => {
    expect(markingOutputFormat).toBeDefined();
    expect(markingOutputFormat.type).toBe('json_schema');
  });
});
