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

function makeParams(overrides?: Partial<ReportHTMLParams>): ReportHTMLParams {
  return {
    studentName: 'Alice Perera',
    indexNo: '2025-001',
    subjectName: 'Combined Maths',
    date: '2026-03-15',
    language: 'english',
    tutorName: 'Mr. Silva',
    results: [
      {
        question_no: 1,
        max_marks: 10,
        awarded_marks: 7,
        student_answer_text: 'The integral is 5x^2',
        feedback: 'Good attempt but missing constant',
        ocr_confidence: 'high',
        tutor_override: false,
        override_marks: null,
        override_feedback: null,
      },
      {
        question_no: 2,
        max_marks: 20,
        awarded_marks: 15,
        student_answer_text: 'Using chain rule...',
        feedback: 'Correct method, minor arithmetic error',
        ocr_confidence: 'high',
        tutor_override: false,
        override_marks: null,
        override_feedback: null,
      },
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
      results: [
        {
          question_no: 1,
          max_marks: 10,
          awarded_marks: 7,
          student_answer_text: 'Answer text',
          feedback: 'AI feedback',
          ocr_confidence: 'high',
          tutor_override: true,
          override_marks: 9,
          override_feedback: 'Better than AI thought',
        },
      ],
    }));
    expect(html).toContain('9/10');
    expect(html).not.toContain('7/10');
    expect(html).toContain('Better than AI thought');
    expect(html).toContain('Edited');
  });

  it('falls back to awarded_marks when override is true but override_marks is null', () => {
    const html = buildReportHTML(makeParams({
      results: [
        {
          question_no: 1,
          max_marks: 10,
          awarded_marks: 7,
          student_answer_text: 'Answer',
          feedback: 'Original feedback',
          ocr_confidence: 'high',
          tutor_override: true,
          override_marks: null,
          override_feedback: null,
        },
      ],
    }));
    expect(html).toContain('7/10');
    expect(html).toContain('Total: 7/10');
  });

  it('computes total from effective marks (with overrides)', () => {
    const html = buildReportHTML(makeParams({
      results: [
        {
          question_no: 1, max_marks: 10, awarded_marks: 5,
          student_answer_text: null, feedback: 'F1', ocr_confidence: 'high',
          tutor_override: true, override_marks: 8, override_feedback: null,
        },
        {
          question_no: 2, max_marks: 10, awarded_marks: 6,
          student_answer_text: null, feedback: 'F2', ocr_confidence: 'high',
          tutor_override: false, override_marks: null, override_feedback: null,
        },
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
      results: [
        {
          question_no: 1, max_marks: 10, awarded_marks: 5,
          student_answer_text: 'Unclear text', feedback: 'Partially legible',
          ocr_confidence: 'low',
          tutor_override: false, override_marks: null, override_feedback: null,
        },
      ],
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
});
