import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import { storage } from '../index';
import { logger } from '../logger';
import path from 'path';
import { pathToFileURL } from 'url';

// Set up the worker for Node.js environment
const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
(pdfjs as any).GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

export interface Thumbnail {
  pageNumber: number;
  thumbnailUrl: string;
}

export interface ThumbnailResponse {
  pages: Thumbnail[];
}

/**
 * Generate thumbnails for each page of a PDF.
 * Uses pdfjs-dist and canvas to render pages to base64 JPEGs.
 */
export async function generateThumbnails(fileId: string): Promise<ThumbnailResponse> {
  const record = storage.getRecord(fileId);
  if (!record) throw new Error('File not found or expired');

  const buffer = await storage.getBuffer(fileId);
  const data = new Uint8Array(buffer);

  try {
    logger.info(`Starting thumbnail generation for ${fileId}`);
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    logger.info(`PDF loaded. Pages: ${pdf.numPages}`);
    const thumbnails: Thumbnail[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      logger.info(`Rendering page ${i}`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.6 });
      
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      const renderContext = {
        canvasContext: context as any,
        viewport,
      };

      await page.render(renderContext).promise;

      thumbnails.push({
        pageNumber: i,
        thumbnailUrl: canvas.toDataURL('image/jpeg', 0.8),
      });

      page.cleanup();
    }

    logger.info(`Generated ${pdf.numPages} thumbnails for file: ${fileId}`);
    return { pages: thumbnails };
  } catch (error: any) {
    logger.error(`Detailed error generating thumbnails for ${fileId}: ${error.message}`, { 
      stack: error.stack,
      error 
    });
    throw new Error(`Failed to generate thumbnails: ${error.message}`);
  }
}
