import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas, type CanvasRenderingContext2D } from 'canvas'
import { PDFDocument as PdfLibDocument, rgb, StandardFonts } from 'pdf-lib'
import { UTApi } from 'uploadthing/server'
import { pathToFileURL } from 'url'
import { storage } from '../index'
import { logger } from '../logger'

const projectRoot: string = process.cwd()
const workerPath: string = projectRoot + '/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
const pdfjsAny = pdfjs as any
pdfjsAny.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

const standardFontsPath: string = projectRoot + '/node_modules/pdfjs-dist/standard_fonts/'
const standardFontDataUrl: string = pathToFileURL(standardFontsPath).href + '/'

const RENDER_SCALE = 1.5
const TEXT_THRESHOLD = 50

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
    canvasAndContext.canvas = null
    canvasAndContext.context = null
  }
}

export interface DarkModeResult {
  fileUrl: string
  fileKey: string
}

/** Detect whether a page is primarily text-based or image-based (scanned). */
async function detectPageType(page: any): Promise<'text' | 'scanned'> {
  const textContent = await page.getTextContent()
  const rawText = textContent.items
    .map((item: any) => item.str ?? '')
    .join('')
    .trim()
  return rawText.length >= TEXT_THRESHOLD ? 'text' : 'scanned'
}

/**
 * Strip characters that Helvetica (WinAnsi) cannot encode.
 * Preserves Ctrl+F and text copy — just strips problematic Unicode.
 */
function sanitizeText(str: string): string {
  return str
    .replace(/[\u25CF\u2022\u25E6\u25AA\u25AB]/g, '*')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\u00B7/g, '.')
    .replace(/\u2026/g, '...')
    .replace(/[\u00AE\u00A9]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
}

/**
 * Apply a selective soft-invert filter to a canvas context.
 *
 * Unlike a hard invert (which destroys mid-tones and text edges), this:
 *   - Inverts 88% of the way (leaves some brightness)
 *   - Applies a hue-rotation equivalent by remapping RGB channels
 *   - Preserves mid-tones
 *   - Does not require CSS — pure pixel math
 */
function applySoftInvertFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (a === 0) {
      // Transparent → dark background
      data[i] = 18
      data[i + 1] = 18
      data[i + 2] = 18
      data[i + 3] = 255
      continue
    }

    // Soft invert: invert ~88%, then shift hue slightly warm
    const invR = Math.round(255 - r * 0.88)
    const invG = Math.round(255 - g * 0.88)
    const invB = Math.round(255 - b * 0.88)

    // Hue rotate 180° equivalent: swap R/B, reduce G slightly
    // This moves cold white toward a neutral warm tone
    const hR = invB
    const hG = Math.round(invG * 0.95)
    const hB = invR

    data[i] = Math.min(255, hR)
    data[i + 1] = Math.min(255, hG)
    data[i + 2] = Math.min(255, hB)
    data[i + 3] = 255
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Convert a PDF into a downloadable dark-mode PDF.
 *
 * Strategy per page:
 * - Text page: dark background canvas + re-embedded text in light color
 *   → PDF stays fully searchable and copyable
 * - Scanned page: canvas rendered + soft-invert filter applied
 *   → Preserves mid-tones and text edge quality
 *
 * All processing is server-side (Node.js canvas + pdf-lib).
 */
export async function darkModeService(fileId: string): Promise<DarkModeResult> {
  const record = storage.getRecord(fileId)
  if (!record) throw new Error('File not found or expired')

  const buffer = await storage.getBuffer(fileId)
  const data = new Uint8Array(buffer)

  try {
    logger.info(`Starting dark-mode export for ${fileId}`)

    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      standardFontDataUrl,
    })

    const pdf = await loadingTask.promise
    const canvasFactory = new NodeCanvasFactory()
    const outputDoc = await (PdfLibDocument as any).create()
    const font = await outputDoc.embedFont(StandardFonts.Helvetica)

    // Light text and dark background colors
    const lightR = 234 / 255
    const lightG = 234 / 255
    const lightB = 234 / 255
    const darkR = 18 / 255
    const darkG = 18 / 255
    const darkB = 18 / 255

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const pageType = await detectPageType(page)
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const width = Math.max(1, Math.ceil(viewport.width))
      const height = Math.max(1, Math.ceil(viewport.height))

      const { canvas, context } = canvasFactory.create(width, height)
      context.fillStyle = '#121212'
      context.fillRect(0, 0, width, height)

      const renderContext = {
        canvasContext: context as any,
        canvas: canvas as any,
        viewport,
        canvasFactory: canvasFactory as any,
        background: 'rgba(0,0,0,0)',
      } as any

      await page.render(renderContext).promise

      if (pageType === 'scanned') {
        // Soft-invert for scanned/image pages — preserves mid-tones
        applySoftInvertFilter(context, width, height)

        const imageBytes = canvas.toBuffer('image/png')
        const embedded = await outputDoc.embedPng(imageBytes)
        const pdfPage = outputDoc.addPage([width, height])
        pdfPage.drawImage(embedded, {
          x: 0,
          y: 0,
          width,
          height,
        })
      } else {
        // Text page: dark bg + re-embedded text in light color
        // Embed the rendered canvas as background image
        const imageBytes = canvas.toBuffer('image/png')
        const embedded = await outputDoc.embedPng(imageBytes)
        const pdfPage = outputDoc.addPage([width, height])

        // Dark background via white image on dark page
        pdfPage.drawImage(embedded, {
          x: 0,
          y: 0,
          width,
          height,
        })

        // Redraw text in light color on top — preserves search/copy
        const textContent = await page.getTextContent()
      for (const item of textContent.items as any[]) {
        const clean = sanitizeText(item.str ?? '')
        if (!clean || clean.trim() === '') continue

          const fontSize = Math.sqrt(
            item.transform[0] * item.transform[0] +
              item.transform[1] * item.transform[1],
          )

          // pdfjs: bottom-left origin. pdf-lib: top-left origin.
          const x = item.transform[4]
          // Convert: y_pdf = height - y_pdfjs - slight offset
          const yPdfLib = height - item.transform[5] - fontSize * 0.85

          pdfPage.drawText(clean, {
            x,
            y: yPdfLib,
            size: fontSize,
            font,
            color: rgb(lightR, lightG, lightB),
          })
        }
      }

      page.cleanup()
      canvasFactory.destroy({ canvas, context })
      logger.info(`Dark-mode page rendered: ${i}/${pdf.numPages} (${pageType})`)
    }

    const bytes = await outputDoc.save()
    const file = new File(
      [Buffer.from(bytes)],
      `dark-mode-${record.originalName}`,
      { type: 'application/pdf' },
    )

    const utapi = new UTApi()
    const uploaded = await utapi.uploadFiles(file)
    if (uploaded.error) throw new Error('Failed to upload dark-mode PDF to UploadThing')

    const now = new Date()
    storage.saveRecord({
      id: uploaded.data.key,
      originalName: `dark-mode-${record.originalName}`,
      url: uploaded.data.url,
      uploadedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      sizeMb: uploaded.data.size / (1024 * 1024),
    })

    logger.info(`Dark-mode PDF uploaded: ${uploaded.data.key}`)

    return {
      fileUrl: uploaded.data.url,
      fileKey: uploaded.data.key,
    }
  } catch (error: any) {
    logger.error(`Failed dark-mode export for ${fileId}: ${error?.message ?? error}`)
    throw new Error(`Failed to generate dark-mode PDF: ${error?.message ?? 'Unknown error'}`)
  }
}
