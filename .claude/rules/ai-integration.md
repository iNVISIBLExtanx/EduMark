# Claude AI Integration

## Model
`claude-sonnet-4-6` — used for all marking tasks.

## Key Files
- `lib/ai/claude-client.ts` — Anthropic SDK singleton
- `lib/ai/mark-paper.ts` — prompt builder + response parser  
- `lib/ai/batch-dispatcher.ts` — Batch API job submission
- `lib/ai/embeddings.ts` — OpenAI embeddings + pgvector RAG

---

## Token Optimization Strategy (ALWAYS apply all three)

### 1. Prompt Caching
The marking scheme system block MUST use `cache_control`. This is the static prefix shared across all papers in a batch.

- **Direct mode (≤10 papers)**: `cache_control: { type: 'ephemeral' }` — default 5-minute TTL
- **Batch API (>10 papers)**: `cache_control: { type: 'ephemeral', ttl: '1h' }` — 1-hour TTL for higher cache hit rate across batch processing

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

### System Prompt (cached) — `buildSystemPrompt(subject, medium, schemeText, paperName?)`
XML-structured, subject-aware prompt in `lib/ai/mark-paper.ts`:
1. Role: "You are an expert Sri Lanka G.C.E. Advanced Level {subject} examiner"
2. `<language_rules>` — language-specific feedback instructions (see below)
3. `<marking_rules>` — 12 explicit rules (read full paper first, Part A/B identification, BEST-N selection, sub-questions, OCR confidence, no hallucination, etc.)
4. `<paper_structure subject="...">` — generated from `SUBJECT_CONFIGS` (see below)
5. `<marking_scheme>` — full scheme text from `structure_json`

### Subject Configs (`SUBJECT_CONFIGS` in `lib/ai/mark-paper.ts`)
6 subjects with per-paper structure awareness:

| Subject | Part A | Part B |
|---------|--------|--------|
| Combined Maths | 10 questions, ALL compulsory, 25 marks each | 7 questions, answer BEST 5, 150 marks each |
| Physics | 50 MCQ | 6 structured essay questions, attempt all |
| Chemistry | Part A MCQ + structured | Part B essay |
| Biology | Part A compulsory | Part B optional questions |
| Economics | Section A + B | — |
| Business Studies | Section A + B | — |

**Combined Maths `selection_rule` rule**: Must state raw marks explicitly — do NOT include any `/ 10` division arithmetic. The AI interprets division expressions as per-question mark scaling. The rule must say: "Output raw awarded_marks. Part A max_marks = 25 each, Part B max_marks = 150 each." The marking_rules block also includes rule 13 (all 10 Part A questions MUST appear) and rule 14 (max_marks must exactly match scheme values).

**`paper_name` is REQUIRED for Combined Maths dispatch.** If `paper_name` is not stored on the batch yet, `BatchDetail.tsx` prompts the tutor to select 'Pure (Paper I)' or 'Applied (Paper II)' before enabling the dispatch button. The selected value is sent as `paper_name` in the POST body to the dispatch route.

`paperName` (e.g. `'Pure (Paper I)'`, `'Applied (Paper II)'`) is passed as optional 4th arg to refine the `<paper_structure>` block for Combined Maths.

### Post-Parse Sanitization — `sanitizeMarkingResult(result, subject)`

After `markingResultSchema.parse()` in both `dispatchDirect` and `pollBatchResults`, call:

```typescript
const parsed = sanitizeMarkingResult(markingResultSchema.parse(JSON.parse(text)), subject);
```

For `subject === 'Combined Maths'` only:
- Corrects wrong `max_marks`: Part A questions → 25, Part B questions → 150 (infers from `part` field; falls back to question_no ≤10 = Part A)
- Recomputes `best_questions_selected`: top-5 Part B questions by `awarded_marks` descending
- Recomputes `total_awarded`: sum(Part A awarded) + sum(best-5 Part B awarded)
- Recomputes `total_max`: (Part A count × 25) + (min(Part B count, 5) × 150)

For all other subjects: returns result unchanged.

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
  sinhala: `Generate ALL feedback in Sinhala Unicode script (සිංහල). Set ocr_confidence to "low" if unclear.`,
  tamil:   `Generate ALL feedback in Tamil script (தமிழ்). Set ocr_confidence to "low" if unclear.`,
  english: `Generate ALL feedback in English. Set ocr_confidence to "low" if unclear.`,
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
