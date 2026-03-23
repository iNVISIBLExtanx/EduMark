import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { NOTO_SANS_SINHALA_BASE64 } from './fonts/noto-sans-sinhala';
import { NOTO_SANS_TAMIL_BASE64 } from './fonts/noto-sans-tamil';

export interface ReportHTMLParams {
  studentName: string;
  indexNo: string | null;
  subjectName: string;
  date: string;
  language: 'sinhala' | 'tamil' | 'english';
  tutorName: string;
  results: Array<{
    question_no: number;
    max_marks: number;
    awarded_marks: number;
    student_answer_text: string | null;
    feedback: string;
    ocr_confidence: string;
    tutor_override: boolean;
    override_marks: number | null;
    override_feedback: string | null;
  }>;
}

function getFontCSS(language: 'sinhala' | 'tamil' | 'english'): string {
  if (language === 'sinhala') {
    return `
      @font-face {
        font-family: 'NotoSinhala';
        src: url('data:font/truetype;base64,${NOTO_SANS_SINHALA_BASE64}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      .lang-text { font-family: 'NotoSinhala', sans-serif; }
    `;
  }
  if (language === 'tamil') {
    return `
      @font-face {
        font-family: 'NotoTamil';
        src: url('data:font/truetype;base64,${NOTO_SANS_TAMIL_BASE64}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      .lang-text { font-family: 'NotoTamil', sans-serif; }
    `;
  }
  return `.lang-text { font-family: system-ui, sans-serif; }`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildReportHTML(params: ReportHTMLParams): string {
  const { studentName, indexNo, subjectName, date, language, tutorName, results } = params;

  const fontCSS = getFontCSS(language);

  const totalMax = results.reduce((sum, r) => sum + r.max_marks, 0);
  const totalAwarded = results.reduce((sum, r) => {
    const effective = r.tutor_override && r.override_marks !== null
      ? r.override_marks
      : r.awarded_marks;
    return sum + effective;
  }, 0);

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const questionSections = results.map((r) => {
    const effectiveMarks = r.tutor_override && r.override_marks !== null
      ? r.override_marks
      : r.awarded_marks;
    const effectiveFeedback = r.tutor_override && r.override_feedback
      ? r.override_feedback
      : r.feedback;
    const percentage = r.max_marks > 0 ? (effectiveMarks / r.max_marks) * 100 : 0;
    const marksColor = percentage < 50 ? '#dc2626' : '#166534';
    const ocrWarning = r.ocr_confidence === 'low'
      ? '<span class="ocr-warning">Low OCR Confidence</span>'
      : '';
    const overrideBadge = r.tutor_override
      ? '<span class="override-badge">Edited</span>'
      : '';

    return `
      <section class="question">
        <div class="question-header">
          <h3>Question ${r.question_no} ${ocrWarning} ${overrideBadge}</h3>
          <span class="marks" style="color: ${marksColor};">${effectiveMarks}/${r.max_marks}</span>
        </div>
        ${r.student_answer_text ? `
          <div class="answer-section">
            <h4>Student Answer</h4>
            <div class="student-answer lang-text">${escapeHtml(r.student_answer_text)}</div>
          </div>
        ` : ''}
        <div class="feedback-section">
          <h4>Feedback</h4>
          <div class="feedback lang-text">${escapeHtml(effectiveFeedback)}</div>
        </div>
      </section>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    ${fontCSS}

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      font-size: 12px;
    }

    .header {
      background-color: #1e40af;
      color: white;
      padding: 20px 24px;
      margin-bottom: 24px;
    }

    .header h1 {
      font-size: 20px;
      margin-bottom: 8px;
    }

    .header-details {
      display: flex;
      gap: 24px;
      font-size: 12px;
      opacity: 0.9;
    }

    .header-details .total {
      margin-left: auto;
      font-size: 16px;
      font-weight: bold;
      opacity: 1;
    }

    .question {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      margin: 0 24px 16px 24px;
      padding: 16px;
      page-break-inside: avoid;
    }

    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .question-header h3 {
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .marks {
      font-size: 16px;
      font-weight: bold;
    }

    .ocr-warning {
      background-color: #fef3c7;
      color: #92400e;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: normal;
    }

    .override-badge {
      background-color: #dbeafe;
      color: #1e40af;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: normal;
    }

    h4 {
      font-size: 11px;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }

    .answer-section {
      margin-bottom: 12px;
    }

    .student-answer {
      background-color: #f9fafb;
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.8;
    }

    .feedback {
      font-size: 12px;
      line-height: 1.8;
    }

    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 12px 24px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(subjectName)} — Marking Report</h1>
    <div class="header-details">
      <span>Student: ${escapeHtml(studentName)}</span>
      ${indexNo ? `<span>Index No: ${escapeHtml(indexNo)}</span>` : ''}
      <span>Date: ${formattedDate}</span>
      <span class="total">Total: ${totalAwarded}/${totalMax}</span>
    </div>
  </div>

  ${questionSections}

  <div class="footer">
    <span>Marked by EduMark AI | Reviewed by ${escapeHtml(tutorName)}</span>
    <span>${formattedDate}</span>
  </div>
</body>
</html>`;
}

export async function generateReportPDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
