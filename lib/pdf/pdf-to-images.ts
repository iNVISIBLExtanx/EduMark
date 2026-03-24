/**
 * Returns the number of pages in a PDF by parsing the root /Pages dictionary.
 *
 * Reads the /Count entry from /Type /Pages objects in the PDF structure.
 * The root Pages object always contains the total page count.
 * No external rendering dependencies (canvas, pdfjs-dist) required.
 *
 * @param pdfBuffer - The raw PDF file as a Buffer
 * @returns The number of pages
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const str = pdfBuffer.toString('binary');

  // Match /Type /Pages objects and extract their /Count values.
  // The root /Pages node has the total count; intermediate nodes have partial counts.
  // Taking the maximum reliably gives the total page count.
  const pagesRegex = /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g;
  let maxCount = 0;
  let match;
  while ((match = pagesRegex.exec(str)) !== null) {
    const count = parseInt(match[1], 10);
    if (count > maxCount) maxCount = count;
  }

  if (maxCount > 0) return maxCount;

  throw new Error('Could not determine PDF page count');
}
