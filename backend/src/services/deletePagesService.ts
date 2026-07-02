import { PDFDocument as PdfLibDocument } from 'pdf-lib'
import { UTApi } from 'uploadthing/server'
import { storage } from '../index'
import { logger } from '../logger'

export interface DeletePagesResult {
  fileUrl: string
  fileKey: string
}

/**
 * Delete pages from a PDF.
 * Downloads the original PDF, removes the requested pages
 * (sorted descending so indices don't shift), uploads the modified PDF
 * to UploadThing, registers the new record, and returns the download info.
 */
export async function deletePagesService(
  fileId: string,
  pagesToDelete: number[]
): Promise<DeletePagesResult> {
  // Fetch original record
  const record = storage.getRecord(fileId)
  if (!record) throw new Error('File not found or expired')

  // Download PDF bytes
  const buffer = await storage.getBuffer(fileId)

  // Load into pdf-lib
  const pdfDoc = await (PdfLibDocument as any).load(buffer)
  const totalPages = pdfDoc.getPageCount()

  // Validate page numbers
  for (const p of pagesToDelete) {
    if (p < 1 || p > totalPages) {
      throw new Error(`Page ${p} is out of range (PDF has ${totalPages} pages)`)
    }
  }

  // Remove pages largest-first so indices stay valid
  pagesToDelete
    .sort((a, b) => b - a)
    .forEach(page => pdfDoc.removePage(page - 1))

  // Serialise modified PDF
  const bytes = await pdfDoc.save()

  // Upload to UploadThing
  const file = new File(
    [bytes.buffer as ArrayBuffer],
    `deleted-pages-${record.originalName}`,
    { type: 'application/pdf' }
  )
  const utapi = new UTApi()
  const uploaded = await utapi.uploadFiles(file)

  if (uploaded.error) throw new Error('Failed to upload modified PDF to UploadThing')

  // Persist new record
  const now = new Date()
  storage.saveRecord({
    id: uploaded.data.key,
    originalName: `deleted-pages-${record.originalName}`,
    url: uploaded.data.url,
    uploadedAt: now,
    expiresAt: new Date(now.getTime() + Number(process.env.FILE_LIFETIME_MINUTES || 45) * 60 * 1000),
    sizeMb: uploaded.data.size / (1024 * 1024)
  })

  logger.info(`Delete-pages PDF uploaded: ${uploaded.data.key}`)

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key
  }
}

