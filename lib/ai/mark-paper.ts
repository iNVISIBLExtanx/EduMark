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

export interface MarkingResult {
  questions: {
    question_no: number;
    max_marks: number;
    awarded_marks: number;
    student_answer_text: string;
    feedback: string;
    ocr_confidence: 'high' | 'low';
  }[];
  total_awarded: number;
  total_max: number;
  general_feedback: string;
}

export function buildSystemPrompt(
  subject: string,
  medium: string,
  markingSchemeText: string
): string {
  return `You are an expert Sri Lankan A/L ${subject} examiner.

${LANGUAGE_INSTRUCTIONS[medium] ?? LANGUAGE_INSTRUCTIONS.english}

## Marking Scheme
${markingSchemeText}

## Output Format
Return ONLY valid JSON matching this exact schema:
{
  "questions": [
    {
      "question_no": 1,
      "max_marks": 10,
      "awarded_marks": 7,
      "student_answer_text": "...",
      "feedback": "...",
      "ocr_confidence": "high"
    }
  ],
  "total_awarded": 7,
  "total_max": 10,
  "general_feedback": "..."
}`;
}
