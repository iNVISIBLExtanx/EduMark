# Marking Workflow & Batch Processing

## Full Workflow (step by step)

### Step 0: Upload Question Paper + Marking Scheme (together)
The marking scheme is **required** when uploading a question paper — Claude cannot mark without it.
`POST /api/question-papers` uploads the paper PDF, then `POST /api/marking-schemes` uploads the scheme PDF linked to the paper.
Both are uploaded in a single form submission in `QuestionPaperUploadForm.tsx`.

### Step 1: Create Batch
`POST /api/batches` → creates batch record with status `pending`, links to paper + scheme

### Step 2: Process Marking Scheme (embeddings)
`POST /api/marking-schemes/[id]/embeddings` → chunks scheme + generates OpenAI embeddings → stored in `ms_embeddings`

### Step 3: Bulk Upload Student Papers
`POST /api/submissions/upload` (multipart) → for each PDF:
- upload to `submissions/` bucket
- create `students` record
- create `submissions` record with status `pending`
Update `batches.total_papers = N`

### Step 3.5: List Submissions for a Batch
`GET /api/batches/[id]/submissions` → returns all submissions with nested student data.
Used by `useSubmissions` hook in `BatchDetail.tsx` to display the submissions table.
Checks batch ownership via `getBatchById(id, user.id)` before returning data.

### Step 4: Dispatch to Claude
`POST /api/batches/[id]/dispatch` → implemented in `lib/ai/batch-dispatcher.ts:dispatchMarkingBatch()`

Order of operations (billing BEFORE Claude):
1. `getBatchById(batchId, tutorId)` — verify ownership, get `paper_id`, `scheme_id`, `medium`
2. `getSubmissionsByBatch(batchId)` — filter to `pending` submissions only
3. `checkAndDeductMinutes(tutorId, pendingCount)` — billing gate BEFORE touching Claude
4. `updateBatchStatus(batchId, 'processing')`
5. Load marking scheme `structure_json` via `getMarkingSchemeById(scheme_id)`
6. Load paper via `getQuestionPaperById(paper_id, tutorId)` to get subject name
7. `buildSystemPrompt(subject, medium, schemeText)` — cached system block
8. For each submission: `getSubmissionPdfBuffer(pdf_url)` → `pdfToImages(buffer)` → base64 images
9. `anthropic.beta.messages.batches.create({ requests })` — single Batch API job, `custom_id = submission.id`
10. `updateBatchClaudeBatchId(batchId, claudeBatchId)` + update each submission to `processing`

The dispatch route also checks `isActive(billing)` and `hasMinutes(billing, totalPapers)` before calling the dispatcher, returning 402 with `{ error, available, needed }` if insufficient.

### Step 5: Poll & Store Results
`GET /api/batches/[id]/poll` (called by `useBatchPolling` hook every 15s) → implemented in `lib/ai/batch-dispatcher.ts:pollBatchResults()`

1. `getBatchById(batchId, tutorId)` — get `claude_batch_id` (throws if not dispatched)
2. `anthropic.beta.messages.batches.retrieve(claudeBatchId)` — check status
3. If `processing_status !== 'ended'`: return `{ status: 'processing', marked, total }`
4. If `processing_status === 'ended'`:
   - Iterate `anthropic.beta.messages.batches.results(claudeBatchId)` (async iterable)
   - For each `succeeded` result: parse JSON → `saveMarkingResults(submissionId, parsed)` → `updateSubmissionStatus(submissionId, 'marked')`
   - For failed results: `updateSubmissionStatus(submissionId, 'failed')`
   - `updateBatchMarkedPapers(batchId, markedCount)`
   - `updateBatchStatus(batchId, 'completed')` — or `'failed'` if all results failed
5. Return `{ status: 'completed' | 'failed', marked, total }`

### Step 6: Tutor Review
Tutor reviews each submission in `MarkingReview.tsx`:
- Sees each question: student answer, awarded marks, feedback
- Can override marks and feedback (saves to `override_marks`, `override_feedback`)
- `PATCH /api/submissions/[id]/override`

### Step 7: Approve & Download Report
Once tutor approves, `GET /api/reports/[submissionId]`:
1. Load marking results (using override values if set)
2. Render report HTML → Puppeteer → PDF
3. Upload to `reports/` bucket
4. Return signed download URL

## Status State Machine
```
Batch:      pending → uploading → processing → completed | failed
Submission: pending → processing → marked | failed
```

## Error Handling
- If any submission fails in Batch API, mark that submission `failed`, continue others
- Save raw Claude error to `submissions.claude_error` column
- Tutor can re-submit failed submissions individually
