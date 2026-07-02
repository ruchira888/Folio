import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument as PdfLibDocument } from "pdf-lib";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { UTApi } from "uploadthing/server";
import path from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";
import { storage } from "../index";
import { logger } from "../logger";

const TEXT_THRESHOLD = 100;

function resolvePdfJsAssetPath(relativePath: string): string {
  const candidates = [
    path.resolve(process.cwd(), "node_modules", "pdfjs-dist", relativePath),
    path.resolve(
      __dirname,
      "..",
      "..",
      "node_modules",
      "pdfjs-dist",
      relativePath,
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Fall back to cwd-based path for error visibility upstream.
  return candidates[0];
}

const workerPath = resolvePdfJsAssetPath("legacy/build/pdf.worker.mjs");
(pdfjs as any).GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

const standardFontsPath = resolvePdfJsAssetPath("standard_fonts");
const standardFontDataUrl = pathToFileURL(standardFontsPath).href + "/";

const cMapPath = resolvePdfJsAssetPath("cmaps");
const cMapUrl = pathToFileURL(cMapPath).href + "/";

// pdf.js v5 on Node needs these browser-like globals for painting.
const globalAny = globalThis as any;
if (!globalAny.DOMMatrix && DOMMatrix) globalAny.DOMMatrix = DOMMatrix;
if (!globalAny.ImageData && ImageData) globalAny.ImageData = ImageData;
if (!globalAny.Path2D && Path2D) globalAny.Path2D = Path2D;

export interface DarkModeResult {
  fileUrl: string;
  fileKey: string;
}

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function detectPageType(page: any): Promise<"text" | "scanned"> {
  const textContent = await page.getTextContent();
  const rawText = textContent.items
    .map((item: any) => item.str ?? "")
    .join("")
    .trim();
  return rawText.length >= TEXT_THRESHOLD ? "text" : "scanned";
}

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function transformPixelToDarkMode(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Grayscale / text-like tones: strong inversion for readability.
  if (sat < 0.18) {
    if (luminance > 240) return [18, 18, 18]; // near-white backgrounds -> dark
    if (luminance < 45) return [235, 235, 235]; // near-black text -> light

    // Smoothly invert the middle range while keeping contrast moderate.
    const t = luminance / 255;
    const mapped = (1 - t) * 215 + t * 35;
    return [clamp255(mapped), clamp255(mapped), clamp255(mapped)];
  }

  // Color-rich regions (often images/charts): preserve hue, gently rebalance.
  if (luminance > 210) {
    return [clamp255(r * 0.78), clamp255(g * 0.78), clamp255(b * 0.78)];
  }
  if (luminance < 55) {
    return [clamp255(r * 1.22), clamp255(g * 1.22), clamp255(b * 1.22)];
  }

  return [clamp255(r * 0.96), clamp255(g * 0.96), clamp255(b * 0.96)];
}

function looksMostlyBlankWhite(imageData: any): boolean {
  const data: Uint8ClampedArray = imageData.data;
  let nonWhite = 0;
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r < 248 || g < 248 || b < 248) {
      nonWhite++;
    }
  }

  return totalPixels > 0 && nonWhite / totalPixels < 0.0002;
}

function applyDarkModeToImageData(imageData: any) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const [nr, ng, nb] = transformPixelToDarkMode(
      data[i],
      data[i + 1],
      data[i + 2],
    );
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

export async function darkModeService(fileId: string): Promise<DarkModeResult> {
  const record = storage.getRecord(fileId);
  if (!record) throw new Error("File not found or expired");

  const buffer = await storage.getBuffer(fileId);
  const data = new Uint8Array(buffer);

  let sourcePdf: any | null = null;
  const canvasFactory = new NodeCanvasFactory();

  try {
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      standardFontDataUrl,
      cMapUrl,
      cMapPacked: true,
      useWorkerFetch: false,
      isEvalSupported: false,
    } as any);

    sourcePdf = await loadingTask.promise;

    // Ensure this is text-based before processing.
    let hasText = false;
    for (let i = 1; i <= sourcePdf.numPages; i++) {
      const page = await sourcePdf.getPage(i);
      const pageType = await detectPageType(page);
      if (pageType === "text") {
        hasText = true;
        page.cleanup();
        break;
      }
      page.cleanup();
    }

    if (!hasText) {
      throw new Error("UNSUPPORTED_SCANNED_PDF");
    }

    const outputPdf = await PdfLibDocument.create();

    for (let i = 1; i <= sourcePdf.numPages; i++) {
      const page = await sourcePdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });

      const canvasWidth = Math.max(1, Math.ceil(viewport.width));
      const canvasHeight = Math.max(1, Math.ceil(viewport.height));
      const { canvas, context } = canvasFactory.create(
        canvasWidth,
        canvasHeight,
      );

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      const renderContext = {
        canvasContext: context as any,
        viewport,
        canvasFactory: canvasFactory as any,
        canvas: canvas as any,
      };

      await page.render(renderContext).promise;

      let imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);

      if (looksMostlyBlankWhite(imageData)) {
        logger.warn(
          `Dark-mode page ${i} looked blank after default render; retrying with print intent`,
        );
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        await page.render({
          ...renderContext,
          intent: "print",
        } as any).promise;
        imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);
      }

      if (looksMostlyBlankWhite(imageData)) {
        const textContent = await page.getTextContent();
        const textItems = textContent?.items?.length ?? 0;
        logger.error(
          `Dark-mode page ${i} still blank after print-intent retry (text items: ${textItems})`,
        );

        if (textItems > 0) {
          throw new Error("PDF_TEXT_RENDER_FAILED");
        }
      }

      applyDarkModeToImageData(imageData);
      context.putImageData(imageData, 0, 0);

      const pagePng = canvas.toBuffer("image/png");
      const embedded = await outputPdf.embedPng(pagePng);

      const newPage = outputPdf.addPage([viewport.width, viewport.height]);
      newPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });

      page.cleanup();
      canvasFactory.destroy({ canvas, context });
    }

    const darkPdfBytes = await outputPdf.save();
    const file = new File(
      [Buffer.from(darkPdfBytes)],
      `dark-mode-${record.originalName}`,
      {
        type: "application/pdf",
      },
    );

    const utapi = new UTApi();
    const uploaded = await utapi.uploadFiles(file);
    if (uploaded.error)
      throw new Error("Failed to upload dark-mode PDF to UploadThing");

    const now = new Date();
    storage.saveRecord({
      id: uploaded.data.key,
      originalName: `dark-mode-${record.originalName}`,
      url: uploaded.data.url,
      uploadedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      sizeMb: uploaded.data.size / (1024 * 1024),
    });

    logger.info(`Dark-mode PDF uploaded: ${uploaded.data.key}`);

    return {
      fileUrl: uploaded.data.url,
      fileKey: uploaded.data.key,
    };
  } catch (error: any) {
    logger.error(
      `Dark-mode conversion failed for ${fileId}: ${error?.message}`,
      {
        stack: error?.stack,
        error,
      },
    );
    throw error;
  } finally {
    if (sourcePdf) {
      try {
        sourcePdf.destroy();
      } catch {}
    }
  }
}
