import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let isConfigured = false;

/**
 * Ensure pdf.js API and worker are always configured from the same package build.
 */
export function configurePdfJsWorker(): void {
  if (isConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  isConfigured = true;
}
