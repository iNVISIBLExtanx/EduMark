import { describe, it, expect } from 'vitest';
import { getPdfPageCount } from '@/lib/pdf/pdf-to-images';

/**
 * Creates a minimal PDF-like buffer with a /Type /Pages dictionary containing /Count.
 */
function makePdfBuffer(pageCount: number): Buffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Pages /Count ${pageCount} /Kids [] >>
endobj
`;
  return Buffer.from(content, 'binary');
}

describe('getPdfPageCount', () => {
  it('returns the correct page count', async () => {
    const count = await getPdfPageCount(makePdfBuffer(7));
    expect(count).toBe(7);
  });

  it('returns 1 for a single-page PDF', async () => {
    const count = await getPdfPageCount(makePdfBuffer(1));
    expect(count).toBe(1);
  });

  it('returns the highest count when multiple /Pages objects exist', async () => {
    // Simulates a PDF with an intermediate /Pages node (count=3) and root /Pages node (count=5)
    const content = `%PDF-1.4
1 0 obj
<< /Type /Pages /Count 3 /Kids [2 0 R] >>
endobj
2 0 obj
<< /Type /Pages /Count 5 /Kids [1 0 R 3 0 R] >>
endobj
`;
    const count = await getPdfPageCount(Buffer.from(content, 'binary'));
    expect(count).toBe(5);
  });

  it('throws when buffer has no /Pages dictionary', async () => {
    const invalid = Buffer.from('not a pdf at all', 'binary');
    await expect(getPdfPageCount(invalid)).rejects.toThrow('Could not determine PDF page count');
  });

  it('handles /Count with extra whitespace', async () => {
    const content = `%PDF-1.4
1 0 obj
<< /Type  /Pages  /Count   12  /Kids [] >>
endobj
`;
    const count = await getPdfPageCount(Buffer.from(content, 'binary'));
    expect(count).toBe(12);
  });
});
