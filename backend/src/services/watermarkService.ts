import { PDFDocument as PdfLibDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import { UTApi } from 'uploadthing/server'
import { storage } from '../index'
import { logger } from '../logger'

export interface WatermarkPdfResult {
  fileUrl: string
  fileKey: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace(/^#/, '')
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('')
  }
  const bigint = parseInt(cleanHex, 16) || 0
  const r = ((bigint >> 16) & 255) / 255
  const g = ((bigint >> 8) & 255) / 255
  const b = (bigint & 255) / 255
  return { r, g, b }
}

/**
 * Apply a text watermark to every page of a PDF.
 */
export async function watermarkPdfService(
  fileId: string,
  text: string,
  color: string,
  transparency: number,
  fontSize: number,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'diagonal'
): Promise<WatermarkPdfResult> {
  const record = storage.getRecord(fileId)
  if (!record) throw new Error('File not found or expired')

  const buffer = await storage.getBuffer(fileId)
  const pdfDoc = await (PdfLibDocument as any).load(buffer)
  const pages = pdfDoc.getPages()
  
  // Embed bold Helvetica font for watermark
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { r, g, b } = hexToRgb(color)

  for (const page of pages) {
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const textHeight = font.heightAtSize(fontSize)
    
    let x = 20
    let y = 20
    let rotationAngle = 0

    switch (position) {
      case 'top-left':
        x = 20
        y = height - textHeight - 20
        break
      case 'top-right':
        x = width - textWidth - 20
        y = height - textHeight - 20
        break
      case 'bottom-left':
        x = 20
        y = 20
        break
      case 'bottom-right':
        x = width - textWidth - 20
        y = 20
        break
      case 'center':
        x = (width - textWidth) / 2
        y = (height - textHeight) / 2
        break
      case 'diagonal':
        // Compute diagonal angle of the page
        rotationAngle = Math.atan2(height, width) * (180 / Math.PI)
        const rad = rotationAngle * Math.PI / 180
        // Center the rotated text
        x = (width / 2) - (textWidth / 2) * Math.cos(rad) + (textHeight / 2) * Math.sin(rad)
        y = (height / 2) - (textWidth / 2) * Math.sin(rad) - (textHeight / 2) * Math.cos(rad)
        break
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(r, g, b),
      opacity: transparency,
      rotate: degrees(rotationAngle),
    })
  }

  const bytes = await pdfDoc.save()

  const finalName = record.originalName.replace(/\.pdf$/i, '-watermarked.pdf')
  const file = new File(
    [bytes.buffer as ArrayBuffer],
    finalName,
    { type: 'application/pdf' }
  )
  
  const utapi = new UTApi()
  const uploaded = await utapi.uploadFiles(file)

  if (uploaded.error) throw new Error('Failed to upload watermarked PDF to UploadThing')

  const now = new Date()
  storage.saveRecord({
    id: uploaded.data.key,
    originalName: finalName,
    url: uploaded.data.url,
    uploadedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    sizeMb: uploaded.data.size / (1024 * 1024)
  })

  logger.info(`Watermarked PDF uploaded: ${uploaded.data.key}`)

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key
  }
}
