// TODO: Implement PDF to base64 images conversion
// See .claude/rules/pdf-pipeline.md for full implementation
export async function pdfToImages(pdfBuffer: Buffer): Promise<string[]> {
  throw new Error(`Not implemented: pdfToImages(${pdfBuffer.length} bytes)`);
}
