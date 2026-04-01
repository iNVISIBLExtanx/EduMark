# Marking Workflow & Batch Processing

## Full Workflow (step by step)

### Step 0: Upload Question Paper + Marking Scheme (together)
The marking scheme is **required** when uploading a question paper — Claude cannot mark without it.
`POST /api/question-papers` uploads the paper PDF, then `POST /api/marking-schemes` uploads the scheme PDF linked to the paper.
Both are uploaded in a single form submission in `QuestionPaperUploadForm.tsx`.

### Step 0.5: Delete Question Paper + Marking Scheme (optional)
`DELETE /api/question-papers/[id]` → deletes paper, its marking scheme, embeddings, and storage files.
- Blocked (409) if paper has associated batches — delete batches first.
- Cascade: deletes embeddings (`deleteEmbeddingsByScheme`), then scheme record (`deleteMarkingSchemeByPaper`), then storage files, then paper record.
- UI: Trash icon in `QuestionPaperList.tsx` with confirmation dialog.

### Step 1: Create Batch
`POST /api/batches` → creates batch record with status `pending`, links to paper + scheme

UI: "Create Batch" button in `BatchList.tsx` opens `CreateBatchDialog.tsx` with:
- Batch Name (text input)
- Question Paper (dropdown from `useQuestionPapers`, all papers have schemes since both are uploaded together)
- Medium (read-only, auto-derived from tutor's `marking_language` — not selectable)
- `scheme_id` is derived from the selected paper's `marking_schemes[0].id`
- On success: navigates to `/batches/{batch.id}`

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
`POST /api/batches/[id]/dispatch` → uses two-phase dispatch pattern for responsive UX.

**Phase 1 — `prepareMarking(batchId, tutorId)`** (awaited by the route):
1. `getBatchById(batchId, tutorId)` — verify ownership, get `paper_id`, `scheme_id`, `medium`, `paper_name`
2. `getSubmissionsByBatch(batchId)` — filter to `pending` submissions only
3. `checkAndDeductMinutes(tutorId, pendingCount)` — billing gate BEFORE touching Claude
4. Load marking scheme `structure_json` via `getMarkingSchemeById(scheme_id)`
5. Load paper via `getQuestionPaperById(paper_id, tutorId)` to get subject name — Supabase returns `subjects` as a **single object** (not array); use `subjects?.name`, never `subjects?.[0]?.name`
6. `buildSystemPrompt(subject, medium, schemeText, paperName)` — XML-structured, subject-aware cached system block; `paperName` is passed to `buildPartInstructions` to filter `<paper_structure>` to only the matching paper
7. Returns `{ batch, pendingSubmissions, systemPromptText, subject, paperName }`

**Phase 2 — `executeMarking(batchId, pendingSubmissions, systemPromptText, subject, paperName?)`** (fire-and-forget):
- **≤10 papers (direct)**: `anthropic.messages.stream()` + `stream.finalMessage()` per paper. `MAX_OUTPUT_TOKENS = 32000`. User message uses `buildUserMessageText(subject, paperName)` alongside native PDF document block. After parsing AI JSON, calls `sanitizeMarkingResult(parsed, subject)` before `saveMarkingResults()`.
- **>10 papers (Batch API)**: `anthropic.beta.messages.batches.create()`. 1-hour cache TTL. Same user message text. Same sanitization applied when processing results.
- Both paths use `output_config: { format: markingOutputFormat }` (structured outputs) and check `stop_reason === 'max_tokens'` before parsing.

**Combined Maths — paper_name is required**: For Combined Maths batches where `paper_name` is not yet stored on the batch, `BatchDetail.tsx` shows a paper selector ('Pure (Paper I)' / 'Applied (Paper II)') above the Mark Papers button. The button is disabled until the tutor selects a paper. The selected value is sent as `paper_name` in the POST body. Once stored on the batch, the selector is not shown on subsequent dispatches.

**Dispatch route also accepts `paper_name`** from request body:
```typescript
const body = await req.json().catch(() => ({}));
const paperName: string | undefined = body.paper_name;
if (paperName) await updateBatchPaperName(batchId, user.id, paperName);
```

**Server-side sanitization**: After parsing AI JSON with `markingResultSchema.parse()`, `sanitizeMarkingResult(result, subject)` is called before saving. For Combined Maths it corrects wrong `max_marks` (Part A → 25, Part B → 150), recomputes `best_questions_selected` (top-5 Part B), and recomputes `total_awarded`/`total_max`. For other subjects it is a no-op.

The route returns `{ status: 'processing' }` immediately after Phase 1 succeeds. Phase 2 errors are logged but don't affect the HTTP response.

The dispatch route also checks `isActive(billing)` and `hasMinutes(billing, totalPapers)` before calling `prepareMarking`, returning 402 with `{ error, available, needed }` if insufficient.

UI: `BatchDetail.tsx` shows a 'Mark Papers' button when `batch.status === 'pending'` and submissions exist. Dispatching is blocked with a 400 error if `batch.status !== 'pending'` (double-dispatch prevention). On 402 errors, an `UpgradeModal` is shown.

### Step 5: Poll & Store Results
`GET /api/batches/[id]/poll` (called by `useBatchPolling` hook every 15s) → implemented in `lib/ai/batch-dispatcher.ts:pollBatchResults()`

1. `getBatchById(batchId, tutorId)` — check status; if already completed/failed, return cached result
2. If no `claude_batch_id` and status is `processing`: direct marking in progress, return DB status
3. If no `claude_batch_id` and status is `pending`: throw `batch_not_dispatched`
4. `anthropic.beta.messages.batches.retrieve(claudeBatchId)` — check Batch API status
5. If `processing_status !== 'ended'`: return `{ status: 'processing', marked, total }`
6. If `processing_status === 'ended'`:
   - Iterate `anthropic.beta.messages.batches.results(claudeBatchId)` (async iterable)
   - For each `succeeded` result: parse JSON → `markingResultSchema.parse()` → `sanitizeMarkingResult(parsed, subject)` → `saveMarkingResults(submissionId, sanitized)` → `updateSubmissionStatus(submissionId, 'marked')`
   - For failed results: `updateSubmissionStatus(submissionId, 'failed')`
   - `updateBatchMarkedPapers(batchId, markedCount)`
   - `updateBatchStatus(batchId, 'completed')` — or `'failed'` if all results failed
7. Return `{ status: 'completed' | 'failed', marked, total }`

UI: `useBatchPolling` hook (15s refresh) is wired into `BatchDetail.tsx`. Progress text shows marked/total count during processing. Two `useEffect`s handle refresh:
- `isDone` effect: fires once when the full batch completes → calls `mutate()` on both batch and submissions.
- `pollData?.marked` effect: fires whenever `marked` count increases during processing → calls `submissionsMutate()` immediately so newly-marked rows appear in the submissions table without waiting for the full batch to finish.

### Step 5.5: Fetch Batch Marking Results
`GET /api/batches/[id]/results` → returns all marking results for all submissions in the batch.
Joins `marking_results` through `submissions` where `submissions.batch_id = batchId`.
Includes override fields: `tutor_override`, `override_marks`, `override_feedback`.
Used by `SubmissionResultsPanel.tsx` in `BatchDetail.tsx` to display expandable results.
Checks batch ownership via `getBatchById(id, user.id)` before returning data.

### Step 6: Tutor Review
Tutor reviews batch results via `SubmissionReviewDialog` (full-screen modal) opened from the "View Results" button in `BatchDetail.tsx`:
- `GET /api/submissions/[id]` returns `{ results: MarkingResultRow[], summary: SubmissionSummary }` — consumed by `useMarkingResults` hook
- `SubmissionResultsPanel` uses `summary.total_awarded` / `summary.total_max` for `MarkingSummary`; falls back to local computation if summary is null (backward compat)
- **Live total**: `SubmissionResultsPanel` maintains `draftMarks: Record<string, number>` state. `liveTotal` is computed from `draftMarks` (while typing) → saved override → AI marks. Updates in real-time without saving.
- `QuestionFeedbackCard` shows: Part A/B badge (when `part` is set), question number, student answer (OCR), AI-awarded marks, feedback (language-aware fonts), sub-question breakdown table (when `sub_questions` is present), OCR confidence badge
- Tutor can click the Pencil button **or click the feedback text directly** to enter edit mode
- `onMarksChange?: (marks: number) => void` prop fires on every keystroke in the marks input and on cancel (restoring original) — used by parent to update `draftMarks` for live total
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

## Batch Name Editing
`PATCH /api/batches/[id]` → updates batch name (tutor-scoped ownership check).
- Validates name is non-empty string, max 200 chars.
- UI: Pencil icon beside batch name in `BatchDetail.tsx`. Inline input + Save/Cancel. Question paper and medium are read-only.

## Batch Deletion
`DELETE /api/batches/[id]` → deletes batch, its submissions (storage + DB), and all marking results.
- Blocked (409) if batch status is `processing` — wait for completion or failure first.
- Cascade: collects submission PDF URLs, removes from `submissions/` storage bucket, then deletes batch record (FK cascades handle students → submissions → marking_results).
- UI: Trash icon on each batch card in `BatchList.tsx` with confirmation dialog. On success, calls `mutate()` to refresh the list.

## Error Handling
- If any submission fails in Batch API, mark that submission `failed`, continue others
- Save raw Claude error to `submissions.claude_error` column
- Tutor can re-submit failed submissions individually
