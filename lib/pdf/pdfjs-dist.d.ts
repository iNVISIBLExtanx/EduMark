declare module 'pdfjs-dist/legacy/build/pdf' {
  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  interface PDFPageProxy {
    getViewport(params: { scale: number }): PDFPageViewport;
    render(params: {
      canvasContext: unknown;
      viewport: PDFPageViewport;
    }): { promise: Promise<void> };
  }

  interface PDFPageViewport {
    width: number;
    height: number;
  }

  interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export function getDocument(params: { data: Uint8Array }): PDFDocumentLoadingTask;
}
