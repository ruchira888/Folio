import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import { storage } from '../index';
import { logger } from '../logger';
import path from 'path';
import { pathToFileURL } from 'url';

// Set up the worker for Node.js environment
const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
(pdfjs as any).GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

// Standard fonts path for Node.js rendering
const standardFontsPath = path.resolve('node_modules/pdfjs-dist/standard_fonts/');
const standardFontDataUrl = pathToFileURL(standardFontsPath).href + '/';

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return {
      canvas,
      context,
    };
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
      standardFontDataUrl,
    });

    const pdf = await loadingTask.promise;
    logger.info(`PDF loaded. Pages: ${pdf.numPages}`);
    const thumbnails: Thumbnail[] = [];
    const canvasFactory = new NodeCanvasFactory();

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      
      const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

      // Fill background with white
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, viewport.width, viewport.height);

      const renderContext = {
        canvasContext: context as any,
        viewport,
        canvasFactory: canvasFactory as any,
        canvas: canvas as any,
      };

      await page.render(renderContext).promise;

      const dataUrl = canvas.toDataURL('image/png');
      logger.info(`Page ${i} thumbnail size: ${dataUrl.length} chars`);

      thumbnails.push({
        pageNumber: i,
        thumbnailUrl: dataUrl,
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
