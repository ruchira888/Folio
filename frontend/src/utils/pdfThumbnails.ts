import { getDocument } from "pdfjs-dist";
import { configurePdfJsWorker } from "./pdfjsWorker";

configurePdfJsWorker();

export interface PdfThumbnail {
  pageNumber: number;
  thumbnailUrl: string;
}

const THUMBNAIL_WIDTH = 200;

/**
 * Render PDF page thumbnails in the browser using pdf.js.
 * Calls onPageRendered after each page so the UI can update progressively.
 */
export async function generatePdfThumbnails(
  file: File,
  onPageRendered?: (thumbnail: PdfThumbnail, totalPages: number) => void,
): Promise<{ pages: PdfThumbnail[]; totalPages: number }> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages: PdfThumbnail[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_WIDTH / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not get canvas context");

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    const thumbnail: PdfThumbnail = {
      pageNumber: i,
      thumbnailUrl: canvas.toDataURL("image/jpeg", 0.85),
    };
    pages.push(thumbnail);
    onPageRendered?.(thumbnail, pdf.numPages);
    page.cleanup();
  }

  return { pages, totalPages: pdf.numPages };
}
