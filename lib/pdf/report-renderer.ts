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
    part: string;
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
      label: string;
      max_marks: number;
      awarded_marks: number;
      feedback: string;
    }> | null;
  }>;
  paperName?: string | null;
  generalFeedback?: string | null;
  bestQuestionsSelected?: number[] | null;
  totalAwarded?: number | null;
  totalMax?: number | null;
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
  const {
    studentName,
    indexNo,
    subjectName,
    date,
    language,
    tutorName,
    results,
    paperName,
    generalFeedback,
    bestQuestionsSelected,
    totalAwarded: paramTotalAwarded,
    totalMax: paramTotalMax,
  } = params;

  const fontCSS = getFontCSS(language);

  // Use pre-sanitized totals from submission summary when available
  const totalMax =
    paramTotalMax != null
      ? paramTotalMax
      : results.reduce((sum, r) => sum + r.max_marks, 0);
  const totalAwarded =
    paramTotalAwarded != null
      ? paramTotalAwarded
      : results.reduce((sum, r) => {
          const effective =
            r.tutor_override && r.override_marks !== null
              ? r.override_marks
              : r.awarded_marks;
          return sum + effective;
        }, 0);

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const title = paperName
    ? `${escapeHtml(subjectName)} — ${escapeHtml(paperName)}`
    : escapeHtml(subjectName);

  // Sort: Part A first (by question_no asc), then Part B (by question_no asc), then others
  const partOrder = (part: string) => {
    if (part === 'Part A') return 0;
    if (part === 'Part B') return 1;
    return 2;
  };
  const sorted = [...results].sort((a, b) => {
    const po = partOrder(a.part) - partOrder(b.part);
    return po !== 0 ? po : a.question_no - b.question_no;
  });

  // Build question sections with part headings
  let currentPart = '';
  const questionSections = sorted.map((r) => {
    const effectiveMarks =
      r.tutor_override && r.override_marks !== null
        ? r.override_marks
        : r.awarded_marks;
    const effectiveFeedback =
      r.tutor_override && r.override_feedback
        ? r.override_feedback
        : r.feedback;

    const isPartB = r.part === 'Part B';
    const isInBest5 =
      isPartB &&
      bestQuestionsSelected != null &&
      bestQuestionsSelected.includes(r.question_no);
    const isNotCounted =
      isPartB && bestQuestionsSelected != null && !isInBest5;

    const percentage = r.max_marks > 0 ? (effectiveMarks / r.max_marks) * 100 : 0;
    const marksColor = isNotCounted
      ? '#9ca3af'
      : percentage < 50
      ? '#dc2626'
      : '#166534';

    const ocrWarning =
      r.ocr_confidence === 'low'
        ? '<span class="ocr-warning">Low OCR Confidence</span>'
        : '';
    const overrideBadge = r.tutor_override
      ? '<span class="override-badge">Edited</span>'
      : '';
    const best5Badge = isInBest5
      ? '<span class="best-badge">Best 5 ✓</span>'
      : '';
    const notCountedBadge = isNotCounted
      ? '<span class="not-counted">Not counted</span>'
      : '';

    // Sub-questions table
    const subQTable =
      r.sub_questions && r.sub_questions.length > 0
        ? `
        <div class="sub-questions-section">
          <h4>Sub-question Breakdown</h4>
          <table class="sub-questions">
            <thead>
              <tr>
                <th>Sub-question</th>
                <th>Marks</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              ${r.sub_questions
                .map(
                  (sq) => `
                <tr>
                  <td>${escapeHtml(sq.label)}</td>
                  <td>${sq.awarded_marks}/${sq.max_marks}</td>
                  <td class="lang-text">${escapeHtml(sq.feedback)}</td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>`
        : '';

    // Part heading separator
    let partHeading = '';
    if (r.part && r.part !== currentPart) {
      currentPart = r.part;
      partHeading = `<div class="part-heading">${escapeHtml(r.part)}</div>`;
    }

    return `
      ${partHeading}
      <section class="question">
        <div class="question-header">
          <h3>Question ${r.question_no} ${ocrWarning} ${overrideBadge} ${best5Badge} ${notCountedBadge}</h3>
          <span class="marks" style="color: ${marksColor};">${effectiveMarks}/${r.max_marks}</span>
        </div>
        <div class="feedback-section">
          <h4>Feedback</h4>
          <div class="feedback lang-text">${escapeHtml(effectiveFeedback)}</div>
        </div>
        ${subQTable}
      </section>
    `;
  }).join('');

  const generalFeedbackBlock =
    generalFeedback && generalFeedback.trim()
      ? `
      <div class="general-feedback">
        <h4>General Feedback</h4>
        <div class="lang-text">${escapeHtml(generalFeedback)}</div>
      </div>`
      : '';

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

    .part-heading {
      margin: 16px 24px 8px 24px;
      font-size: 14px;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 4px;
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
      flex-wrap: wrap;
    }

    .marks {
      font-size: 16px;
      font-weight: bold;
      white-space: nowrap;
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

    .best-badge {
      background-color: #dcfce7;
      color: #166534;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: normal;
    }

    .not-counted {
      background-color: #f3f4f6;
      color: #6b7280;
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

    .feedback {
      font-size: 12px;
      line-height: 1.8;
    }

    .sub-questions-section {
      margin-top: 12px;
    }

    .sub-questions {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 4px;
    }

    .sub-questions th {
      background-color: #f3f4f6;
      padding: 6px 8px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #e5e7eb;
    }

    .sub-questions td {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }

    .general-feedback {
      margin: 0 24px 24px 24px;
      padding: 16px;
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
    }

    .general-feedback h4 {
      margin-bottom: 8px;
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
      background: white;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title} — Marking Report</h1>
    <div class="header-details">
      <span>Student: ${escapeHtml(studentName)}</span>
      ${indexNo ? `<span>Index No: ${escapeHtml(indexNo)}</span>` : ''}
      <span>Date: ${formattedDate}</span>
      <span class="total">Total: ${totalAwarded}/${totalMax}</span>
    </div>
  </div>

  ${questionSections}

  ${generalFeedbackBlock}

  <div class="footer">
    <span>Marked by EduMark AI | Reviewed by ${escapeHtml(tutorName)}</span>
    <span>${formattedDate}</span>
  </div>
</body>
</html>`;
}

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
