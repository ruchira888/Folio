/**
 * PDF Dark Mode Utilities — preview only
 *
 * The actual dark-mode conversion is done server-side via the Python
 * pikepdf converter. This module only handles preview rendering.
 */

import * as pdfjsLib from "pdfjs-dist";
import { configurePdfJsWorker } from "./pdfjsWorker";

// ------------------------------------------------------------------ //
// pdfjs worker setup
// ------------------------------------------------------------------ //
configurePdfJsWorker();

// ------------------------------------------------------------------ //
// Constants
// ------------------------------------------------------------------ //
export const RENDER_SCALE = 1.5;
export const DARK_BG = "#121212";
export const LIGHT_TEXT = "#eaeaea";

/** Threshold below which a PDF is considered scanned/image-only */
const TEXT_CONTENT_THRESHOLD = 100;

// ------------------------------------------------------------------ //
// Types
// ------------------------------------------------------------------ //
export type PageType = "text" | "scanned";

export interface PageRenderResult {
  pageNumber: number;
  pageType: PageType;
  width: number;
  height: number;
}

export interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<pdfjsLib.PDFPageProxy>;
}

// ------------------------------------------------------------------ //
// Loading
// ------------------------------------------------------------------ //
export async function loadPdf(file: File): Promise<PdfDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });
  return loadingTask.promise as unknown as PdfDocument;
}

// ------------------------------------------------------------------ //
// Text detection
// ------------------------------------------------------------------ //
export async function detectPageType(
  page: pdfjsLib.PDFPageProxy,
): Promise<PageType> {
  const textContent = await page.getTextContent();
  const rawText = textContent.items
    .map((item: any) => item.str ?? "")
    .join("")
    .trim();

  return rawText.length >= TEXT_CONTENT_THRESHOLD ? "text" : "scanned";
}

// ------------------------------------------------------------------ //
// Canvas rendering (for preview)
// ------------------------------------------------------------------ //
export async function renderPageCanvas(
  page: pdfjsLib.PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale = RENDER_SCALE,
): Promise<{ width: number; height: number }> {
  const viewport = page.getViewport({ scale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = DARK_BG;
  ctx.fillRect(0, 0, width, height);

  const renderContext = {
    canvasContext: ctx,
    viewport,
  };

  await page.render(renderContext as any).promise;

  return { width, height };
}

// ------------------------------------------------------------------ //
// Text layer rendering (for preview)
// ------------------------------------------------------------------ //
export async function renderTextLayer(
  page: pdfjsLib.PDFPageProxy,
  container: HTMLDivElement,
  scale = RENDER_SCALE,
): Promise<void> {
  const textContent = await page.getTextContent();

  container.innerHTML = "";
  container.style.position = "relative";
  container.style.pointerEvents = "none";
  container.style.color = LIGHT_TEXT;

  const viewport = page.getViewport({ scale });

  textContent.items.forEach((item: any) => {
    if (!item.str || item.str.trim() === "") return;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    const left = tx[4];
    const top = tx[5] - fontSize * 0.2;

    const span = document.createElement("span");
    span.textContent = item.str;
    span.style.position = "absolute";
    span.style.left = `${left}px`;
    span.style.top = `${top}px`;
    span.style.fontSize = `${fontSize}px`;
    span.style.fontFamily = item.fontName
      ? `"${item.fontName}", sans-serif`
      : "sans-serif";
    span.style.color = LIGHT_TEXT;
    span.style.whiteSpace = "pre";

    if (item.width !== undefined) {
      span.style.width = `${item.width * scale}px`;
    }

    container.appendChild(span);
  });
}

// ------------------------------------------------------------------ //
// Per-page batch scan
// ------------------------------------------------------------------ //
export async function scanPages(pdf: PdfDocument): Promise<PageRenderResult[]> {
  const results: PageRenderResult[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const pageType = await detectPageType(page);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    results.push({
      pageNumber: i,
      pageType,
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
    });
  }

  return results;
}

// ------------------------------------------------------------------ //
// Check if PDF is text-based (client-side quick check)
// ------------------------------------------------------------------ //
export async function isTextBasedPdf(file: File): Promise<boolean> {
  const pdf = await loadPdf(file);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const pageType = await detectPageType(page);
    if (pageType === "text") return true;
  }
  return false;
}
