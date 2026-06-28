/**
 * PDF Dark Mode Utilities — 100% client-side
 *
 * Architecture:
 * - Text pages: render canvas (transparent) + CSS textLayer overlay (light color)
 *   → PDF download: dark bg page + embedded text elements (searchable/copyable)
 * - Scanned pages: detect via text content length → render + soft-invert canvas
 *   → PDF download: soft-inverted raster page (preserves visual quality)
 */

import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// ------------------------------------------------------------------ //
// pdfjs worker setup — must happen once, before any getDocument call
// ------------------------------------------------------------------ //
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

// ------------------------------------------------------------------ //
// Constants
// ------------------------------------------------------------------ //
export const RENDER_SCALE = 1.5
export const DARK_BG = '#121212'
export const LIGHT_TEXT = '#eaeaea'

/** Threshold below which a page is considered scanned/image-only */
const TEXT_CONTENT_THRESHOLD = 50

// ------------------------------------------------------------------ //
// Types
// ------------------------------------------------------------------ //
export type PageType = 'text' | 'scanned'

export interface PageRenderResult {
  pageNumber: number
  pageType: PageType
  width: number
  height: number
}

export interface PdfDocument {
  numPages: number
  getPage(pageNumber: number): Promise<pdfjsLib.PDFPageProxy>
}

// ------------------------------------------------------------------ //
// Loading
// ------------------------------------------------------------------ //
export async function loadPdf(file: File): Promise<PdfDocument> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  })
  return loadingTask.promise as unknown as PdfDocument
}

// ------------------------------------------------------------------ //
// Page type detection
// ------------------------------------------------------------------ //
/**
 * Detect whether a page is primarily text-based or image-based (scanned).
 * Scanned pages yield very little text from pdfjs text extraction.
 */
export async function detectPageType(page: pdfjsLib.PDFPageProxy): Promise<PageType> {
  const textContent = await page.getTextContent()
  const rawText = textContent.items
    .map((item: any) => item.str ?? '')
    .join('')
    .trim()

  return rawText.length >= TEXT_CONTENT_THRESHOLD ? 'text' : 'scanned'
}

// ------------------------------------------------------------------ //
// Canvas rendering
// ------------------------------------------------------------------ //
/**
 * Render the page canvas with a dark background.
 * Does NOT include the text layer — that's rendered separately as HTML overlay.
 */
export async function renderPageCanvas(
  page: pdfjsLib.PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale = RENDER_SCALE,
): Promise<{ width: number; height: number }> {
  const viewport = page.getViewport({ scale })
  const width = Math.ceil(viewport.width)
  const height = Math.ceil(viewport.height)

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = DARK_BG
  ctx.fillRect(0, 0, width, height)

  // Render WITHOUT the text layer — we handle text separately
  const renderContext = {
    canvasContext: ctx,
    viewport,
  }

  await page.render(renderContext as any).promise

  return { width, height }
}

// ------------------------------------------------------------------ //
// Text layer rendering (HTML overlay for preview)
// ------------------------------------------------------------------ //
/**
 * Render the pdfjs text layer as HTML and append it to a container.
 * The text layer uses CSS coloring so text is pure CSS — no pixel manipulation.
 */
export async function renderTextLayer(
  page: pdfjsLib.PDFPageProxy,
  container: HTMLDivElement,
  scale = RENDER_SCALE,
): Promise<void> {
  const textContent = await page.getTextContent()

  // Wipe previous text
  container.innerHTML = ''
  container.style.position = 'relative'
  container.style.pointerEvents = 'none'
  container.style.color = LIGHT_TEXT

  const viewport = page.getViewport({ scale })

  textContent.items.forEach((item: any) => {
    if (!item.str || item.str.trim() === '') return

    const tx = pdfjsLib.Util.transform(
      viewport.transform,
      item.transform,
    )

    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1])
    // tx[4] = x, tx[5] = y in viewport space
    const left = tx[4]
    const top = tx[5] - fontSize * 0.2 // slight vertical offset to align baseline

    const span = document.createElement('span')
    span.textContent = item.str
    span.style.position = 'absolute'
    span.style.left = `${left}px`
    span.style.top = `${top}px`
    span.style.fontSize = `${fontSize}px`
    span.style.fontFamily = item.fontName
      ? `"${item.fontName}", sans-serif`
      : 'sans-serif'
    span.style.color = LIGHT_TEXT
    span.style.whiteSpace = 'pre'

    if (item.width !== undefined) {
      span.style.width = `${item.width * scale}px`
    }

    container.appendChild(span)
  })
}

// ------------------------------------------------------------------ //
// Text sanitization — Helvetica (WinAnsi) can't encode many Unicode chars.
// Replace known problem characters with ASCII equivalents or safe fallbacks.
// ------------------------------------------------------------------ //

/** Characters that WinAnsi / Helvetica can't encode. Replaced before drawText. */
const UNSUPPORTED_CHARS: Array<[RegExp, string]> = [
  [/[\u25CF\u2022\u25E6\u25AA\u25AB]/g, '*'],       // bullets → asterisk
  [/[\u2018\u2019\u201A\u201B]/g, "'"],            // smart single quotes → ASCII '
  [/[\u201C\u201D\u201E]/g, '"'],                   // smart double quotes → ASCII "
  [/[\u2013\u2014]/g, '-'],                          // en/em dash → hyphen
  [/[\u00A0]/g, ' '],                               // non-breaking space → space
  [/[\u00B7]/g, '.'],                               // middle dot → period
  [/[\u2026]/g, '...'],                             // ellipsis → three periods
  [/[\u00AE\u00A9]/g, ''],                         // ® © → drop (not representable)
  [/[^\x00-\x7F]/g, ''],                           // catch-all: drop any remaining non-ASCII
]

/**
 * Strip or replace characters that pdf-lib's Helvetica (WinAnsi) can't encode.
 * Keeps Ctrl+F and text copy working — just sanitizes to the font's supported subset.
 */
function sanitizeText(str: string): string {
  let result = str
  for (const [pattern, replacement] of UNSUPPORTED_CHARS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// ------------------------------------------------------------------ //
// Soft invert for scanned pages
// ------------------------------------------------------------------ //
/**
 * Apply a selective soft-invert filter to a canvas.
 * Preserves mid-tones and text edges — not a hard invert.
 *
 * Uses:
 *   invert(0.88) hue-rotate(180deg)
 *
 * This inverts ~88% of the way (leaving some mid-tone brightness),
 * then hue-rotates to shift the cold digital-white into a warmer tone.
 */
export function applySoftInvert(canvas: HTMLCanvasElement): void {
  canvas.style.filter = 'invert(0.88) hue-rotate(180deg)'
}

// ------------------------------------------------------------------ //
// Dark-mode PDF generation (pdf-lib — client-side download)
// ------------------------------------------------------------------ //
export async function generateDarkModePdf(
  sourceFile: File,
  pageResults: PageRenderResult[],
  fileName: string,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  const arrayBuffer = await sourceFile.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const pages = pdfDoc.getPages()

  // Embed a readable font for any text we'll re-draw
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Light text RGB
  const lightR = 234 / 255
  const lightG = 234 / 255
  const lightB = 234 / 255

  // Dark background RGB
  const darkR = 18 / 255
  const darkG = 18 / 255
  const darkB = 18 / 255

  // Load source PDF once with pdfjs for rendering pages
  const sourceLoadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
  const sourcePdf = await sourceLoadingTask.promise

  for (let i = 0; i < pageResults.length; i++) {
    const result = pageResults[i]
    const page = pages[i]
    const sourcePage = await sourcePdf.getPage(result.pageNumber)

    if (result.pageType === 'scanned') {
      // Render scanned page as image with soft invert applied
      const canvas = document.createElement('canvas')

      const viewport = sourcePage.getViewport({ scale: RENDER_SCALE })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)

      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await sourcePage.render({ canvasContext: ctx, viewport } as any).promise

      // Apply soft invert
      const offscreen = document.createElement('canvas')
      offscreen.width = canvas.width
      offscreen.height = canvas.height
      const oCtx = offscreen.getContext('2d')!
      oCtx.filter = 'invert(0.88) hue-rotate(180deg)'
      oCtx.drawImage(canvas, 0, 0)

      const imageBytes = await new Promise<Uint8Array>((resolve) => {
        offscreen.toBlob((blob) => {
          blob!.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)))
        }, 'image/png')
      })

      const embedded = await pdfDoc.embedPng(imageBytes)

      // Set page background to dark
      const { width, height } = page.getSize()
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(darkR, darkG, darkB),
      })

      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width,
        height,
      })
    } else {
      // Text page: set dark background, re-draw text with light color
      const { width, height } = page.getSize()

      // Fill background with dark
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(darkR, darkG, darkB),
      })

      // Re-extract text from the source page (already loaded at top of loop)
      const textContent = await sourcePage.getTextContent()

      for (const item of textContent.items as any[]) {
        const clean = sanitizeText(item.str ?? '')
        if (!clean || clean.trim() === '') continue

        const fontSize = Math.sqrt(
          item.transform[0] * item.transform[0] +
            item.transform[1] * item.transform[1],
        )

        // pdfjs uses bottom-left origin; pdf-lib uses top-left
        // Convert: y_pdf = pageHeight - y_pdfjs - fontSize
        const x = item.transform[4]
        const yPdfLib = height - item.transform[5] - fontSize * 0.85

        page.drawText(clean, {
          x,
          y: yPdfLib,
          size: fontSize,
          font: helveticaFont,
          color: rgb(lightR, lightG, lightB),
        })
      }
    }

    onProgress?.(i + 1, pageResults.length)
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// ------------------------------------------------------------------ //
// Per-page batch render (used by viewer)
// ------------------------------------------------------------------ //
/**
 * Pre-scan all pages to detect types, then return results.
 */
export async function scanPages(
  pdf: PdfDocument,
): Promise<PageRenderResult[]> {
  const results: PageRenderResult[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const pageType = await detectPageType(page)
    const viewport = page.getViewport({ scale: RENDER_SCALE })
    results.push({
      pageNumber: i,
      pageType,
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
    })
  }

  return results
}
