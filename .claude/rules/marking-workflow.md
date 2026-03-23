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

UI: `BulkUploader.tsx` component (rendered in `BatchDetail.tsx` when batch status is `pending`) provides drag-and-drop PDF upload with client-side validation (PDF only, 20MB max, 50 files max).

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

UI: `BatchDetail.tsx` shows a 'Mark Papers' button when `batch.status === 'pending'` and submissions exist. Dispatching is blocked with a 400 error if `batch.status !== 'pending'` (double-dispatch prevention). On 402 errors, an `UpgradeModal` is shown.

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

UI: `useBatchPolling` hook (15s refresh) is wired into `BatchDetail.tsx`. Progress text shows marked/total count during processing. On completion, `useEffect` triggers `mutate()` to refresh batch and submission data.

### Step 5.5: Fetch Batch Marking Results
`GET /api/batches/[id]/results` → returns all marking results for all submissions in the batch.
Joins `marking_results` through `submissions` where `submissions.batch_id = batchId`.
Includes override fields: `tutor_override`, `override_marks`, `override_feedback`.
Used by `SubmissionResultsPanel.tsx` in `BatchDetail.tsx` to display expandable results.
Checks batch ownership via `getBatchById(id, user.id)` before returning data.

### Step 6: Tutor Review
Tutor reviews batch results via expandable rows in `BatchDetail.tsx`:
- Each marked submission has a "View Results" button that expands `SubmissionResultsPanel.tsx`
- `GET /api/batches/[id]/results` retrieves all marking results for the batch
- `SubmissionResultsPanel` renders `MarkingSummary` (total + override-adjusted marks) and `QuestionFeedbackCard` per question
- `QuestionFeedbackCard` shows: question number, student answer (OCR), AI-awarded marks, feedback, with language-aware fonts
- Tutor can click "Edit" on any question to override marks and feedback
- `PATCH /api/submissions/[id]/override` saves `result_id`, `override_marks`, `override_feedback` to `marking_results`
- Override display: "Edited" badge, override values shown instead of AI values, `MarkingSummary` shows "Includes tutor adjustments"

### Step 7: Approve & Download Report (IMPLEMENTED)
Tutor approves via `POST /api/reports/[submissionId]/approve`, then downloads via `GET /api/reports/[submissionId]/download`:
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
