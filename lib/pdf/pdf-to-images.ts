import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import { createCanvas } from 'canvas';

const MAX_PAGES_WARNING_THRESHOLD = 20;
const DEFAULT_SCALE = 2.0;

export interface PdfToImagesResult {
  images: string[];
  pageCount: number;
  warning?: string;
}

/**
 * Converts each page of a PDF buffer into a base64-encoded PNG string.
 *
 * @param pdfBuffer - The raw PDF file as a Buffer
 * @param options.scale - Render scale factor (default 2.0 ≈ 150 DPI for A4)
 * @returns Base64 PNG strings (without data URI prefix), page count, and optional warning
 */
export async function pdfToImages(
  pdfBuffer: Buffer,
  options?: { scale?: number },
): Promise<PdfToImagesResult> {
  const scale = options?.scale ?? DEFAULT_SCALE;

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
  }).promise;

  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    // Extract base64 data without the data URI prefix
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    images.push(base64);
  }

  const warning =
    pdf.numPages > MAX_PAGES_WARNING_THRESHOLD
      ? `PDF has ${pdf.numPages} pages, which exceeds the recommended maximum of ${MAX_PAGES_WARNING_THRESHOLD}. This may indicate an incorrect upload.`
      : undefined;

  return {
    images,
    pageCount: pdf.numPages,
    warning,
  };
}

/**
 * Returns the number of pages in a PDF without rendering them.
 *
 * @param pdfBuffer - The raw PDF file as a Buffer
 * @returns The number of pages
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
  }).promise;

  return pdf.numPages;
}
