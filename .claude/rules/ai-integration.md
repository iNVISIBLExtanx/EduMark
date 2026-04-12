# Claude AI Integration

## Model
`claude-sonnet-4-6` — used for all marking tasks.

## Key Files
- `lib/ai/claude-client.ts` — Anthropic SDK singleton
- `lib/ai/mark-paper.ts` — prompt builder + response parser  
- `lib/ai/batch-dispatcher.ts` — Batch API job submission
- `lib/ai/embeddings.ts` — OpenAI embeddings + pgvector RAG
- `lib/ai/chunking.ts` — marking scheme text chunking for embeddings
- `lib/ai/openai-client.ts` — OpenAI SDK singleton (lazy-init proxy pattern)

---

## Token Optimization Strategy (ALWAYS apply all three)

### 1. Prompt Caching
The marking scheme system block MUST use `cache_control`. This is the static prefix shared across all papers in a batch.

- **Both modes**: `cache_control: { type: 'ephemeral', ttl: '1h' }` — 1-hour TTL used in both direct and Batch API modes. Combined Maths papers take 3-8 min each, so a 10-paper direct batch can span ~50 min — the default 5-min TTL would cause cache misses mid-batch.

### 2. Structured Outputs
All marking calls use `output_config.format` with `zodOutputFormat()` from `@anthropic-ai/sdk/helpers/zod`. This guarantees valid JSON matching the Zod schema at the inference level — no JSON instructions needed in the prompt.

```typescript
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
export const markingOutputFormat = zodOutputFormat(markingResultSchema);
// Used as: output_config: { format: markingOutputFormat }
```

### 3. Batch API + Direct Streaming
- **≤10 papers**: Direct streaming via `anthropic.messages.stream()` + `stream.finalMessage()`. Streaming is required by the SDK for requests that may take >10 minutes (large PDFs + high max_tokens).
- **>10 papers**: Batch API via `anthropic.beta.messages.batches.create()`. 50% discount on top of caching.

### Max Output Tokens
`MAX_OUTPUT_TOKENS = 32000` — set high for Sinhala/Tamil which use ~2-3x more tokens than English.

---

## Marking Prompt Structure

### Two-Pass Marking (Triage + Mark) — Combined Maths

For Combined Maths, each paper goes through **two Claude calls** before marking results are saved:

**Pass 1 — Triage** (`triagePaper(pdfBuffer)` in `lib/ai/batch-dispatcher.ts`):
- Lightweight call: student PDF only, no marking scheme
- System prompt: `buildTriagePrompt()` in `lib/ai/mark-paper.ts` — scans the paper and produces a JSON attendance list of which questions and sub-parts the student actually attempted
- Output: `{ part_a: [{question_no, sub_parts}], part_b: [{question_no, sub_parts}] }`
- Non-fatal: if triage fails, marking proceeds without triage context (graceful degradation)
- Subjects requiring triage: `TRIAGE_SUBJECTS = new Set(['Combined Maths'])` in `lib/ai/batch-dispatcher.ts`

**Pass 2 — Mark** (existing marking call):
- Triage result is injected into the user message as an `<attendance_triage>` block
- Claude is constrained: only output results for questions/sub-parts in the triage list
- This prevents hallucination of unattempted questions and sub-parts

```typescript
// In dispatchDirect (and dispatchBatchAPI):
let userMessageText = buildUserMessageText(subject, paperName);
if (TRIAGE_SUBJECTS.has(subject)) {
  const triage = await triagePaper(pdfBuffer); // cheap scan, no scheme
  if (triage) {
    userMessageText += `\n\n<attendance_triage>CRITICAL — pre-scan identified EXACTLY these questions...\n${triageContext}\n</attendance_triage>`;
  }
}
```

### System Prompt (cached) — `buildSystemPrompt(subject, medium, schemeText, paperName?)`
XML-structured, subject-aware prompt in `lib/ai/mark-paper.ts`:
1. Role: "You are an expert Sri Lanka G.C.E. Advanced Level {subject} examiner"
2. `<language_rules>` — language-specific feedback instructions (see below)
3. `<marking_rules>` — 18 explicit rules (read full paper first, Part A/B identification, BEST-N selection, sub-questions, OCR confidence, no hallucination, rule 10: Part A blanks → include with 0 marks; Part B blanks → exclude (no Rule 10/18 contradiction), rule 13: all 10 Combined Maths Part A questions must appear, rule 14: max_marks must match structure, rule 18: Part B attendance applies at question AND sub-part level)
4. `<paper_structure subject="...">` — generated from `SUBJECT_CONFIGS` via `buildPartInstructions(subject, paperName)` (see below)
5. `<marking_scheme>` — full scheme text from `structure_json`

### Subject Configs (`SUBJECT_CONFIGS` in `lib/ai/mark-paper.ts`)
6 subjects with per-paper structure awareness:

| Subject | Part A | Part B |
|---------|--------|--------|
| Combined Maths | 10 questions, ALL compulsory, 25 marks each | 7 questions, answer BEST 5, 150 marks each |
| Physics | 4 structured questions, ALL compulsory, 20 marks each | 4 structured questions, ALL compulsory, 30 marks each |
| Chemistry | 4 structured questions, ALL compulsory, 25 marks each | 5 questions, answer BEST 3, 100 marks each |
| Biology | 4 structured essay, ALL compulsory, 36 marks each | 3 questions, answer BEST 2, 100 marks each |
| Economics | 4 structured, ALL compulsory, 25 marks each | 5 questions, answer BEST 3, 100 marks each |
| Business Studies | 4 structured, ALL compulsory, 25 marks each | 5 questions, answer BEST 3, 100 marks each |

**Combined Maths `selection_rule` rule**: Must state raw marks explicitly — do NOT include any `/ 10` division arithmetic. The AI interprets division expressions as per-question mark scaling. The rule must say: "Output raw awarded_marks. Part A max_marks = 25 each, Part B max_marks = 150 each." The marking_rules block includes 18 explicit rules: rules 13–14 are Combined Maths-specific (all 10 Part A questions MUST appear; max_marks must match structure exactly); rules 15–18 cover feedback format (error-only — no praise, marks awarded communicate correctness), scheme citation requirement, question number confirmation, and Part B attendance (exclude unattempted Part B questions AND sub-parts entirely). Rule 10 explicitly disambiguates blank-page handling: Part A blanks → include with awarded_marks=0; Part B blanks → exclude entirely (previously Rule 10 and Rule 18 contradicted each other, causing false Part B inclusions).

**Part A mark rounding**: `sanitizeMarkingResult` rounds Combined Maths Part A `awarded_marks` to the nearest multiple of 5 (valid values: 0, 5, 10, 15, 20, 25 — each Part A sub-question is worth 5 marks). Any AI-output value like 22 is rounded to 20.

**`paper_name` is REQUIRED for Combined Maths dispatch.** If `paper_name` is not stored on the batch yet, `BatchDetail.tsx` prompts the tutor to select 'Pure (Paper I)' or 'Applied (Paper II)' before enabling the dispatch button. The selected value is sent as `paper_name` in the POST body to the dispatch route.

`paperName` (e.g. `'Pure (Paper I)'`, `'Applied (Paper II)'`) is passed as optional 4th arg. `buildSystemPrompt` passes it to `buildPartInstructions(subject, paperName)`, which **filters the `<paper_structure>` XML to only the matching paper** — preventing Claude from being confused by seeing both Pure I and Applied II structure simultaneously. Without `paperName`, all papers for the subject are emitted (backward-compatible for non-Combined-Maths subjects).

**CRITICAL — Supabase FK join shape**: Supabase returns many-to-one FK joins as **single objects**, NOT arrays. `getQuestionPaperById` returns `subjects` as `{ name, code }`, not `[{ name, code }]`. Accessing `subjects?.[0]?.name` always returns `undefined`. Always use `subjects?.name`:
```typescript
// CORRECT — single-object FK join
const subjects = (paper as unknown as { subjects?: { name: string } }).subjects;
const subjectName = subjects?.name ?? 'General';

// WRONG — [0] always undefined on Supabase many-to-one joins
const subjects = (paper as unknown as { subjects?: { name: string }[] }).subjects;
const subjectName = subjects?.[0]?.name ?? 'General';  // ← always 'General'!
```
This applies to ALL nested FK joins in Supabase responses. The same bug exists in `pollBatchResults` where `batch.question_papers?.subjects?.name` is the correct pattern (not `[0]?.subjects?.[0]?.name`).

### Post-Parse Sanitization — `sanitizeMarkingResult(result, subject)`

After `markingResultSchema.parse()` in both `dispatchDirect` and `pollBatchResults`, call:

```typescript
const parsed = sanitizeMarkingResult(markingResultSchema.parse(JSON.parse(text)), subject);
```

For `subject === 'Combined Maths'` only:
- Corrects wrong `max_marks`: Part A questions → 25, Part B questions → 150 (infers from `part` field; falls back to question_no ≤10 = Part A)
- Recomputes `best_questions_selected`: top-5 Part B questions by `awarded_marks` descending
- Recomputes `total_awarded`: sum(Part A awarded) + sum(best-5 Part B awarded)
- Recomputes `total_max`: always `10 * 25 + 5 * 150 = 1000` — Combined Maths paper structure is fixed regardless of how many Part B questions the student attempted (a student answering only 4 Part B questions still has total_max = 1000, not 850)

For all other subjects: returns result unchanged.

**`paper_name` override**: After sanitization, both `dispatchDirect` and `pollBatchResults` override the Claude-returned `paper_name` with the authoritative batch value. Claude sometimes invents its own paper name — the batch's stored `paper_name` (set by the tutor) is always the ground truth:
```typescript
const sanitized = sanitizeMarkingResult(parsed, subject);
const result = paperName ? { ...sanitized, paper_name: paperName } : sanitized;
```

### User Message — `buildUserMessageText(subject, paperName?)`
Returns 7-step instruction text used alongside the native PDF document block:
```
Step 1: Scan all pages and identify all question numbers attempted.
Step 2: Transcribe each student answer into student_answer_text.
Step 3: Compare against marking scheme criteria.
Step 4: Award marks per sub-section, summing for the question total.
Step 5: Apply best-N selection rule if applicable (Part B).
Step 6: Write specific feedback per question citing the criterion awarded or missed.
Step 7: Complete the JSON output with all required fields.
```
**Note**: This function only returns text. The caller (`batch-dispatcher.ts`) wraps it alongside the native PDF document block — no image conversion.

### Language Instructions by Medium
```typescript
const LANGUAGE_INSTRUCTIONS = {
  sinhala: `Generate ALL feedback in Sinhala Unicode script (සිංහල). Write student_answer_text as a brief examiner note summarising what the student wrote, also in Sinhala. Set ocr_confidence to "low" if the handwriting is unclear.`,
  tamil:   `Generate ALL feedback in Tamil script (தமிழ்). Write student_answer_text as a brief examiner note summarising what the student wrote, also in Tamil. Set ocr_confidence to "low" if the handwriting is unclear.`,
  english: `Generate ALL feedback in English. Write student_answer_text as a brief examiner note summarising what the student wrote. Set ocr_confidence to "low" if the handwriting is unclear.`,
};
```

### Required JSON Output Schema (`markingResultSchema`)
Enforced via Zod schema + structured outputs (`output_config.format`). No JSON examples in prompt needed.
`ocr_confidence` is `z.enum(['high', 'low'])` — matches DB CHECK constraint. `saveMarkingResults` also sanitizes as defense-in-depth.
```json
{
  "paper_name": "Pure (Paper I)",
  "questions": [
    {
      "part": "Part A",
      "question_no": 1,
      "max_marks": 10,
      "awarded_marks": 7,
      "student_answer_text": "...",
      "feedback": "...",
      "ocr_confidence": "high",
      "sub_questions": [
        { "label": "(a)(i)", "max_marks": 4, "awarded_marks": 3, "feedback": "..." }
      ]
    }
  ],
  "best_questions_selected": [1, 3, 5, 6, 7],
  "total_awarded": 7,
  "total_max": 10,
  "general_feedback": "..."
}
```
- `part`: required string (empty string `''` for subjects with no part structure)
- `sub_questions`: optional array for sub-part breakdowns like `(a)(i)`, `(a)(ii)`
- `best_questions_selected`: optional array of question numbers chosen in BEST-N selection (Combined Maths Part B)

---

## RAG: Marking Scheme Retrieval

When generating the system prompt, retrieve relevant chunks from pgvector for each question:

```typescript
// lib/ai/embeddings.ts
export async function retrieveMarkingCriteria(schemeId: string, questionText: string) {
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: questionText,
  });

  const { data } = await supabase.rpc('match_marking_criteria', {
    scheme_id: schemeId,
    query_embedding: embedding.data[0].embedding,
    match_count: 5,
  });
  return data;
}
```

The `match_marking_criteria` Postgres function uses `<=>` cosine distance on the `ms_embeddings` table.

---

## Batch Dispatcher (lib/ai/batch-dispatcher.ts) — IMPLEMENTED

### Two-Phase Dispatch Pattern

The dispatch route uses a two-phase pattern for responsive UX:

1. **Phase 1 — `prepareMarking(batchId, tutorId)`** (awaited): Validates billing, deducts minutes, loads context. Returns `{ batch, pendingSubmissions, systemPromptText, subject, paperName }`. Errors are caught and returned to the client.
2. **Phase 2 — `executeMarking(batchId, pendingSubmissions, systemPromptText, subject, paperName?)`** (fire-and-forget): Runs marking in background. The client gets `{ status: 'processing' }` immediately.

```typescript
// app/api/batches/[id]/dispatch/route.ts
const { pendingSubmissions, systemPromptText, subject, paperName } = await prepareMarking(batchId, user.id);
executeMarking(batchId, pendingSubmissions, systemPromptText, subject, paperName).catch(console.error);
return NextResponse.json({ status: 'processing' });
```

### Dispatch Modes
- **≤10 papers (direct)**: `anthropic.messages.stream()` + `stream.finalMessage()` per paper. Results saved immediately.
- **>10 papers (Batch API)**: `anthropic.beta.messages.batches.create()`. Results retrieved via polling.

Both modes use `output_config: { format: markingOutputFormat }` for structured outputs and check `stop_reason === 'max_tokens'` before parsing.

### `pollBatchResults(batchId, tutorId)`

```typescript
export async function pollBatchResults(batchId: string, tutorId: string): Promise<PollResult> {
  const batch = await getBatchById(batchId, tutorId);

  // Guard: don't re-process finalized batches
  if (batch.status === 'completed' || batch.status === 'failed') {
    return { status: batch.status, marked: batch.marked_papers, total: batch.total_papers };
  }

  // Direct marking (no Batch API) — return current DB status
  if (!batch.claude_batch_id) {
    if (batch.status === 'processing') {
      return { status: 'processing', marked: batch.marked_papers, total: batch.total_papers };
    }
    throw new Error('batch_not_dispatched');
  }

  // Check Anthropic Batch API status
  const batchJob = await anthropic.beta.messages.batches.retrieve(batch.claude_batch_id);
  if (batchJob.processing_status !== 'ended') {
    return { status: 'processing', marked: batch.marked_papers, total: batch.total_papers };
  }

  // Iterate async results, parse JSON via Zod, save to marking_results
  // ...
}
```

---

## Polling Route
- `GET /api/batches/[id]/poll` — calls `pollBatchResults(batchId, user.id)`
- Frontend: `useBatchPolling` SWR hook polls this endpoint every 15 seconds
- Returns `{ status: 'processing' | 'completed' | 'failed', marked, total }`
