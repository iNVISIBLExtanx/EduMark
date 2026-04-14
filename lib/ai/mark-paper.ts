import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

// ---------------------------------------------------------------------------
// Subject-level paper structure definitions
// Each subject has a different Part A / Part B layout with different
// mandatory vs optional question rules. These are read by the prompt builder
// so Claude understands exactly which questions to expect and how marks flow.
// ---------------------------------------------------------------------------

export interface PartConfig {
  name: string;             // e.g. "Part A", "Part B"
  total_questions: number;  // how many questions appear on the paper
  answer_required: number;  // how many the student MUST answer
  marks_per_question: number;
  description: string;      // human-readable rule for Claude
}

export interface SubjectPaperConfig {
  subject: string;
  papers: {
    name: string;           // e.g. "Pure (Paper I)", "Applied (Paper II)"
    parts: PartConfig[];
    selection_rule: string; // top-level rule for which questions count
  }[];
  special_notes: string;
}

const SUBJECT_CONFIGS: Record<string, SubjectPaperConfig> = {
  // -----------------------------------------------------------------------
  // Combined Maths — Paper I (Pure) and Paper II (Applied)
  // Part A: 10 questions, ALL compulsory, 25 marks each
  // Part B: 7 questions, answer BEST 5, 150 marks each
  // Source: DOE Sri Lanka Combined Maths marking scheme
  // -----------------------------------------------------------------------
  'Combined Maths': {
    subject: 'Combined Maths',
    papers: [
      {
        name: 'Pure (Paper I)',
        parts: [
          {
            name: 'Part A',
            total_questions: 10,
            answer_required: 10,
            marks_per_question: 25,
            description:
              'ALL 10 short structured questions are compulsory. Each is worth 25 marks. Maximum total = 250 marks.',
          },
          {
            name: 'Part B',
            total_questions: 7,
            answer_required: 5,
            marks_per_question: 150,
            description:
              'Student selects and answers 5 questions out of 7 long-form questions. Each is worth 150 marks. If the student answers more than 5, count only the BEST 5 scoring questions. Maximum total = 750 marks.',
          },
        ],
        selection_rule:
          'Output raw awarded_marks — do NOT scale or divide by 10. Part A: all 10 questions MUST appear in the output array, each max_marks = 25. Part B: mark all attempted questions, each max_marks = 150; populate best_questions_selected with the 5 question numbers with highest awarded_marks. Part A raw total (max 250) + best-5 Part B raw total (max 750) = paper raw total (max 1000).',
      },
      {
        name: 'Applied (Paper II)',
        parts: [
          {
            name: 'Part A',
            total_questions: 10,
            answer_required: 10,
            marks_per_question: 25,
            description:
              'ALL 10 short structured questions are compulsory. Each is worth 25 marks. Maximum total = 250 marks.',
          },
          {
            name: 'Part B',
            total_questions: 7,
            answer_required: 5,
            marks_per_question: 150,
            description:
              'Student selects and answers 5 questions out of 7 long-form questions. Each is worth 150 marks. If the student answers more than 5, count only the BEST 5 scoring questions. Maximum total = 750 marks.',
          },
        ],
        selection_rule:
          'Output raw awarded_marks — do NOT scale or divide by 10. Part A: all 10 questions MUST appear in the output array, each max_marks = 25. Part B: mark all attempted questions, each max_marks = 150; populate best_questions_selected with the 5 question numbers with highest awarded_marks. Part A raw total (max 250) + best-5 Part B raw total (max 750) = paper raw total (max 1000).',
      },
    ],
    special_notes:
      'Write-off: if a student crosses out an answer and rewrites, mark only the final version. Each Part A question MUST have its sub_questions array fully populated with per-sub-part marks and error-focused feedback — this is required, not optional. Marks for sub-parts are summed to the question total.',
  },

  // -----------------------------------------------------------------------
  // Physics — Paper II (Essay) only
  // Part A: 4 structured questions, ALL compulsory, 20 marks each
  // Part B: 4 structured questions, ALL compulsory, 30 marks each
  // -----------------------------------------------------------------------
  'Physics': {
    subject: 'Physics',
    papers: [
      {
        name: 'Paper II (Essay)',
        parts: [
          {
            name: 'Part A',
            total_questions: 4,
            answer_required: 4,
            marks_per_question: 20,
            description:
              'ALL 4 structured essay questions are compulsory. Each is worth 20 marks. Total = 80 marks.',
          },
          {
            name: 'Part B',
            total_questions: 4,
            answer_required: 4,
            marks_per_question: 30,
            description:
              'ALL 4 structured essay questions are compulsory. Each is worth 30 marks. Total = 120 marks.',
          },
        ],
        selection_rule:
          'Paper II total = Part A + Part B = 200 marks. Scaled to 50 for final grade.',
      },
    ],
    special_notes:
      'Diagrams must be fully labelled to receive full diagram marks. Partial credit applies — refer to the sub-step breakdown in the marking scheme for each question.',
  },

  // -----------------------------------------------------------------------
  // Chemistry — Paper II (Essay)
  // Part A: 4 structured questions, ALL compulsory
  // Part B: 5 questions, student answers best 3
  // -----------------------------------------------------------------------
  'Chemistry': {
    subject: 'Chemistry',
    papers: [
      {
        name: 'Paper II (Essay)',
        parts: [
          {
            name: 'Part A',
            total_questions: 4,
            answer_required: 4,
            marks_per_question: 25,
            description:
              'ALL 4 structured questions are compulsory. Each is worth 25 marks. Total = 100 marks.',
          },
          {
            name: 'Part B',
            total_questions: 5,
            answer_required: 3,
            marks_per_question: 100,
            description:
              'Student answers 3 questions out of 5 essay-type questions. Each is worth 100 marks. If more than 3 are answered, count only the BEST 3 scoring answers. Total = 300 marks.',
          },
        ],
        selection_rule:
          'Total = Part A + best 3 of Part B. Scaled to 100 for final grade.',
      },
    ],
    special_notes:
      'Equations must be balanced for full equation marks. Structural diagrams must be correct; partial credit only if specified in the marking scheme.',
  },

  // -----------------------------------------------------------------------
  // Biology — Paper II (Essay)
  // Part A: 4 structured essay, ALL compulsory
  // Part B: 3 questions, student answers best 2
  // -----------------------------------------------------------------------
  'Biology': {
    subject: 'Biology',
    papers: [
      {
        name: 'Paper II (Essay)',
        parts: [
          {
            name: 'Part A',
            total_questions: 4,
            answer_required: 4,
            marks_per_question: 36,
            description:
              'ALL 4 structured essay questions are compulsory. Each is marked out of the points specified in the marking scheme (typically 36 points each). Total = 144 points.',
          },
          {
            name: 'Part B',
            total_questions: 3,
            answer_required: 2,
            marks_per_question: 100,
            description:
              'Student answers 2 questions out of 3 essay questions. Each is worth 100 marks. If more than 2 are answered, count the BEST 2 scoring answers.',
          },
        ],
        selection_rule:
          'Total = Part A (144 points) + best 2 of Part B (200 marks). Refer to scheme for conversion to final mark.',
      },
    ],
    special_notes:
      'Diagrams: fully labelled correct diagram = full marks; unlabelled = 0 marks as specified. Accept scientifically equivalent alternatives where noted in the scheme.',
  },

  // -----------------------------------------------------------------------
  // Economics — Paper II (Essay)
  // Part A: 4 structured, ALL compulsory
  // Part B: 5 questions, student answers best 3
  // -----------------------------------------------------------------------
  'Economics': {
    subject: 'Economics',
    papers: [
      {
        name: 'Paper II (Essay)',
        parts: [
          {
            name: 'Part A',
            total_questions: 4,
            answer_required: 4,
            marks_per_question: 25,
            description:
              'ALL 4 structured essay questions are compulsory. Each is worth 25 marks. Total = 100 marks.',
          },
          {
            name: 'Part B',
            total_questions: 5,
            answer_required: 3,
            marks_per_question: 100,
            description:
              'Student answers 3 questions out of 5. Each is worth 100 marks. If more than 3 are answered, count only the BEST 3 scoring answers.',
          },
        ],
        selection_rule:
          'Total = Part A + best 3 of Part B. Scaled to 100 for final grade.',
      },
    ],
    special_notes:
      'Diagrams (demand/supply curves, etc.) must be correctly labelled. Accept equivalent economic reasoning if it arrives at the correct conclusion.',
  },

  // -----------------------------------------------------------------------
  // Business Studies — Paper II (Essay)
  // Part A: 4 structured, ALL compulsory
  // Part B: 5 questions, student answers best 3
  // -----------------------------------------------------------------------
  'Business Studies': {
    subject: 'Business Studies',
    papers: [
      {
        name: 'Paper II (Essay)',
        parts: [
          {
            name: 'Part A',
            total_questions: 4,
            answer_required: 4,
            marks_per_question: 25,
            description:
              'ALL 4 structured questions are compulsory. Each is worth 25 marks. Total = 100 marks.',
          },
          {
            name: 'Part B',
            total_questions: 5,
            answer_required: 3,
            marks_per_question: 100,
            description:
              'Student answers 3 questions out of 5. Each is worth 100 marks. If more than 3 are answered, count only the BEST 3 scoring answers.',
          },
        ],
        selection_rule:
          'Total = Part A + best 3 of Part B. Scaled to 100 for final grade.',
      },
    ],
    special_notes:
      'Accept correct business terminology equivalents. Case study questions: marks are tied to applying concepts to the given scenario, not generic definitions alone.',
  },
};

// ---------------------------------------------------------------------------
// Language instructions — generate feedback in the correct script
// ---------------------------------------------------------------------------

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  sinhala: `
<language_rules>
- The student has written their answers in Sinhala script.
- Use the marking scheme context to resolve ambiguous handwritten characters — the expected vocabulary from the scheme helps identify unclear letters.
- Generate ALL feedback, student_answer_text examiner notes, and general_feedback in Sinhala Unicode script (සිංහල).
- Do NOT switch to English or Tamil in any output field.
- If handwriting is unclear to the point where the answer cannot be interpreted even with scheme guidance, set ocr_confidence to "low" for that question and note what was unclear.
</language_rules>`,

  tamil: `
<language_rules>
- The student has written their answers in Tamil script.
- Use the marking scheme context to resolve ambiguous handwritten characters — the expected vocabulary from the scheme helps identify unclear letters.
- Generate ALL feedback, student_answer_text examiner notes, and general_feedback in Tamil script (தமிழ்).
- Do NOT switch to English or Sinhala in any output field.
- If handwriting is unclear, set ocr_confidence to "low" and note what was unclear.
</language_rules>`,

  english: `
<language_rules>
- The student has written their answers in English.
- Generate ALL feedback, student_answer_text examiner notes, and general_feedback in English.
- If handwriting is unclear, set ocr_confidence to "low" and note what was unclear.
</language_rules>`,
};

// ---------------------------------------------------------------------------
// Zod output schema — guarantees valid JSON from Claude
// ---------------------------------------------------------------------------

export const markingResultSchema = z.object({
  paper_name: z.string(),
  questions: z.array(
    z.object({
      part: z.string(),
      question_no: z.number(),
      max_marks: z.number(),
      awarded_marks: z.number(),
      student_answer_text: z.string().optional(),
      feedback: z.string(),
      ocr_confidence: z.enum(['high', 'low']),
      sub_questions: z.array(
        z.object({
          label: z.string(),
          max_marks: z.number(),
          awarded_marks: z.number(),
          feedback: z.string(),
        })
      ).optional(),
    })
  ),
  best_questions_selected: z.array(z.number()).optional(),
  total_awarded: z.number(),
  total_max: z.number(),
  general_feedback: z.string(),
});

export type MarkingResult = z.infer<typeof markingResultSchema>;

/** Pre-built output format for Claude API — reused across all dispatch calls */
export const markingOutputFormat = zodOutputFormat(markingResultSchema);

// ---------------------------------------------------------------------------
// System prompt builder — specific, structured, unambiguous
// ---------------------------------------------------------------------------

function buildPartInstructions(subject: string, paperName?: string): string {
  const config = SUBJECT_CONFIGS[subject];
  if (!config) {
    return `This is a general essay paper. Mark each question according to the marking scheme provided.`;
  }

  const lines: string[] = [`<paper_structure subject="${subject}">`];

  // When paperName is specified, only include the matching paper's structure.
  // This prevents the AI from being confused by multiple paper descriptions.
  const papersToShow = paperName
    ? config.papers.filter((p) => p.name === paperName)
    : config.papers;

  for (const paper of papersToShow) {
    lines.push(`  <paper name="${paper.name}">`);
    lines.push(`    <selection_rule>${paper.selection_rule}</selection_rule>`);
    for (const part of paper.parts) {
      lines.push(`    <part name="${part.name}">`);
      lines.push(`      <total_questions>${part.total_questions}</total_questions>`);
      lines.push(`      <must_answer>${part.answer_required}</must_answer>`);
      lines.push(`      <marks_per_question>${part.marks_per_question}</marks_per_question>`);
      lines.push(`      <rule>${part.description}</rule>`);
      lines.push(`    </part>`);
    }
    lines.push(`  </paper>`);
  }

  lines.push(`  <special_notes>${config.special_notes}</special_notes>`);
  lines.push(`</paper_structure>`);

  return lines.join('\n');
}

export function buildSystemPrompt(
  subject: string,
  medium: string,
  markingSchemeText: string,
  paperName?: string,
): string {
  const langInstructions = LANGUAGE_INSTRUCTIONS[medium] ?? LANGUAGE_INSTRUCTIONS.english;
  const partInstructions = buildPartInstructions(subject, paperName);

  return `You are an expert Sri Lanka G.C.E. Advanced Level ${subject} examiner with 15+ years of marking experience.
You are marking handwritten student answer scripts using an official tutor-provided marking scheme.

${langInstructions}

<marking_rules>
1. Read the FULL handwritten paper from top to bottom before assigning any marks.
2. Identify each question by its number and part (Part A / Part B).
3. Match each student answer to the corresponding question in the marking scheme.
4. Award marks strictly based on the marking scheme — do not award marks for correct content that is not in the scheme unless the scheme explicitly says "accept equivalent answers".
5. For BEST-N selection questions: mark ALL answered questions, then select the best N. Note which were selected in best_questions_selected.
6. If a student crossed out an answer and rewrote it, mark ONLY the final rewritten version.
7. For sub-questions (e.g. (a)(i), (a)(ii)): fill the sub_questions array with individual marks. Sum them for the question total. For Combined Maths Part A, populating sub_questions is MANDATORY — every Part A question must have a sub_questions array showing each sub-part score and feedback. Never output a bare awarded_marks total for a Part A question without the breakdown.
8. For diagrams or equations: award full diagram/equation marks only if fully labelled/balanced as required by the scheme.
9. Quote the specific marking scheme criterion you used when awarding or withholding marks in the feedback field.
10. Part A blank pages: if a Part A question page appears blank, still include it with awarded_marks = 0 (per Rule 13 — all 10 Part A questions must appear). Part B blank pages: if a Part B question page is blank, exclude it entirely (per Rule 18). NEVER let a blank page cause you to include a Part B question that has no visible student writing.
11. Express uncertainty explicitly: if you cannot read a word or symbol, say so in the feedback and set ocr_confidence to "low".
12. CRITICAL — Do NOT hallucinate. Never describe, quote, or evaluate student work that is not visibly written in the script. If you cannot clearly see that the student wrote something, do not mention it at all. Uncertainty about legibility → set ocr_confidence to "low" and describe what was unclear, not what you assume it might say.
13. For Combined Maths Part A: ALL 10 questions MUST appear in the output questions array, even if the student left the answer blank. Set awarded_marks = 0 for unattempted questions. Never omit a Part A question. NOTE: This rule applies ONLY to Part A — Part B questions that were not attempted must NOT appear in the output.
14. The max_marks field MUST exactly match the paper structure. For Combined Maths: Part A questions max_marks = 25, Part B questions max_marks = 150. Never output 10 or any other value for max_marks.
15. Write feedback addressing the student directly. Focus EXCLUSIVELY on errors, omissions, and missed marks — do NOT mention what the student did correctly (the marks awarded already communicate that). For every mark deducted, state: (1) exactly what was wrong or missing, (2) the specific scheme criterion not met (e.g. 'per scheme step 3b'), (3) the correct answer or method per the scheme. Keep feedback concise and actionable.
16. NEVER write a feedback field without tracing it to a specific marking scheme criterion. Use the format: 'per scheme [criterion/step reference]'. If the scheme uses numbered steps, cite the step number. If the scheme uses lettered criteria, cite the letter.
17. Before awarding marks, confirm the question number by cross-referencing the handwritten number with the paper structure. If the question number is ambiguous, state: 'Question number unclear — assumed Q[N] based on position' in the feedback field.
18. Part B attendance: ONLY include Part B questions where the student has written visible work on the script. If a Part B question page is blank, shows only the question number, or has been crossed out without any rewrite, exclude it entirely from the output. Do NOT generate feedback for unattempted Part B questions. Violating this rule by fabricating reviews for unwritten questions is a critical error. THIS RULE APPLIES AT THE SUB-PART LEVEL TOO: if a student attempted Q17 but only wrote answers for parts (a) and (c), your sub_questions array MUST contain ONLY entries for (a) and (c) — never generate a sub_questions entry for a sub-part where no student writing is visible on the page.
</marking_rules>

${partInstructions}

<marking_scheme>
${markingSchemeText.trim()
  ? markingSchemeText
  : 'The marking scheme is provided as a PDF document in the user message (the first document block). Read it thoroughly before awarding any marks. Apply marks EXACTLY as the scheme specifies — do not invent or assume criteria not written in the scheme.'}
</marking_scheme>

Your output must be valid JSON matching the required schema. Do not include any text outside the JSON.`;
}

// ---------------------------------------------------------------------------
// User message text builder — the per-paper instruction
// Returns plain text only; the caller wraps it in a native PDF document block.
// ---------------------------------------------------------------------------

/**
 * Returns the 7-step instruction text for the user turn.
 * Kept separate from document construction so batch-dispatcher.ts
 * can embed it alongside the native PDF document block.
 */
/**
 * Builds the system prompt for the triage (attendance scan) pass.
 * This is a lightweight Claude call with no marking scheme — just scans the
 * student PDF to produce a JSON list of which questions and sub-parts were attempted.
 * The triage result is fed back into the marking call as an attendance constraint.
 */
export function buildTriagePrompt(): string {
  return `You are scanning a handwritten Sri Lanka A/L Combined Maths answer script.
Your ONLY task is to produce a JSON attendance list — do NOT mark or evaluate anything.

<triage_rules>
1. Scan every page of the PDF from front to back.
2. For each question number where you see handwritten mathematical work, record it.
3. For Part A questions (Q1–Q10): record which sub-parts have visible student writing (e.g. "(a)", "(b)", "(c)", "(d)", "(e)"). If all sub-parts are clearly present and have writing, write "all".
4. For Part B questions (Q11–Q17): ONLY list a question if the student has genuinely written mathematical work (not just the printed question number or a blank page). Record only the sub-parts (e.g. "(a)", "(b)") where the student has actually written working.
5. If a page is blank or has only the printed question number with no handwritten working, do NOT include that question or sub-part.
6. If you cannot clearly determine a question number, skip it rather than guessing.
</triage_rules>

Output ONLY valid JSON in this exact format — no other text:
{
  "part_a": [
    { "question_no": 1, "sub_parts": "all" },
    { "question_no": 2, "sub_parts": ["(a)", "(b)", "(c)"] }
  ],
  "part_b": [
    { "question_no": 11, "sub_parts": ["(a)"] },
    { "question_no": 14, "sub_parts": ["(a)", "(b)"] },
    { "question_no": 17, "sub_parts": ["(a)", "(c)"] }
  ]
}`;
}

export function buildUserMessageText(subject: string, paperName?: string): string {
  const paperLabel = paperName ? ` — ${paperName}` : '';
  return `The student answer script above (Document 2) is the handwritten Sri Lanka A/L ${subject}${paperLabel} paper to mark.
Mark Document 2 against the official marking scheme (Document 1). Do NOT evaluate Document 1 — it contains only model answers.

Step 1: Scan each page of the student answer script (Document 2) and identify all question numbers attempted by the student.
Step 2: For each question found, note any key working, formula, or phrase the student wrote that is directly relevant to the mark decision (brief examiner reference only — do NOT transcribe the full answer into student_answer_text).
Step 3: Compare the student's handwritten answer against the marking scheme criteria in Document 1.
Step 4: Award marks per sub-section as defined in the scheme. Sum sub-marks for the question total.
Step 5: Apply the best-N selection rule if applicable for this subject's Part B.
Step 6: Write specific feedback per question citing the marking scheme criterion awarded or missed.
Step 7: Output the final JSON result.`;
}
