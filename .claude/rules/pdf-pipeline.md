# PDF Upload & Processing Pipeline

## Question Paper + Marking Scheme Upload
The marking scheme PDF is **required** when uploading a question paper — both are uploaded together in `QuestionPaperUploadForm.tsx`. Claude cannot mark papers without a marking scheme (it provides expected answers, mark allocation, and terminology).

## Student Submission Upload Flow
1. Tutor drags/drops PDFs into `BulkUploader.tsx`
2. Each PDF uploaded to Supabase Storage via `app/api/submissions/route.ts`
3. Storage path: `submissions/{tutorId}/{batchId}/{studentId}.pdf`
4. Student record created in DB with pdf_url

## Supabase Storage Buckets
```
marking-schemes/    ← tutor-uploaded question paper + scheme PDFs (private)
submissions/        ← student handwritten paper PDFs (private)
reports/            ← generated marking report PDFs (private)
```
All buckets are private. Use `supabase.storage.from(bucket).createSignedUrl(path, 3600)` for temporary access.

### Storage RLS Policy Requirements
Each bucket needs SELECT + INSERT + UPDATE + DELETE policies scoped to the owning tutor. The `reports` bucket in particular requires an **UPDATE** policy for upsert to work on re-download — without it, the second download attempt returns `POST 400` even though `upsert: true` is set. All four commands must be covered:
```sql
-- Pattern (reports bucket example)
CREATE POLICY "rep_select_own" ON storage.objects FOR SELECT ...
CREATE POLICY "rep_insert_own" ON storage.objects FOR INSERT ...
CREATE POLICY "rep_update_own" ON storage.objects FOR UPDATE ...  ← required for upsert
CREATE POLICY "rep_delete_own" ON storage.objects FOR DELETE ...
```

## Native PDF Dispatch to Claude
Student PDFs are sent directly to Claude using native PDF document blocks (`type: 'document'`, `media_type: 'application/pdf'`). No image conversion is needed — Claude handles PDF rendering and OCR internally.

See `lib/ai/batch-dispatcher.ts` for the dispatch implementation.

## PDF Utilities (lib/pdf/pdf-to-images.ts)

```typescript
// Pure JS page count — parses /Type /Pages /Count from PDF structure
// No external dependencies (no pdfjs-dist, no canvas)
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> { ... }
```

Used during bulk upload (`app/api/submissions/upload/route.ts`) to validate page counts. If PDF has >20 pages, warn tutor (likely incorrect upload).

## File Size Limits

### Student Submission PDFs (`BulkUploader.tsx`)
- Max **10MB** per student PDF (client-side validation before upload)
- Max 50 files per bulk upload batch

### Marking Scheme PDFs (`QuestionPaperUploadForm.tsx`)
- Max **5MB** per scheme PDF — must be a compact digital PDF, not a scanned image
- Scanned/image-based schemes are too large for the Claude API budget

### Server-Side Combined Size Guard (`lib/ai/batch-dispatcher.ts`)
Two constants enforce limits at dispatch time, independent of client-side checks:

```typescript
const MAX_PDF_BYTES_FOR_TRIAGE = 14 * 1024 * 1024; // 14MB — safe for messages.create (non-streaming)
const MAX_COMBINED_PDF_BYTES  = 22 * 1024 * 1024; // 22MB — safe for messages.stream (streaming)
```

- **Triage pass** (`triagePaper`): student PDF > 14MB → triage skipped, marking proceeds without triage context (graceful degradation)
- **Marking pass** (`dispatchDirect` / `dispatchBatchAPI`): scheme + student combined > 22MB → submission marked `failed` immediately with a clear server log; tutor is asked to compress and re-upload both files

These limits exist because Claude's API rejects oversized base64 payloads:
- `messages.create()` (triage, non-streaming): ~20MB base64 limit → 14MB raw PDF = ~18.7MB base64
- `messages.stream()` (marking, streaming): ~30MB base64 limit → 22MB raw combined = ~29.3MB base64
