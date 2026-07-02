import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFDocument as PdfLibDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { UTApi } from 'uploadthing/server'
import { pathToFileURL } from 'url'
import { storage } from '../index'
import { logger } from '../logger'

const projectRoot: string = process.cwd()
const pdfjsAny = pdfjs as any

const standardFontsPath: string = projectRoot + '/node_modules/pdfjs-dist/standard_fonts/'
const standardFontDataUrl: string = pathToFileURL(standardFontsPath).href + '/'

const TEXT_THRESHOLD = 100
const DARK_BG: [number, number, number] = [18 / 255, 18 / 255, 18 / 255]
const LIGHT_TEXT: [number, number, number] = [238 / 255, 238 / 255, 238 / 255]

type RgbTuple = [number, number, number]

interface ExtractedText {
  text: string
  x: number
  y: number
  size: number
  rotateDeg: number
}

interface RectShape {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

interface LineShape {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

type VectorPrimitive = RectShape | LineShape

interface VectorStyle {
  fillColor: RgbTuple
  strokeColor: RgbTuple
  lineWidth: number
}

interface VectorDrawInstruction {
  primitive: VectorPrimitive
  fill?: RgbTuple
  stroke?: RgbTuple
  lineWidth: number
}

export interface DarkModeResult {
  fileUrl: string
  fileKey: string
}

/**
 * Detect whether a PDF is text-based or image-based (scanned) using pdfjs.
 * This is a quick client-side heuristic; the Python script does a more
 * thorough check with pdfminer.six.
 */
async function detectPageType(page: any): Promise<'text' | 'scanned'> {
  const textContent = await page.getTextContent()
  const rawText = textContent.items
    .map((item: any) => item.str ?? '')
    .join('')
    .trim()
  return rawText.length >= TEXT_THRESHOLD ? 'text' : 'scanned'
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function rgbToHsl([r, g, b]: RgbTuple): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2

  if (d === 0) return [0, 0, l]

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0

  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4

  return [h / 6, s, l]
}

function hslToRgb([h, s, l]: [number, number, number]): RgbTuple {
  if (s === 0) return [l, l, l]

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return [
    hue2rgb(p, q, h + 1 / 3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1 / 3),
  ]
}

function mapColorForDarkMode(source: RgbTuple): RgbTuple {
  const [r, g, b] = source
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b

  if (luminance < 0.12) return LIGHT_TEXT
  if (luminance > 0.94) return DARK_BG

  const [h, s, l] = rgbToHsl(source)
  const newL = clamp01(0.68 + (1 - l) * 0.18)
  const newS = clamp01(Math.max(s, 0.35))
  return hslToRgb([h, newS, newL])
}

function cmykToRgb(c: number, m: number, y: number, k: number): RgbTuple {
  const r = 1 - Math.min(1, c * (1 - k) + k)
  const g = 1 - Math.min(1, m * (1 - k) + k)
  const b = 1 - Math.min(1, y * (1 - k) + k)
  return [r, g, b]
}

function multiplyMatrices(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function transformPoint(x: number, y: number, matrix: number[]): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  }
}

function mapFillArgsToRgb(fn: number, args: any[], ops: any): RgbTuple {
  if (fn === ops.setFillRGBColor) return [clamp01(args[0]), clamp01(args[1]), clamp01(args[2])]
  if (fn === ops.setFillGray) {
    const g = clamp01(args[0])
    return [g, g, g]
  }
  if (fn === ops.setFillCMYKColor) return cmykToRgb(args[0], args[1], args[2], args[3])
  return [0, 0, 0]
}

function mapStrokeArgsToRgb(fn: number, args: any[], ops: any): RgbTuple {
  if (fn === ops.setStrokeRGBColor) return [clamp01(args[0]), clamp01(args[1]), clamp01(args[2])]
  if (fn === ops.setStrokeGray) {
    const g = clamp01(args[0])
    return [g, g, g]
  }
  if (fn === ops.setStrokeCMYKColor) return cmykToRgb(args[0], args[1], args[2], args[3])
  return [0, 0, 0]
}

function parsePathPrimitives(pathOps: number[], coords: number[], ctm: number[], ops: any): VectorPrimitive[] {
  const primitives: VectorPrimitive[] = []
  let cursor = 0
  let currentPoint: { x: number; y: number } | null = null

  for (const pathOp of pathOps) {
    if (pathOp === ops.rectangle) {
      const x = coords[cursor++]
      const y = coords[cursor++]
      const w = coords[cursor++]
      const h = coords[cursor++]

      const p1 = transformPoint(x, y, ctm)
      const p2 = transformPoint(x + w, y + h, ctm)

      primitives.push({
        type: 'rect',
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        width: Math.abs(p2.x - p1.x),
        height: Math.abs(p2.y - p1.y),
      })
      currentPoint = p2
      continue
    }

    if (pathOp === ops.moveTo) {
      const x = coords[cursor++]
      const y = coords[cursor++]
      currentPoint = transformPoint(x, y, ctm)
      continue
    }

    if (pathOp === ops.lineTo) {
      const x = coords[cursor++]
      const y = coords[cursor++]
      const nextPoint = transformPoint(x, y, ctm)
      if (currentPoint) {
        primitives.push({
          type: 'line',
          x1: currentPoint.x,
          y1: currentPoint.y,
          x2: nextPoint.x,
          y2: nextPoint.y,
        })
      }
      currentPoint = nextPoint
      continue
    }

    if (pathOp === ops.curveTo) {
      cursor += 6
      continue
    }

    if (pathOp === ops.curveTo2 || pathOp === ops.curveTo3) {
      cursor += 4
      continue
    }
  }

  return primitives
}

function buildVectorInstructions(operatorList: any): VectorDrawInstruction[] {
  const ops = pdfjsAny.OPS
  const instructions: VectorDrawInstruction[] = []

  const defaultStyle: VectorStyle = {
    fillColor: [0, 0, 0],
    strokeColor: [0, 0, 0],
    lineWidth: 1,
  }

  let style: VectorStyle = { ...defaultStyle }
  let ctm = [1, 0, 0, 1, 0, 0]
  const styleStack: Array<{ style: VectorStyle; ctm: number[] }> = []
  let pendingPath: VectorPrimitive[] = []

  const flushPath = (mode: 'fill' | 'stroke' | 'fillStroke') => {
    for (const primitive of pendingPath) {
      instructions.push({
        primitive,
        fill: mode === 'fill' || mode === 'fillStroke' ? mapColorForDarkMode(style.fillColor) : undefined,
        stroke: mode === 'stroke' || mode === 'fillStroke' ? mapColorForDarkMode(style.strokeColor) : undefined,
        lineWidth: style.lineWidth,
      })
    }
    pendingPath = []
  }

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i]
    const args = operatorList.argsArray[i]

    if (fn === ops.save) {
      styleStack.push({ style: { ...style }, ctm: [...ctm] })
      continue
    }

    if (fn === ops.restore) {
      const previous = styleStack.pop()
      if (previous) {
        style = previous.style
        ctm = previous.ctm
      }
      continue
    }

    if (fn === ops.transform) {
      ctm = multiplyMatrices(ctm, args)
      continue
    }

    if (fn === ops.setFillRGBColor || fn === ops.setFillGray || fn === ops.setFillCMYKColor) {
      style.fillColor = mapFillArgsToRgb(fn, args, ops)
      continue
    }

    if (fn === ops.setStrokeRGBColor || fn === ops.setStrokeGray || fn === ops.setStrokeCMYKColor) {
      style.strokeColor = mapStrokeArgsToRgb(fn, args, ops)
      continue
    }

    if (fn === ops.setLineWidth) {
      style.lineWidth = Math.max(0.25, Number(args[0]) || 1)
      continue
    }

    if (fn === ops.constructPath) {
      const [pathOps, pathCoords] = args
      pendingPath = parsePathPrimitives(pathOps, pathCoords, ctm, ops)
      continue
    }

    if (fn === ops.fill || fn === ops.eoFill) {
      flushPath('fill')
      continue
    }

    if (fn === ops.stroke || fn === ops.closeStroke) {
      flushPath('stroke')
      continue
    }

    if (fn === ops.fillStroke || fn === ops.eoFillStroke || fn === ops.closeFillStroke || fn === ops.closeEOFillStroke) {
      flushPath('fillStroke')
      continue
    }

    if (fn === ops.endPath) {
      pendingPath = []
    }
  }

  return instructions
}

async function extractTextRuns(page: any): Promise<ExtractedText[]> {
  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableCombineTextItems: false,
  } as any)

  const textRuns: ExtractedText[] = []

  for (const item of textContent.items ?? []) {
    const textItem = item as any
    if (!textItem?.str || typeof textItem.str !== 'string') continue

    const transform = Array.isArray(textItem.transform) ? textItem.transform : [1, 0, 0, 1, 0, 0]
    const fontSize = Math.max(4, Math.hypot(Number(transform[0]) || 0, Number(transform[1]) || 0))
    const rotateDeg = (Math.atan2(Number(transform[1]) || 0, Number(transform[0]) || 1) * 180) / Math.PI

    textRuns.push({
      text: textItem.str,
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      size: fontSize,
      rotateDeg,
    })
  }

  return textRuns
}

export async function darkModeService(fileId: string): Promise<DarkModeResult> {
  const record = storage.getRecord(fileId)
  if (!record) throw new Error('File not found or expired')

  const buffer = await storage.getBuffer(fileId)
  const data = new Uint8Array(buffer)

  // Load the PDF once. pdfjs transfers (and detaches) the underlying
  // ArrayBuffer of `data` while loading, so the same buffer must not be handed
  // to a second getDocument call — doing so throws while cloning the detached
  // buffer.
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
    disableFontFace: true,
    standardFontDataUrl,
  } as any)
  const sourcePdf = await loadingTask.promise

  // Quick text detection: scanned/image-only PDFs cannot be recolored into a
  // readable dark theme, so require at least one page with extractable text.
  let hasText = false
  try {
    for (let i = 1; i <= sourcePdf.numPages; i++) {
      const page = await sourcePdf.getPage(i)
      const pageType = await detectPageType(page)
      if (pageType === 'text') {
        hasText = true
        break
      }
    }
  } catch (e: any) {
    logger.warn(`pdfjs text detection failed for ${fileId}: ${e?.message}`)
  }

  if (!hasText) {
    sourcePdf.destroy()
    throw new Error('UNSUPPORTED_SCANNED_PDF')
  }

  const outputPdf = await PdfLibDocument.create()
  const textFont = await outputPdf.embedFont(StandardFonts.Helvetica)

  try {
    for (let pageIndex = 1; pageIndex <= sourcePdf.numPages; pageIndex++) {
      const sourcePage = await sourcePdf.getPage(pageIndex)
      const viewport = sourcePage.getViewport({ scale: 1 })
      const newPage = outputPdf.addPage([viewport.width, viewport.height])

      // Step 1: dark background
      newPage.drawRectangle({
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        color: rgb(DARK_BG[0], DARK_BG[1], DARK_BG[2]),
      })

      // Step 2: vector redraw with remapped colors (best-effort for common primitives)
      const operatorList = await sourcePage.getOperatorList()
      const vectors = buildVectorInstructions(operatorList)

      for (const vector of vectors) {
        if (vector.primitive.type === 'rect') {
          const rect = vector.primitive
          newPage.drawRectangle({
            x: rect.x,
            y: rect.y,
            width: Math.max(0.1, rect.width),
            height: Math.max(0.1, rect.height),
            color: vector.fill ? rgb(vector.fill[0], vector.fill[1], vector.fill[2]) : undefined,
            borderColor: vector.stroke ? rgb(vector.stroke[0], vector.stroke[1], vector.stroke[2]) : undefined,
            borderWidth: vector.stroke ? vector.lineWidth : undefined,
          })
          continue
        }

        if (vector.primitive.type === 'line' && vector.stroke) {
          const line = vector.primitive
          newPage.drawLine({
            start: { x: line.x1, y: line.y1 },
            end: { x: line.x2, y: line.y2 },
            thickness: vector.lineWidth,
            color: rgb(vector.stroke[0], vector.stroke[1], vector.stroke[2]),
          })
        }
      }

      // Step 3: text redraw in light color preserving position and approximate angle
      const textRuns = await extractTextRuns(sourcePage)
      for (const run of textRuns) {
        if (!run.text.trim()) continue
        newPage.drawText(run.text, {
          x: run.x,
          y: run.y,
          size: run.size,
          font: textFont,
          color: rgb(LIGHT_TEXT[0], LIGHT_TEXT[1], LIGHT_TEXT[2]),
          rotate: degrees(run.rotateDeg),
        })
      }

      sourcePage.cleanup()
    }
  } finally {
    sourcePdf.destroy()
  }

  const darkPdfBytes = await outputPdf.save()
  const file = new File([Buffer.from(darkPdfBytes)], `dark-mode-${record.originalName}`, {
    type: 'application/pdf',
  })

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
}
