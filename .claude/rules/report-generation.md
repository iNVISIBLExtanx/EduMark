> **Status: IMPLEMENTED** — See `lib/pdf/report-renderer.ts` for `buildReportHTML` + `generateReportPDF`, and `app/api/reports/[id]/download/route.ts` for the download endpoint.

# PDF Report Generation

## Tech: Puppeteer with @sparticuz/chromium
Use `@sparticuz/chromium` for Vercel serverless compatibility.

```typescript
// lib/pdf/report-renderer.ts
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export async function generateReportPDF(html: string): Promise<Buffer> {
  const isDev = process.env.NODE_ENV === 'development';

  const browser = await puppeteer.launch({
    args: isDev ? [] : chromium.args,
    executablePath: isDev
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
```

**Note**: `@sparticuz/chromium` only works on Linux/serverless. In development (`NODE_ENV=development`), the function falls back to local Chrome. The `try/finally` ensures the browser is always closed.

## Report HTML Template
The report HTML must be generated server-side (in the API route) and passed to Puppeteer.
Include inline CSS only (no external fonts via URL — embed base64 fonts for Sinhala/Tamil).

### Fonts Required
- **Sinhala**: Noto Sans Sinhala (embed base64 in CSS)
- **Tamil**: Noto Sans Tamil (embed base64 in CSS)
- **English**: system-ui / sans-serif

### Report Structure (per submission)
```html
<header>
  Subject [— paperName if set] | Student Name | Index No | Date | Total: X/Y
</header>

<div class="part-heading">Part A</div>   <!-- only when results have part set -->
<section class="question" v-for="q in partAQuestions">
  <h3>Question {q.question_no} [badges: OCR, Override, Best5/NotCounted] [{marks}/{max}]</h3>
  <div class="student-answer">{q.student_answer_text}</div>
  <div class="feedback">{q.feedback}</div>  <!-- in tutor's language -->
  <table class="sub-questions">...</table>  <!-- only when sub_questions present -->
</section>

<div class="part-heading">Part B</div>
<section class="question" ...>  <!-- same structure, + Best5/NotCounted badges -->

<div class="general-feedback">...</div>  <!-- only when generalFeedback non-empty -->

<footer>
  Marked by EduMark AI | Reviewed by {tutorName} | {date}
</footer>
```

### `ReportHTMLParams` Interface
```typescript
interface ReportHTMLParams {
  studentName: string;
  indexNo: string | null;
  subjectName: string;
  date: string;
  language: 'sinhala' | 'tamil' | 'english';
  tutorName: string;
  results: Array<{
    part: string;                      // 'Part A' | 'Part B' | ''
    question_no: number;
    max_marks: number;
    awarded_marks: number;
    student_answer_text: string | null;
    feedback: string;
    ocr_confidence: string;
    tutor_override: boolean;
    override_marks: number | null;
    override_feedback: string | null;
    sub_questions?: Array<{
      label: string; max_marks: number; awarded_marks: number; feedback: string;
    }> | null;
  }>;
  paperName?: string | null;              // e.g. 'Pure (Paper I)'
  generalFeedback?: string | null;        // shown as block above footer
  bestQuestionsSelected?: number[] | null; // Part B question numbers for BEST-5 badges
  totalAwarded?: number | null;           // from submission summary (pre-sanitized)
  totalMax?: number | null;               // from submission summary (pre-sanitized)
}
```

**Totals**: Use `totalAwarded`/`totalMax` from params when provided (these come from `submissions.total_awarded`/`total_max` which are sanitized at marking time). Fall back to summing results array only when params are null/undefined (backward compatibility).

**Part A/B grouping**: Sort results by part order (Part A first) then question_no ascending. Insert `<div class="part-heading">` separator when `part` is non-empty and changes.

**BEST-5 badges**: On Part B questions — green "Best 5 ✓" badge if question_no is in `bestQuestionsSelected`; gray "Not counted" badge if not selected. Marks color = gray for "not counted" questions regardless of percentage.

**Sub-questions table**: Rendered after the feedback section when `sub_questions` array is non-empty.

## Font Embedding (critical for Sinhala/Tamil)
Download Noto Sans Sinhala/Tamil TTF → convert to base64 → embed in `<style>`:
```css
@font-face {
  font-family: 'NotoSinhala';
  src: url('data:font/truetype;base64,{BASE64_FONT_DATA}') format('truetype');
}
.sinhala { font-family: 'NotoSinhala', sans-serif; }
```
Store the base64 font strings in `lib/pdf/fonts/` as `.ts` constants.

## API Route
```typescript
// app/api/reports/[id]/download/route.ts
export async function GET(req, { params }) {
  // Verify ownership, check report is approved
  const results = await getMarkingResultsBySubmission(submissionId);  // lib/db
  const html = buildReportHTML(results);  // lib/pdf/report-renderer.ts helper
  const pdfBuffer = await generateReportPDF(html);
  // upload to Supabase storage, update reports table
  return new Response(pdfBuffer, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="report.pdf"' }
  });
}
```

**Note**: `approveReport()` uses `upsert` (not `update`) with `onConflict: 'submission_id'` to handle the case where no report record exists yet. This prevents the chicken-and-egg problem where download checks for an approved report but no record exists.
