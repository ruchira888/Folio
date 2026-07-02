import 'regenerator-runtime/runtime';
import { PDFDocument as PdfLibDocument, rgb, StandardFonts } from 'pdf-lib';
import { UTApi } from 'uploadthing/server';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pathToFileURL } from 'url';
import { storage } from '../../index';
import { logger } from '../../logger';
import { Translator } from './Translator';

const projectRoot = process.cwd();
const workerPath = projectRoot + '/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';
const pdfjsAny = pdfjs as any;
pdfjsAny.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

const standardFontsPath = projectRoot + '/node_modules/pdfjs-dist/standard_fonts/';
const standardFontDataUrl = pathToFileURL(standardFontsPath).href + '/';

// Intercept fontkit.create to handle TTC (TrueType Collection) files
const originalCreate = fontkit.create;
fontkit.create = (buffer: any, postscriptName?: string) => {
  const result = originalCreate.call(fontkit, buffer, postscriptName);
  if (result && result.constructor.name === 'TrueTypeCollection') {
    // Return first font inside the collection (e.g. Nirmala UI for Nirmala.ttc)
    return (result as any).fonts[0];
  }
  return result;
};

export interface TranslatePdfResult {
  fileUrl: string;
  fileKey: string;
}

type TextFragment = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontName: string;
};

type TextLine = {
  fragments: TextFragment[];
  text: string;
  x: number;
  y: number;
  fontSize: number;
};

function clampSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function groupFragmentsIntoLines(fragments: TextFragment[]): TextLine[] {
  const ordered = [...fragments].sort((left, right) => {
    const yDelta = right.y - left.y;
    if (Math.abs(yDelta) > 1) return yDelta;
    return left.x - right.x;
  });

  const groups: TextFragment[][] = [];
  let currentGroup: TextFragment[] = [];
  let currentY: number | null = null;

  for (const fragment of ordered) {
    if (currentGroup.length === 0) {
      currentGroup = [fragment];
      currentY = fragment.y;
      continue;
    }

    const threshold = Math.max(2, fragment.fontSize * 0.35);
    if (currentY !== null && Math.abs(fragment.y - currentY) <= threshold) {
      currentGroup.push(fragment);
      currentY = (currentY * (currentGroup.length - 1) + fragment.y) / currentGroup.length;
    } else {
      groups.push(currentGroup);
      currentGroup = [fragment];
      currentY = fragment.y;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups.map((group) => {
    const sorted = [...group].sort((left, right) => left.x - right.x);
    const text = clampSpace(sorted.map((fragment) => fragment.text).join(' '));
    const fontSize = Math.max(...sorted.map((fragment) => fragment.fontSize), 0);
    return {
      fragments: sorted,
      text,
      x: Math.min(...sorted.map((fragment) => fragment.x)),
      y: sorted[0]?.y ?? 0,
      fontSize,
    };
  });
}

async function extractPageLines(page: any): Promise<TextLine[]> {
  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableCombineTextItems: false,
  } as any);

  const fragments: TextFragment[] = [];

  for (const item of textContent.items ?? []) {
    const textItem = item as any;
    if (!textItem?.str || typeof textItem.str !== 'string') continue;

    const transform = Array.isArray(textItem.transform) ? textItem.transform : [1, 0, 0, 1, 0, 0];
    const fontSize = Math.max(4, Math.hypot(Number(transform[0]) || 0, Number(transform[1]) || 0));
    fragments.push({
      text: textItem.str,
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      width: Number(textItem.width) || 0,
      fontSize,
      fontName: String(textItem.fontName || ''),
    });
  }

  return groupFragmentsIntoLines(fragments);
}

export class PdfTranslationService {
  constructor(private translator: Translator) {}

  /**
   * Translates the text content of a PDF page-by-page while preserving layout.
   */
  async translatePdf(fileId: string, targetLanguage: string): Promise<TranslatePdfResult> {
    const record = storage.getRecord(fileId);
    if (!record) throw new Error('File not found or expired');

    const buffer = await storage.getBuffer(fileId);

    // 1. Load the original PDF to overlay translated text
    const pdfDoc = await (PdfLibDocument as any).load(buffer);

    // 2. Open using pdf.js to extract coordinates
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      useSystemFonts: true,
      disableFontFace: true,
      standardFontDataUrl,
    } as any);
    const pdfJsDoc = await loadingTask.promise;

    // 3. Prepare Unicode-supporting font based on target language
    const langLower = targetLanguage.toLowerCase();
    let selectedFontPath = 'C:\\Windows\\Fonts\\arial.ttf';
    if (langLower === 'hi') {
      selectedFontPath = 'C:\\Windows\\Fonts\\Nirmala.ttc';
    } else if (langLower === 'ja') {
      selectedFontPath = 'C:\\Windows\\Fonts\\msgothic.ttc';
    } else if (langLower === 'zh-cn') {
      selectedFontPath = 'C:\\Windows\\Fonts\\simsun.ttc';
    } else if (langLower === 'ko') {
      selectedFontPath = 'C:\\Windows\\Fonts\\malgun.ttf';
    }

    const FONT_PATHS = [
      selectedFontPath,
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\Arial.ttf',
      '/Library/Fonts/Arial.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
    ];

    let font;
    let fontBytes: Buffer | null = null;

    for (const fontPath of FONT_PATHS) {
      if (fs.existsSync(fontPath)) {
        try {
          fontBytes = fs.readFileSync(fontPath);
          break;
        } catch (err) {
          logger.warn(`Failed to read font at ${fontPath}:`, err);
        }
      }
    }

    if (fontBytes) {
      try {
        pdfDoc.registerFontkit(fontkit);
        font = await pdfDoc.embedFont(fontBytes);
        logger.info(`Successfully embedded font for language ${targetLanguage} translation.`);
      } catch (err) {
        logger.error('Error embedding system font, falling back to Standard Helvetica:', err);
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } else {
      logger.warn('No system TrueType font found, falling back to Standard Helvetica.');
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // 4. Translate page-by-page, overlaying translations on top of covered coordinates
    try {
      const libPages = pdfDoc.getPages();
      for (let pageIndex = 1; pageIndex <= pdfJsDoc.numPages; pageIndex++) {
        const jsPage = await pdfJsDoc.getPage(pageIndex);
        const libPage = libPages[pageIndex - 1];
        if (!libPage) {
          jsPage.cleanup();
          continue;
        }

        const lines = await extractPageLines(jsPage);
        const nonBlankLines = lines.filter(l => l.text.trim().length > 0);
        if (nonBlankLines.length === 0) {
          jsPage.cleanup();
          continue;
        }

        // Translate the whole page's lines in a single batch (highly accurate context)
        const pageText = nonBlankLines.map(l => l.text).join('\n');
        logger.info(`Translating page ${pageIndex}/${pdfJsDoc.numPages} (${nonBlankLines.length} lines)`);
        const translatedText = await this.translator.translate(pageText, targetLanguage);
        const translatedLines = translatedText.replace(/\r\n/g, '\n').split('\n');

        for (let i = 0; i < nonBlankLines.length; i++) {
          const line = nonBlankLines[i];
          const translatedLine = translatedLines[i] !== undefined ? translatedLines[i].trim() : line.text;

          if (!translatedLine) continue;

          // Bounding box of the original line
          const minX = line.x;
          const maxX = Math.max(...line.fragments.map(f => f.x + f.width));
          const width = maxX - minX;

          // Mask the old text with a white rectangle matching coordinate box
          const rectY = line.y - (line.fontSize * 0.15);
          const rectHeight = line.fontSize * 1.3;

          libPage.drawRectangle({
            x: minX - 1,
            y: rectY,
            width: width + 2,
            height: rectHeight,
            color: rgb(1, 1, 1),
          });

          // Draw the translated line at the same position with same font size
          libPage.drawText(translatedLine, {
            x: minX,
            y: line.y,
            size: line.fontSize,
            font: font,
            color: rgb(0.08, 0.08, 0.08),
          });
        }

        jsPage.cleanup();
      }
    } finally {
      pdfJsDoc.destroy();
    }

    // 5. Save and upload translated PDF
    const bytes = await pdfDoc.save();
    const cleanLang = targetLanguage.toLowerCase().replace(/[^a-z0-9]/g, '');
    const finalName = record.originalName.replace(/\.pdf$/i, `-${cleanLang}.pdf`);
    const file = new File(
      [bytes.buffer as ArrayBuffer],
      finalName,
      { type: 'application/pdf' }
    );

    const utapi = new UTApi();
    const uploaded = await utapi.uploadFiles(file);

    if (uploaded.error) {
      throw new Error('Failed to upload translated PDF to UploadThing');
    }

    const now = new Date();
    storage.saveRecord({
      id: uploaded.data.key,
      originalName: finalName,
      url: uploaded.data.url,
      uploadedAt: now,
      expiresAt: new Date(now.getTime() + Number(process.env.FILE_LIFETIME_MINUTES || 45) * 60 * 1000),
      sizeMb: uploaded.data.size / (1024 * 1024),
    });

    logger.info(`Translated PDF uploaded: ${uploaded.data.key}`);

    return {
      fileUrl: uploaded.data.url,
      fileKey: uploaded.data.key,
    };
  }
}
