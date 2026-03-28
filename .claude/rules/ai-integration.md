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

The system prompt (cached) contains:
1. Role: "You are an expert Sri Lankan A/L {subject} examiner"
2. Marking scheme full text (parsed from PDF or RAG-retrieved chunks)
3. Language instruction (see below)
4. Marking guidance (no JSON format — structured outputs handle that)

The user message (per student, variable) contains:
1. Native PDF document block (`type: 'document'`, `media_type: 'application/pdf'`, base64-encoded)
2. Instruction to mark the paper

### Language Instructions by Medium
```typescript
const LANGUAGE_INSTRUCTIONS = {
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
```

### Required JSON Output Schema
Enforced via Zod schema + structured outputs (`output_config.format`). No JSON examples in prompt needed.
`ocr_confidence` is `z.enum(['high', 'low'])` — matches DB CHECK constraint. `saveMarkingResults` also sanitizes as defense-in-depth.
```json
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
}
```

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

1. **Phase 1 — `prepareMarking(batchId, tutorId)`** (awaited): Validates billing, deducts minutes, loads context. Errors are caught and returned to the client.
2. **Phase 2 — `executeMarking(batchId, pendingSubmissions, systemPromptText)`** (fire-and-forget): Runs marking in background. The client gets `{ status: 'processing' }` immediately.

```typescript
// app/api/batches/[id]/dispatch/route.ts
const { pendingSubmissions, systemPromptText } = await prepareMarking(batchId, user.id);
executeMarking(batchId, pendingSubmissions, systemPromptText).catch(console.error);
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
