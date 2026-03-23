> **Status: IMPLEMENTED** — See `lib/pdf/report-renderer.ts` for `buildReportHTML` + `generateReportPDF`, and `app/api/reports/[id]/download/route.ts` for the download endpoint.

# PDF Report Generation

## Tech: Puppeteer with @sparticuz/chromium
Use `@sparticuz/chromium` for Vercel serverless compatibility.

```typescript
// lib/pdf/report-renderer.ts
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export async function generateReportPDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
  await browser.close();
  return Buffer.from(pdf);
}
```

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
  Student Name | Index No | Subject | Date | Total: X/Y
</header>

<section class="question" v-for="q in questions">
  <h3>Question {q.question_no}  [{q.awarded_marks}/{q.max_marks}]</h3>
  <div class="student-answer">{q.student_answer_text}</div>
  <div class="feedback">{q.feedback}</div>  <!-- in tutor's language -->
  <div class="mark-breakdown">...</div>
</section>

<footer>
  Marked by EduMark AI | Reviewed by {tutorName} | {date}
</footer>
```

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
// app/api/reports/[submissionId]/route.ts
export async function GET(req, { params }) {
  const results = await getMarkingResults(params.submissionId);  // lib/db
  const html = buildReportHTML(results);  // lib/pdf/report-renderer.ts helper
  const pdfBuffer = await generateReportPDF(html);
  // upload to Supabase storage, return signed URL
  return new Response(pdfBuffer, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="report.pdf"' }
  });
}
```
