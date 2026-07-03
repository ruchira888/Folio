import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";
import path from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";
import { UTApi } from "uploadthing/server";
import { storage } from "../index";
import { logger } from "../logger";

export interface ToJpgResult {
  fileUrl: string;
  fileKey: string;
}

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
    if (existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

const workerPath = resolvePdfJsAssetPath("legacy/build/pdf.worker.mjs");
(pdfjs as any).GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

const standardFontsPath = resolvePdfJsAssetPath("standard_fonts");
const standardFontDataUrl = pathToFileURL(standardFontsPath).href + "/";

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

export async function toJpgService(fileId: string): Promise<ToJpgResult> {
  const record = storage.getRecord(fileId);
  if (!record) throw new Error("File not found or expired");

  const buffer = await storage.getBuffer(fileId);
  const data = new Uint8Array(buffer);

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    standardFontDataUrl,
    disableWorker: true,
  } as any);

  const pdf = await loadingTask.promise;
  const canvasFactory = new NodeCanvasFactory();
  const AdmZipModule: any = await import("adm-zip");
  const AdmZip = AdmZipModule.default;
  const zip = new AdmZip();

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });

      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));
      const { canvas, context } = canvasFactory.create(width, height);

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);

      await page.render({
        canvasContext: context as any,
        viewport,
        canvasFactory: canvasFactory as any,
        canvas: canvas as any,
      } as any).promise;

      const jpgBuffer = canvas.toBuffer("image/jpeg", {
        quality: 0.9,
        progressive: true,
        chromaSubsampling: true,
      } as any);

      const filename = `page-${String(pageNumber).padStart(3, "0")}.jpg`;
      zip.addFile(filename, jpgBuffer);

      page.cleanup();
      canvasFactory.destroy({ canvas, context });
    }
  } finally {
    try {
      pdf.destroy();
    } catch {}
  }

  const zipBuffer = zip.toBuffer();
  const zipNameBase = record.originalName.replace(/\.pdf$/i, "");
  const zipFileName = `${zipNameBase}-jpgs.zip`;

  const file = new File([zipBuffer], zipFileName, {
    type: "application/zip",
  });

  const utapi = new UTApi();
  const uploaded = await utapi.uploadFiles(file);
  if (uploaded.error) {
    throw new Error("Failed to upload JPG ZIP to UploadThing");
  }

  const now = new Date();
  storage.saveRecord({
    id: uploaded.data.key,
    originalName: zipFileName,
    url: uploaded.data.url,
    uploadedAt: now,
    expiresAt: new Date(
      now.getTime() +
        Number(process.env.FILE_LIFETIME_MINUTES || 45) * 60 * 1000,
    ),
    sizeMb: uploaded.data.size / (1024 * 1024),
  });

  logger.info(`PDF to JPG ZIP uploaded: ${uploaded.data.key}`);

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key,
  };
}
