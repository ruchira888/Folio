import { PDFDocument as PdfLibDocument, rgb, StandardFonts } from 'pdf-lib'
import { UTApi } from 'uploadthing/server'
import { storage } from '../index'
import { logger } from '../logger'

export interface PageNumbersResult {
  fileUrl: string
  fileKey: string
}

/**
 * Add page numbers to the bottom center of every page in a PDF.
 */
export async function addPageNumbersService(fileId: string): Promise<PageNumbersResult> {
  const record = storage.getRecord(fileId)
  if (!record) throw new Error('File not found or expired')

  const buffer = await storage.getBuffer(fileId)
  const pdfDoc = await (PdfLibDocument as any).load(buffer)
  const pages = pdfDoc.getPages()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]
    const { width, height } = page.getSize()
    const pageLabel = String(index + 1)
    const fontSize = Math.max(9, Math.min(12, Math.round(height * 0.015)))
    const textWidth = font.widthOfTextAtSize(pageLabel, fontSize)
    const x = (width - textWidth) / 2
    const y = Math.max(14, Math.round(height * 0.03))

    page.drawText(pageLabel, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.35, 0.35, 0.35),
    })
  }

  const bytes = await pdfDoc.save()
  const finalName = record.originalName.replace(/\.pdf$/i, '-numbered.pdf')
  const file = new File(
    [bytes.buffer as ArrayBuffer],
    finalName,
    { type: 'application/pdf' },
  )

  const utapi = new UTApi()
  const uploaded = await utapi.uploadFiles(file)

  if (uploaded.error) throw new Error('Failed to upload numbered PDF to UploadThing')

  const now = new Date()
  storage.saveRecord({
    id: uploaded.data.key,
    originalName: finalName,
    url: uploaded.data.url,
    uploadedAt: now,
    expiresAt: new Date(now.getTime() + Number(process.env.FILE_LIFETIME_MINUTES || 45) * 60 * 1000),
    sizeMb: uploaded.data.size / (1024 * 1024),
  })

  logger.info(`Page-numbered PDF uploaded: ${uploaded.data.key}`)

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key,
  }
}
