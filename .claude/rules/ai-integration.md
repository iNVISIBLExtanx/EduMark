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

## Batch Dispatcher Pattern

```typescript
// lib/ai/batch-dispatcher.ts
export async function dispatchMarkingBatch(batchId: string) {
  const { submissions, scheme, subject, medium } = await loadBatchContext(batchId);
  const markingSchemeText = await buildMarkingSchemeContext(scheme.id);

  const requests = await Promise.all(submissions.map(async (sub) => {
    const images = await pdfToImages(sub.pdf_url);
    return {
      custom_id: sub.id,
      params: {
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: [{ type: 'text', text: buildSystemPrompt(subject, medium, markingSchemeText),
                   cache_control: { type: 'ephemeral' } }],
        messages: [{
          role: 'user',
          content: [
            ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } })),
            { type: 'text', text: 'Mark this paper per the scheme. Return JSON only.' }
          ]
        }]
      }
    };
  }));

  const batch = await anthropic.beta.messages.batches.create({ requests });
  // Save batch.id to DB, set status to 'processing'
  return batch.id;
}
```

---

## Polling Results
After dispatch, use a background polling mechanism:
- Frontend: `useBatchPolling` SWR hook polls `/api/batches/[id]/results` every 15 seconds
- API route checks `anthropic.beta.messages.batches.retrieve(claudeBatchId)` 
- When `processing_status === 'ended'`, stream results and save to `marking_results` table
