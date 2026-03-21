# PDF Upload & Processing Pipeline

## Upload Flow
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

## PDF → Base64 Images (lib/pdf/pdf-to-images.ts)
Convert PDF pages to PNG images for Claude vision input:

```typescript
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import { createCanvas } from 'canvas';

interface PdfToImagesResult {
  images: string[];    // base64 PNG strings (no data: prefix)
  pageCount: number;
  warning?: string;    // set when >20 pages
}

export async function pdfToImages(
  pdfBuffer: Buffer,
  options?: { scale?: number }
): Promise<PdfToImagesResult> { ... }

// Lightweight page count only — no rendering
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> { ... }
```

## DPI & Quality Notes
- Scale 2.0 gives ~150 DPI on A4 — sufficient for Claude's OCR
- For Sinhala/Tamil scripts, recommend 300 DPI: use scale 3.0 if OCR confidence is consistently low
- If pdf has >20 pages, warn tutor (likely incorrect upload)

## File Size Limits
- Max 20MB per PDF submission
- Max 50 files per bulk upload batch
- Validate client-side in BulkUploader.tsx before upload starts
