import express, { Request, Response, NextFunction } from 'express'
import rateLimit,{ipKeyGenerator} from 'express-rate-limit'
import { PDFDocument as PdfLibDocument, rgb } from 'pdf-lib'
import pdfParse from 'pdf-parse'
import { storage } from '../index'
import { AnnotateRequestBody, ApiResponse, DarkModeRequestBody, DeletePagesRequestBody, MarkdownExportRequestBody, ProtectPdfRequestBody, WatermarkPdfRequestBody, TranslatePdfRequestBody, TranslatePdfResult } from '../types'
import { summarizePdf } from '../services/summaryService'
import { deletePagesService } from '../services/deletePagesService'
import { protectPdfService } from '../services/protectPdfService'
import { darkModeService } from '../services/darkModeService'
import { watermarkPdfService } from '../services/watermarkService'
import { exportPdfToMarkdown } from '../services/markdownExportService'
import { logger } from '../logger'
import { GoogleTranslator } from '../services/translation/providers/GoogleTranslator'
import { PdfTranslationService } from '../services/translation/PdfTranslationService'

let generateThumbnails: any = null
try {
  const { generateThumbnails: _generateThumbnails } = require('../services/thumbnailService')
  generateThumbnails = _generateThumbnails
} catch (err) {
  logger.warn('Thumbnail generation not available (canvas native module issue)')
}

const googleTranslator = new GoogleTranslator()
const pdfTranslationService = new PdfTranslationService(googleTranslator)


export const pdfRouter = express.Router()
//expres ratelimit tracks req per ip add alzo uses inmemory store to req 
const summarizeRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: Number(process.env.SUMMARIZE_RATE_LIMIT_PER_DAY || 10),
  message: {
    success: false,
    error: 'Daily summarize limit reached. Try again tomorrow.'
  },
  skip: () => process.env.NODE_ENV !== 'production' // Disable in development
})

const hexToRgb = (hex: string): [number, number, number] => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r
    ? [parseInt(r[1], 16) / 255, parseInt(r[2], 16) / 255, parseInt(r[3], 16) / 255]
    : [1, 1, 0]
}

interface FabricRect {
  fill: string
  left: number
  top: number
  width: number
  height: number
  opacity: number
}

interface FabricLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

// pdf-parse types are incomplete define what we actually use
interface PdfParseResult {
  text: string
  numpages: number
  info: Record<string, unknown>
}

// ─── ANNOTATE ───────────────────────────────────────────────────────────────

pdfRouter.post(
  '/:id/annotate',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      // find pdf record from storage
      // make sure file exists and isn't expired
      const record = storage.getRecord(req.params.id)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      // get annotations from frontend
      const { annotations }: AnnotateRequestBody = req.body

      // make sure user actually sent annotations
      if (!annotations || annotations.length === 0) {
        res.status(400).json({ success: false, error: 'No annotations provided' })
        return
      }

      // fetch raw pdf bytes
      const buffer = await storage.getBuffer(req.params.id)

      // convert bytes -> editable PDF document
      const pdfDoc = await (PdfLibDocument as any).load(buffer)

      // get all pages from pdf
      const pages = pdfDoc.getPages()

      // loop through annotations one by one
      for (const annotation of annotations) {
        // find page annotation belongs to
        const page = pages[annotation.page]

        // skip invalid page indexes
        if (!page) {
          logger.warn(`Skipping annotation — invalid page index ${annotation.page}`)
          continue
        }

        // height needed to flip Y axis PDF origin is bottom-left, canvas is top-left
        const { height } = page.getSize()
        const fab = annotation.fabricJSON

       
        switch (annotation.type) {
          case 'highlight': {
            const rect = fab as unknown as FabricRect
            const [r, g, b] = hexToRgb(rect.fill || '#FFFF00')
            page.drawRectangle({
              x: rect.left,
              y: height - rect.top - rect.height,
              width: rect.width,
              height: rect.height,
              color: rgb(r, g, b),
              opacity: rect.opacity ?? 0.3
            })
            break
          }

          case 'strikethrough':
          case 'underline': {
            const line = fab as unknown as FabricLine
            page.drawLine({
              start: { x: line.x1, y: height - line.y1 },
              end:   { x: line.x2, y: height - line.y2 },
              thickness: 1.5,
              color: rgb(0, 0, 0)
            })
            break
          }

          default: {
            logger.warn(`Unhandled annotation type: ${annotation.type}`)
          }
        }
      }

      // save modified pdf back into bytes
      const savedPdf = await pdfDoc.save()

      // upload new annotated pdf
      const file = new File([savedPdf.buffer as ArrayBuffer], `annotated-${record.originalName}`, {
        type: 'application/pdf'
      })

      const { UTApi } = await import('uploadthing/server')
      const utapi = new UTApi()
      const uploaded = await utapi.uploadFiles(file)

      if (uploaded.error) throw new Error('Failed to upload annotated PDF to UploadThing')

      // save metadata for new file
      const now = new Date()
      storage.saveRecord({
        id: uploaded.data.key,
        originalName: `annotated-${record.originalName}`,
        url: uploaded.data.url,
        uploadedAt: now,
        expiresAt: new Date(now.getTime() + Number(process.env.FILE_LIFETIME_MINUTES || 45) * 60 * 1000),
        sizeMb: uploaded.data.size / (1024 * 1024)
      })

      logger.info(`Annotated PDF uploaded: ${uploaded.data.key}`)

      // return download link
      res.json({
        success: true,
        data: {
          downloadId: uploaded.data.key,
          url: uploaded.data.url
        }
      } as ApiResponse<{ downloadId: string; url: string }>)

    } catch (err) {
      next(err)
    }
  }
)

// SUMMARIZE 
pdfRouter.post(
  '/:id/summarize',
  summarizeRateLimit,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      // find pdf record
      // make sure file exists and isn't expired
      const record = storage.getRecord(req.params.id)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      // fetch pdf bytes
      const buffer = await storage.getBuffer(req.params.id)

      // extract text from pdf
      // cast result because pdfparse types are incomplete
      const parsed = await pdfParse(buffer) as unknown as PdfParseResult

      logger.info(`PDF parsed: numpages=${parsed.numpages}, pages length=${Array.isArray((parsed as any).pages) ? (parsed as any).pages.length : 'not array'}, numPages=${(parsed as any).numPages}`)

      // Determine page count (pdf-parse returns different field names)
      let totalPages = parsed.numpages || (parsed as any).numPages || 1
      if (Array.isArray((parsed as any).pages)) {
        totalPages = (parsed as any).pages.length
      }

      logger.info(`Final totalPages: ${totalPages}`)

      // if no text foun likely scanned/image pdf
      if (!parsed.text?.trim()) {
        res.status(422).json({
          success: false,
          error: 'Could not extract text. PDF may be scanned or image-based.'
        })
        return
      }

      // summarize extracted text
      const summary = await summarizePdf(parsed.text, totalPages)

      logger.info(`Summarized: ${req.params.id} (${totalPages} pages)`)

      // return summary + page count
      res.json({
        success: true,
        data: { summary, pages: parsed.numpages }
      } as ApiResponse<{ summary: string; pages: number }>)

    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        res.status(429).json({
          success: false,
          error: 'Too many requests right now. Please wait a moment and try again.'
        })
        return
      }
      next(err)
    }
  }
)

// ─── DELETE PAGES ────────────────────────────────────────────────────────────

pdfRouter.post(
  '/delete-pages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId, pagesToDelete }: DeletePagesRequestBody = req.body

      // validate required fields
      if (!fileId) {
        res.status(400).json({ success: false, error: 'Missing fileId' })
        return
      }
      if (!Array.isArray(pagesToDelete) || pagesToDelete.length === 0) {
        res.status(400).json({ success: false, error: 'pagesToDelete must be a non-empty array' })
        return
      }

      // make sure file exists
      const record = storage.getRecord(fileId)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      // run service
      const result = await deletePagesService(fileId, pagesToDelete)

      logger.info(`Delete-pages complete for: ${fileId}`)

      res.json({
        success: true,
        data: result
      } as ApiResponse<{ fileUrl: string; fileKey: string }>)

    } catch (err) {
      next(err)
    }
  }
)

// ─── THUMBNAILS ──────────────────────────────────────────────────────────────

pdfRouter.post(
  '/thumbnails',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId }: { fileId: string } = req.body

      if (!fileId) {
        res.status(400).json({ success: false, error: 'Missing fileId' })
        return
      }

      const record = storage.getRecord(fileId)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      if (!generateThumbnails) {
        res.status(503).json({ success: false, error: 'Thumbnail generation is not available in this environment' })
        return
      }

      const result = await generateThumbnails(fileId)

      res.json({
        success: true,
        data: result
      } as ApiResponse<{ pages: { pageNumber: number; thumbnailUrl: string }[] }>)

    } catch (err) {
      next(err)
    }
  }
)

// ─── PROTECT PDF ─────────────────────────────────────────────────────────────

pdfRouter.post(
  '/protect',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId, password }: ProtectPdfRequestBody = req.body

      // validate required fields
      if (!fileId) {
        res.status(400).json({ success: false, error: 'Missing fileId' })
        return
      }
      if (!password || password.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Password must not be empty' })
        return
      }

      // make sure file exists
      const record = storage.getRecord(fileId)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      // run service
      const result = await protectPdfService(fileId, password)

      logger.info(`Protect-pdf complete for: ${fileId}`)

      res.json({
        success: true,
        data: result
      } as ApiResponse<{ fileUrl: string; fileKey: string }>)

    } catch (err) {
      next(err)
    }
  }
)

// ─── MARKDOWN EXPORT ─────────────────────────────────────────────────────────

pdfRouter.post(
  '/markdown',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId }: MarkdownExportRequestBody = req.body

      if (!fileId) {
        res.status(400).json({ success: false, error: 'Missing fileId' })
        return
      }

      const record = storage.getRecord(fileId)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      const result = await exportPdfToMarkdown(fileId)

      logger.info(`Markdown export complete for: ${fileId}`)

      res.json({
        success: true,
        data: result
      } as ApiResponse<{ fileUrl: string; fileKey: string }>)
    } catch (err: any) {
      if (err?.message === 'UNSUPPORTED_SCANNED_PDF') {
        res.status(422).json({
          success: false,
          error: 'Scanned or image-only PDFs are not supported yet. Please upload a text-based PDF.'
        })
        return
      }
      next(err)
    }
  }
)

// â”€â”€â”€ DARK MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pdfRouter.post(
  '/dark-mode',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId }: DarkModeRequestBody = req.body

      if (!fileId) {
        res.status(400).json({ success: false, error: 'Missing fileId' })
        return
      }

      const record = storage.getRecord(fileId)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      const result = await darkModeService(fileId)

      logger.info(`Dark-mode complete for: ${fileId}`)

      res.json({
        success: true,
        data: result
      } as ApiResponse<{ fileUrl: string; fileKey: string }>)
    } catch (err: any) {
      if (err?.message === 'UNSUPPORTED_SCANNED_PDF') {
        res.status(422).json({
          success: false,
          error: 'Scanned or image-only PDFs are not supported. Please upload a text-based PDF.'
        })
        return
      }
      next(err)
    }
  }
)

// ─── WATERMARK ───────────────────────────────────────────────────────────────

pdfRouter.post(
  '/watermark',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId, text, color, transparency, fontSize, position }: WatermarkPdfRequestBody = req.body

      if (!fileId) {
        res.status(400).json({ success: false, error: 'Missing fileId' })
        return
      }
      if (!text || text.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Watermark text must not be empty' })
        return
      }

      const record = storage.getRecord(fileId)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      const result = await watermarkPdfService(
        fileId,
        text,
        color || '#000000',
        transparency ?? 0.3,
        fontSize ?? 36,
        position || 'diagonal'
      )

      logger.info(`Watermark complete for: ${fileId}`)

      res.json({
        success: true,
        data: result
      } as ApiResponse<{ fileUrl: string; fileKey: string }>)
    } catch (err) {
      next(err)
    }
  }
)

pdfRouter.post(
  '/translate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId, targetLanguage }: TranslatePdfRequestBody = req.body

      if (!fileId) {
        res.status(400).json({ success: false, error: 'Missing fileId' })
        return
      }
      if (!targetLanguage) {
        res.status(400).json({ success: false, error: 'Missing targetLanguage' })
        return
      }

      const record = storage.getRecord(fileId)
      if (!record) {
        res.status(404).json({ success: false, error: 'File not found or expired' })
        return
      }

      const result = await pdfTranslationService.translatePdf(fileId, targetLanguage)

      logger.info(`Translation complete for: ${fileId} to ${targetLanguage}`)

      res.json({
        success: true,
        data: result
      } as ApiResponse<TranslatePdfResult>)
    } catch (err) {
      next(err)
    }
  }
)


