# Marking Workflow & Batch Processing

## Full Workflow (step by step)

### Step 1: Create Batch
`POST /api/batches` → creates batch record with status `pending`, links to paper + scheme

### Step 2: Upload Marking Scheme
`POST /api/marking-schemes` → uploads PDF to Storage, Claude parses structure (questions, marks, criteria) → saved to `marking_schemes.structure_json`
Then `POST /api/marking-schemes/[id]/embeddings` → chunks scheme + generates OpenAI embeddings → stored in `ms_embeddings`

### Step 3: Bulk Upload Student Papers
`POST /api/submissions` (multipart) → for each PDF:
- upload to `submissions/` bucket
- create `students` record
- create `submissions` record with status `pending`
Update `batches.total_papers = N`

### Step 4: Dispatch to Claude
`POST /api/batches/[id]/dispatch` →
1. Load all `pending` submissions for batch
2. Get signed URLs → download PDFs → convert to base64 images (`pdfToImages`)
3. Build system prompt with cached marking scheme block
4. Submit one Batch API job with all students as individual requests
5. Save `claude_batch_id` to batch, set status `processing`

### Step 5: Poll & Store Results
`GET /api/batches/[id]/results` (called by `useBatchPolling` hook every 15s) →
1. Check Anthropic Batch status via `anthropic.beta.messages.batches.retrieve(claudeBatchId)`
2. If `processing_status === 'ended'`:
   - Stream results via `anthropic.beta.messages.batches.results(claudeBatchId)`
   - Parse JSON from each result message
   - Save to `marking_results` per question
   - Update `submissions.status = 'marked'`
   - Increment `batches.marked_papers`
3. When all submissions marked, set `batches.status = 'completed'`

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
