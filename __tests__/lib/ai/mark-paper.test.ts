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

  it('includes explicit marking rules covering feedback structure and scheme citation', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain('<marking_rules>');
    expect(prompt).toContain('ocr_confidence');
    expect(prompt).toContain('addressing the student directly');
    expect(prompt).toContain('per scheme');
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

  it('with paperName filters to only that paper in paper_structure', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('Pure (Paper I)');
    expect(prompt).not.toContain('Applied (Paper II)');
  });

  it('without paperName includes all papers in paper_structure', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme);
    expect(prompt).toContain('Pure (Paper I)');
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
    // Paper label should not appear as "Physics — <paperName>" prefix
    expect(text).not.toMatch(/^The attached PDF.*Physics —/);
  });

  it('references student_answer_text for examiner notes, not full transcription', () => {
    const text = buildUserMessageText('Biology');
    expect(text).toContain('student_answer_text');
    expect(text).not.toContain("transcribe the student's answer into student_answer_text");
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

  it('accepts a question without student_answer_text (field is optional)', () => {
    const valid = {
      paper_name: 'Paper II (Essay)',
      questions: [{
        part: 'Part A',
        question_no: 1,
        max_marks: 10,
        awarded_marks: 7,
        feedback: 'Good',
        ocr_confidence: 'high' as const,
      }],
      total_awarded: 7,
      total_max: 10,
      general_feedback: 'Well done',
    };
    expect(() => markingResultSchema.parse(valid)).not.toThrow();
  });
});

describe('markingOutputFormat', () => {
  it('is defined with json_schema type', () => {
    expect(markingOutputFormat).toBeDefined();
    expect(markingOutputFormat.type).toBe('json_schema');
  });
});

describe('Combined Maths specific prompt rules', () => {
  const scheme = 'Q1: 25 marks. Q11: 150 marks.';

  it('selection_rule for Pure (Paper I) does not contain division by 10', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    // Must not have the confusing /10 scaling that caused wrong marks
    expect(prompt).not.toMatch(/\/ ?10/);
  });

  it('selection_rule for Applied (Paper II) does not contain division by 10', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Applied (Paper II)');
    expect(prompt).not.toMatch(/\/ ?10/);
  });

  it('system prompt contains rule 13 — all 10 Part A questions must appear, applies ONLY to Part A', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('13.');
    expect(prompt).toContain('ALL 10 questions MUST appear');
    expect(prompt).toContain('ONLY to Part A');
  });

  it('system prompt contains rule 14 — max_marks must be 25 or 150', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('14.');
    expect(prompt).toContain('max_marks');
  });

  it('system prompt contains rule 15 — error-only feedback (EXCLUSIVELY on errors, no "what you did correctly")', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('15.');
    expect(prompt).toContain('EXCLUSIVELY on errors');
    expect(prompt).not.toContain('what you did correctly');
  });

  it('system prompt contains rule 18 — Part B attendance rule', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('18.');
    expect(prompt).toContain('Part B attendance');
  });

  it('Rule 7 requires sub_questions for Combined Maths Part A', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', 'scheme', 'Pure (Paper I)');
    expect(prompt).toContain('MANDATORY');
  });

  it('Rule 18 — Part B unattempted questions excluded', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', 'scheme');
    expect(prompt).toContain('Part B attendance');
  });

  it('Part A marks_per_question is 25 in paper_structure XML', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('<marks_per_question>25</marks_per_question>');
  });

  it('Part B marks_per_question is 150 in paper_structure XML', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('<marks_per_question>150</marks_per_question>');
  });

  it('instructs to output raw awarded_marks, not scaled', () => {
    const prompt = buildSystemPrompt('Combined Maths', 'english', scheme, 'Pure (Paper I)');
    expect(prompt).toContain('Output raw awarded_marks');
    expect(prompt).toContain('do NOT scale or divide by 10');
  });
});
