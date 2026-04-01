import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('puppeteer-core', () => {
  const mockPage = {
    setContent: vi.fn(),
    pdf: vi.fn().mockResolvedValue(Buffer.from('pdf-content')),
  };
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn(),
  };
  return {
    default: { launch: vi.fn().mockResolvedValue(mockBrowser) },
    __mockPage: mockPage,
    __mockBrowser: mockBrowser,
  };
});
vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    executablePath: vi.fn().mockResolvedValue('/path/to/chromium'),
  },
}));
vi.mock('@/lib/pdf/fonts/noto-sans-sinhala', () => ({
  NOTO_SANS_SINHALA_BASE64: 'mock-sinhala-base64',
}));
vi.mock('@/lib/pdf/fonts/noto-sans-tamil', () => ({
  NOTO_SANS_TAMIL_BASE64: 'mock-tamil-base64',
}));

import { buildReportHTML, generateReportPDF, type ReportHTMLParams } from '@/lib/pdf/report-renderer';
import puppeteer from 'puppeteer-core';

// Access the hoisted mocks through the module
const { __mockPage: mockPage, __mockBrowser: mockBrowser } = await import('puppeteer-core') as unknown as {
  __mockPage: { setContent: ReturnType<typeof vi.fn>; pdf: ReturnType<typeof vi.fn> };
  __mockBrowser: { newPage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
};

function makeResult(overrides: Partial<ReportHTMLParams['results'][0]> = {}): ReportHTMLParams['results'][0] {
  return {
    part: '',
    question_no: 1,
    max_marks: 10,
    awarded_marks: 7,
    student_answer_text: 'The integral is 5x^2',
    feedback: 'Good attempt but missing constant',
    ocr_confidence: 'high',
    tutor_override: false,
    override_marks: null,
    override_feedback: null,
    ...overrides,
  };
}

function makeParams(overrides?: Partial<ReportHTMLParams>): ReportHTMLParams {
  return {
    studentName: 'Alice Perera',
    indexNo: '2025-001',
    subjectName: 'Combined Maths',
    date: '2026-03-15',
    language: 'english',
    tutorName: 'Mr. Silva',
    results: [
      makeResult({ question_no: 1, max_marks: 10, awarded_marks: 7, student_answer_text: 'The integral is 5x^2', feedback: 'Good attempt but missing constant' }),
      makeResult({ question_no: 2, max_marks: 20, awarded_marks: 15, student_answer_text: 'Using chain rule...', feedback: 'Correct method, minor arithmetic error' }),
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPage.pdf.mockResolvedValue(Buffer.from('pdf-content'));
  mockBrowser.newPage.mockResolvedValue(mockPage);
  mockBrowser.close.mockResolvedValue(undefined);
});

describe('buildReportHTML', () => {
  it('includes the student name in the header', () => {
    const html = buildReportHTML(makeParams());
    expect(html).toContain('Alice Perera');
  });

  it('includes the subject name in the heading', () => {
    const html = buildReportHTML(makeParams());
    expect(html).toContain('Combined Maths');
    expect(html).toContain('Marking Report');
  });

  it('renders question sections for each result', () => {
    const html = buildReportHTML(makeParams());
    expect(html).toContain('Question 1');
    expect(html).toContain('Question 2');
    expect(html).toContain('7/10');
    expect(html).toContain('15/20');
  });

  it('uses override marks when tutor_override is true', () => {
    const html = buildReportHTML(makeParams({
      results: [makeResult({ tutor_override: true, override_marks: 9, override_feedback: 'Better than AI thought' })],
    }));
    expect(html).toContain('9/10');
    expect(html).not.toContain('7/10');
    expect(html).toContain('Better than AI thought');
    expect(html).toContain('Edited');
  });

  it('falls back to awarded_marks when override is true but override_marks is null', () => {
    const html = buildReportHTML(makeParams({
      results: [makeResult({ tutor_override: true, override_marks: null, override_feedback: null })],
    }));
    expect(html).toContain('7/10');
    expect(html).toContain('Total: 7/10');
  });

  it('computes total from effective marks (with overrides)', () => {
    const html = buildReportHTML(makeParams({
      results: [
        makeResult({ question_no: 1, max_marks: 10, awarded_marks: 5, student_answer_text: null, feedback: 'F1', tutor_override: true, override_marks: 8, override_feedback: null }),
        makeResult({ question_no: 2, max_marks: 10, awarded_marks: 6, student_answer_text: null, feedback: 'F2' }),
      ],
    }));
    // 8 (override) + 6 (original) = 14/20
    expect(html).toContain('Total: 14/20');
  });

  it('includes NotoSinhala font-face for sinhala language', () => {
    const html = buildReportHTML(makeParams({ language: 'sinhala' }));
    expect(html).toContain('NotoSinhala');
    expect(html).toContain('mock-sinhala-base64');
  });

  it('includes NotoTamil font-face for tamil language', () => {
    const html = buildReportHTML(makeParams({ language: 'tamil' }));
    expect(html).toContain('NotoTamil');
    expect(html).toContain('mock-tamil-base64');
  });

  it('uses system-ui font for english language (no custom font-face)', () => {
    const html = buildReportHTML(makeParams({ language: 'english' }));
    expect(html).not.toContain('NotoSinhala');
    expect(html).not.toContain('NotoTamil');
    expect(html).toContain('system-ui, sans-serif');
  });

  it('shows OCR warning badge when ocr_confidence is low', () => {
    const html = buildReportHTML(makeParams({
      results: [makeResult({ ocr_confidence: 'low', student_answer_text: 'Unclear text', feedback: 'Partially legible' })],
    }));
    expect(html).toContain('Low OCR Confidence');
    expect(html).toContain('ocr-warning');
  });

  it('renders the footer with tutor name and EduMark branding', () => {
    const html = buildReportHTML(makeParams());
    expect(html).toContain('Marked by EduMark AI');
    expect(html).toContain('Reviewed by Mr. Silva');
  });

  it('omits index number when indexNo is null', () => {
    const html = buildReportHTML(makeParams({ indexNo: null }));
    expect(html).not.toContain('Index No:');
    expect(html).toContain('Alice Perera');
  });

  it('includes paperName in header title when provided', () => {
    const html = buildReportHTML(makeParams({ paperName: 'Pure (Paper I)' }));
    expect(html).toContain('Combined Maths — Pure (Paper I)');
  });

  it('does not show paperName in title when paperName is not provided', () => {
    const html = buildReportHTML(makeParams({ paperName: undefined }));
    // Title should be just the subject, no extra paper label
    expect(html).toContain('>Combined Maths — Marking Report<');
    // Make sure "Pure" or "Applied" don't appear
    expect(html).not.toContain('Pure');
    expect(html).not.toContain('Applied');
  });

  it('renders Part A and Part B section headings when part is set', () => {
    const html = buildReportHTML(makeParams({
      results: [
        makeResult({ part: 'Part A', question_no: 1, max_marks: 25, awarded_marks: 20 }),
        makeResult({ part: 'Part B', question_no: 11, max_marks: 150, awarded_marks: 100 }),
      ],
    }));
    expect(html).toContain('class="part-heading"');
    expect(html).toContain('>Part A<');
    expect(html).toContain('>Part B<');
  });

  it('does not render part headings when all parts are empty string', () => {
    const html = buildReportHTML(makeParams({
      results: [
        makeResult({ part: '', question_no: 1 }),
        makeResult({ part: '', question_no: 2 }),
      ],
    }));
    expect(html).not.toContain('class="part-heading"');
  });

  it('renders sub-questions table when sub_questions is non-empty', () => {
    const html = buildReportHTML(makeParams({
      results: [
        makeResult({
          part: 'Part A',
          question_no: 1,
          sub_questions: [
            { label: '(a)(i)', max_marks: 4, awarded_marks: 3, feedback: 'Correct' },
            { label: '(a)(ii)', max_marks: 6, awarded_marks: 4, feedback: 'Partially correct' },
          ],
        }),
      ],
    }));
    expect(html).toContain('class="sub-questions"');
    expect(html).toContain('(a)(i)');
    expect(html).toContain('3/4');
    expect(html).toContain('(a)(ii)');
    expect(html).toContain('4/6');
  });

  it('does not render sub-questions table when sub_questions is null', () => {
    const html = buildReportHTML(makeParams({
      results: [makeResult({ sub_questions: null })],
    }));
    expect(html).not.toContain('class="sub-questions"');
  });

  it('renders Best 5 badge on Part B questions in bestQuestionsSelected', () => {
    const html = buildReportHTML(makeParams({
      results: [
        makeResult({ part: 'Part B', question_no: 11, max_marks: 150, awarded_marks: 120 }),
        makeResult({ part: 'Part B', question_no: 12, max_marks: 150, awarded_marks: 80 }),
      ],
      bestQuestionsSelected: [11],
    }));
    expect(html).toContain('Best 5 ✓');
    expect(html).toContain('best-badge');
    expect(html).toContain('Not counted');
    expect(html).toContain('not-counted');
  });

  it('does not render best-5 badge spans when bestQuestionsSelected is null', () => {
    const html = buildReportHTML(makeParams({
      results: [makeResult({ part: 'Part B', question_no: 11 })],
      bestQuestionsSelected: null,
    }));
    // The CSS class may appear in <style> block, check for the badge span content instead
    expect(html).not.toContain('Best 5 ✓');
    expect(html).not.toContain('>Not counted<');
  });

  it('renders general feedback block when generalFeedback is non-empty', () => {
    const html = buildReportHTML(makeParams({ generalFeedback: 'Overall good performance.' }));
    expect(html).toContain('class="general-feedback"');
    expect(html).toContain('Overall good performance.');
    expect(html).toContain('General Feedback');
  });

  it('does not render general feedback block when generalFeedback is null', () => {
    const html = buildReportHTML(makeParams({ generalFeedback: null }));
    expect(html).not.toContain('class="general-feedback"');
  });

  it('uses totalAwarded/totalMax from params when provided', () => {
    const html = buildReportHTML(makeParams({
      totalAwarded: 750,
      totalMax: 1000,
    }));
    expect(html).toContain('Total: 750/1000');
  });

  it('falls back to summing results when totalAwarded/totalMax params are null', () => {
    const html = buildReportHTML(makeParams({
      totalAwarded: null,
      totalMax: null,
    }));
    // 7 + 15 = 22/30
    expect(html).toContain('Total: 22/30');
  });

  it('does not render student answer section in question cards', () => {
    const html = buildReportHTML(makeParams());
    expect(html).not.toContain('class="answer-section"');
    expect(html).not.toContain('<h4>Student Answer</h4>');
    expect(html).not.toContain('class="student-answer');
  });
});

describe('generateReportPDF', () => {
  it('returns a Buffer', async () => {
    const result = await generateReportPDF('<html></html>');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('calls page.pdf with A4 format and correct margins', async () => {
    await generateReportPDF('<html></html>');

    expect(mockPage.setContent).toHaveBeenCalledWith('<html></html>', { waitUntil: 'networkidle0' });
    expect(mockPage.pdf).toHaveBeenCalledWith({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
  });

  it('closes the browser even when page.pdf throws', async () => {
    mockPage.pdf.mockRejectedValueOnce(new Error('render failed'));

    await expect(generateReportPDF('<html></html>')).rejects.toThrow('render failed');
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('uses local Chrome path in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    await generateReportPDF('<html></html>');

    const launchArgs = (puppeteer.launch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(launchArgs.executablePath).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    expect(launchArgs.args).toEqual([]);

    vi.unstubAllEnvs();
  });

  it('uses chromium args in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await generateReportPDF('<html></html>');

    const launchArgs = (puppeteer.launch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(launchArgs.args).toEqual(['--no-sandbox']);

    vi.unstubAllEnvs();
  });
});
