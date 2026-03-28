import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  sinhala: `
    Read the handwritten answers carefully. The student has written in Sinhala.
    Use the marking scheme context to guide your interpretation of ambiguous characters.
    Generate ALL feedback text in Sinhala Unicode script (සිංහල).
    If handwriting is unclear, set ocr_confidence to "low".
  `,
  tamil: `
    Read the handwritten answers carefully. The student has written in Tamil.
    Use the marking scheme context to guide your interpretation of ambiguous characters.
    Generate ALL feedback text in Tamil script (தமிழ்).
    If handwriting is unclear, set ocr_confidence to "low".
  `,
  english: `
    Read the handwritten answers carefully. Generate ALL feedback in English.
  `,
};

/**
 * Zod schema for structured output — guarantees valid JSON from Claude.
 * The ocr_confidence enum enforces only 'high' | 'low' (matching DB constraint).
 */
export const markingResultSchema = z.object({
  questions: z.array(
    z.object({
      question_no: z.number(),
      max_marks: z.number(),
      awarded_marks: z.number(),
      student_answer_text: z.string(),
      feedback: z.string(),
      ocr_confidence: z.enum(['high', 'low']),
    }),
  ),
  total_awarded: z.number(),
  total_max: z.number(),
  general_feedback: z.string(),
});

export type MarkingResult = z.infer<typeof markingResultSchema>;

/** Pre-built output format for Claude API — reused across all dispatch calls */
export const markingOutputFormat = zodOutputFormat(markingResultSchema);

export function buildSystemPrompt(
  subject: string,
  medium: string,
  markingSchemeText: string
): string {
  return `You are an expert Sri Lankan A/L ${subject} examiner.

${LANGUAGE_INSTRUCTIONS[medium] ?? LANGUAGE_INSTRUCTIONS.english}

## Marking Scheme
${markingSchemeText}

Mark each question according to the scheme. For each question provide: question number, max marks, awarded marks, a transcription of the student's answer, detailed feedback, and OCR confidence ("high" if handwriting is clear, "low" if unclear).`;
}
