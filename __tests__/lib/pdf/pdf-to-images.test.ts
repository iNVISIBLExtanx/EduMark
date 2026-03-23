import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock canvas
const mockCanvas = {
  getContext: vi.fn(() => ({ fillRect: vi.fn() })),
  toDataURL: vi.fn(() => 'data:image/png;base64,abc123base64data'),
  width: 0,
  height: 0,
};

vi.mock('canvas', () => ({
  createCanvas: vi.fn((w: number, h: number) => {
    mockCanvas.width = w;
    mockCanvas.height = h;
    return mockCanvas;
  }),
}));

// Mock pdfjs-dist
const mockPage = {
  getViewport: vi.fn((opts: { scale: number }) => ({
    width: 595 * opts.scale,
    height: 842 * opts.scale,
  })),
  render: vi.fn(() => ({ promise: Promise.resolve() })),
};

let mockNumPages = 3;

const mockGetDocument = vi.fn<(params: { data: Uint8Array }) => { promise: Promise<unknown> }>();

function resetGetDocumentMock() {
  mockGetDocument.mockImplementation(() => ({
    promise: Promise.resolve({
      get numPages() {
        return mockNumPages;
      },
      getPage: vi.fn(() => Promise.resolve(mockPage)),
    }),
  }));
}

vi.mock('pdfjs-dist/legacy/build/pdf', () => ({
  getDocument: (arg: { data: Uint8Array }) => mockGetDocument(arg),
}));

import { pdfToImages, getPdfPageCount } from '@/lib/pdf/pdf-to-images';
import { createCanvas } from 'canvas';

describe('pdfToImages', () => {
  const fakeBuffer = Buffer.from('fake-pdf-content');

  beforeEach(() => {
    vi.clearAllMocks();
    mockNumPages = 3;
    // Re-establish mock implementations after clearAllMocks
    resetGetDocumentMock();
    mockPage.getViewport.mockImplementation((opts: { scale: number }) => ({
      width: 595 * opts.scale,
      height: 842 * opts.scale,
    }));
    mockPage.render.mockReturnValue({ promise: Promise.resolve() });
    mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,abc123base64data');
    mockCanvas.getContext.mockReturnValue({ fillRect: vi.fn() });
  });

  it('converts a 3-page PDF into exactly 3 base64 strings', async () => {
    const result = await pdfToImages(fakeBuffer);

    expect(result.images).toHaveLength(3);
    expect(result.images.every((img) => typeof img === 'string')).toBe(true);
  });

  it('returns correct pageCount in result', async () => {
    mockNumPages = 5;

    const result = await pdfToImages(fakeBuffer);

    expect(result.pageCount).toBe(5);
  });

  it('sets warning string when PDF has >20 pages', async () => {
    mockNumPages = 25;

    const result = await pdfToImages(fakeBuffer);

    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('25 pages');
    expect(result.warning).toContain('exceeds');
  });

  it('does not set warning when PDF has exactly 20 pages', async () => {
    mockNumPages = 20;

    const result = await pdfToImages(fakeBuffer);

    expect(result.warning).toBeUndefined();
  });

  it('does not set warning when PDF has fewer than 20 pages', async () => {
    mockNumPages = 10;

    const result = await pdfToImages(fakeBuffer);

    expect(result.warning).toBeUndefined();
  });

  it('uses default scale of 2.0 when no options provided', async () => {
    mockNumPages = 1;

    await pdfToImages(fakeBuffer);

    expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 2.0 });
  });

  it('passes custom scale to getViewport', async () => {
    mockNumPages = 1;

    await pdfToImages(fakeBuffer, { scale: 3.0 });

    expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 3.0 });
  });

  it('creates canvas with dimensions from viewport', async () => {
    mockNumPages = 1;

    await pdfToImages(fakeBuffer, { scale: 2.0 });

    expect(createCanvas).toHaveBeenCalledWith(595 * 2.0, 842 * 2.0);
  });

  it('returns base64 without data URI prefix', async () => {
    mockNumPages = 1;

    const result = await pdfToImages(fakeBuffer);

    result.images.forEach((img) => {
      expect(img).not.toContain('data:image/png;base64,');
      expect(img).toBe('abc123base64data');
    });
  });

  it('converts Buffer to Uint8Array for pdfjs compatibility', async () => {
    mockNumPages = 1;

    await pdfToImages(fakeBuffer);

    const callArg = mockGetDocument.mock.calls[0]?.[0] as unknown as { data: unknown };
    expect(callArg.data).toBeInstanceOf(Uint8Array);
  });

  it('calls render with canvas context and viewport for each page', async () => {
    mockNumPages = 2;

    await pdfToImages(fakeBuffer);

    expect(mockPage.render).toHaveBeenCalledTimes(2);
    for (const call of (mockPage.render.mock.calls as unknown[][])) {
      const arg = call[0] as { canvasContext: unknown; viewport: unknown };
      expect(arg).toHaveProperty('canvasContext');
      expect(arg).toHaveProperty('viewport');
    }
  });

  it('throws when pdfjs fails to load a corrupt PDF', async () => {
    mockGetDocument.mockReturnValueOnce({
      promise: Promise.reject(new Error('Invalid PDF structure')),
    });

    await expect(pdfToImages(fakeBuffer)).rejects.toThrow('Invalid PDF structure');
  });
});

describe('getPdfPageCount', () => {
  const fakeBuffer = Buffer.from('fake-pdf-content');

  beforeEach(() => {
    vi.clearAllMocks();
    mockNumPages = 3;
    resetGetDocumentMock();
  });

  it('returns the correct page count', async () => {
    mockNumPages = 7;

    const count = await getPdfPageCount(fakeBuffer);

    expect(count).toBe(7);
  });

  it('returns 1 for a single-page PDF', async () => {
    mockNumPages = 1;

    const count = await getPdfPageCount(fakeBuffer);

    expect(count).toBe(1);
  });

  it('does not call getPage or render (lightweight check)', async () => {
    mockNumPages = 5;

    await getPdfPageCount(fakeBuffer);

    expect(mockPage.getViewport).not.toHaveBeenCalled();
    expect(mockPage.render).not.toHaveBeenCalled();
  });

  it('converts Buffer to Uint8Array for pdfjs', async () => {
    await getPdfPageCount(fakeBuffer);

    const callArg = mockGetDocument.mock.calls[0]?.[0] as unknown as { data: unknown };
    expect(callArg.data).toBeInstanceOf(Uint8Array);
  });

  it('throws when pdfjs fails to load the buffer', async () => {
    mockGetDocument.mockReturnValueOnce({
      promise: Promise.reject(new Error('Corrupt file')),
    });

    await expect(getPdfPageCount(fakeBuffer)).rejects.toThrow('Corrupt file');
  });
});
