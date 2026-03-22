# Claude AI Integration

## Model
`claude-sonnet-4-6` — used for all marking tasks.

## Key Files
- `lib/ai/claude-client.ts` — Anthropic SDK singleton
- `lib/ai/mark-paper.ts` — prompt builder + response parser  
- `lib/ai/batch-dispatcher.ts` — Batch API job submission
- `lib/ai/embeddings.ts` — OpenAI embeddings + pgvector RAG

---

## Token Optimization Strategy (ALWAYS apply both)

### 1. Prompt Caching
The marking scheme system block MUST use `cache_control`. This is the static prefix shared across all papers in a batch.

```typescript
// lib/ai/mark-paper.ts
const systemBlock = {
  type: 'text' as const,
  text: buildSystemPrompt(subject, medium, markingSchemeText),
  cache_control: { type: 'ephemeral' as const },  // ← REQUIRED
};
```

Cache TTL is 5 minutes — all papers in one batch MUST be dispatched in a single Batch API call within this window.

### 2. Batch API
All bulk marking jobs use `anthropic.beta.messages.batches.create()`. This gives 50% discount on top of caching. Never use standard `messages.create()` for marking jobs.

---

## Marking Prompt Structure

The system prompt (cached) contains:
1. Role: "You are an expert Sri Lankan A/L {subject} examiner"
2. Marking scheme full text (parsed from PDF or RAG-retrieved chunks)
3. Language instruction (see below)
4. Output format (strict JSON)

The user message (per student, variable) contains:
1. Array of base64 PNG images (one per PDF page)
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
Claude must return this exact shape (enforce with schema in prompt):
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

Two exported functions: `dispatchMarkingBatch` and `pollBatchResults`.

### `dispatchMarkingBatch(batchId, tutorId)`

Critical: billing deduction happens BEFORE any Claude API call.

```typescript
// Simplified flow — see lib/ai/batch-dispatcher.ts for full implementation
export async function dispatchMarkingBatch(batchId: string, tutorId: string): Promise<string> {
  const batch = await getBatchById(batchId, tutorId);
  const submissions = (await getSubmissionsByBatch(batchId)).filter(s => s.status === 'pending');
  if (submissions.length === 0) throw new Error('no_pending_submissions');

  await checkAndDeductMinutes(tutorId, submissions.length);  // billing FIRST
  await updateBatchStatus(batchId, 'processing');

  const scheme = await getMarkingSchemeById(batch.scheme_id);
  const paper = await getQuestionPaperById(batch.paper_id, tutorId);
  const subjectName = paper.subjects?.[0]?.name ?? 'General';
  const systemPromptText = buildSystemPrompt(subjectName, batch.medium, JSON.stringify(scheme.structure_json));

  const requests = await Promise.all(submissions.map(async (sub) => {
    const pdfBuffer = await getSubmissionPdfBuffer(sub.pdf_url);
    const { images } = await pdfToImages(pdfBuffer);
    return {
      custom_id: sub.id,
      params: {
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: [{ type: 'text', text: systemPromptText, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [
          ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } })),
          { type: 'text', text: 'Mark this paper per the scheme. Return JSON only.' },
        ]}],
      },
    };
  }));

  const batchJob = await anthropic.beta.messages.batches.create({ requests });
  await updateBatchClaudeBatchId(batchId, batchJob.id);
  return batchJob.id;
}
```

### `pollBatchResults(batchId, tutorId)`

```typescript
export async function pollBatchResults(batchId: string, tutorId: string): Promise<PollResult> {
  const batch = await getBatchById(batchId, tutorId);
  if (!batch.claude_batch_id) throw new Error('batch_not_dispatched');

  const batchJob = await anthropic.beta.messages.batches.retrieve(batch.claude_batch_id);
  if (batchJob.processing_status !== 'ended') {
    return { status: 'processing', marked: batch.marked_papers, total: batch.total_papers };
  }

  // Iterate async results, parse JSON, save to marking_results
  const results = await anthropic.beta.messages.batches.results(batch.claude_batch_id);
  for await (const result of results) {
    // Parse text block → saveMarkingResults() → updateSubmissionStatus('marked')
    // Failed results → updateSubmissionStatus('failed')
  }

  await updateBatchMarkedPapers(batchId, markedCount);
  await updateBatchStatus(batchId, finalStatus);  // 'completed' or 'failed'
  return { status: finalStatus, marked: markedCount, total: batch.total_papers };
}
```

---

## Polling Route
- `GET /api/batches/[id]/poll` — calls `pollBatchResults(batchId, user.id)`
- Frontend: `useBatchPolling` SWR hook polls this endpoint every 15 seconds
- Returns `{ status: 'processing' | 'completed' | 'failed', marked, total }`
