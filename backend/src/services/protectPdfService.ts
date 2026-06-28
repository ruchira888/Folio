import { PDFDocument as PdfLibDocument } from 'pdf-lib'
import { UTApi } from 'uploadthing/server'
import { storage } from '../index'
import { logger } from '../logger'

export interface ProtectPdfResult {
  fileUrl: string
  fileKey: string
}

/**
 * Password-protect a PDF.
 * Downloads the original PDF, encrypts it with the supplied password,
 * uploads the protected PDF to UploadThing, registers the new record,
 * and returns the download info.
 */
export async function protectPdfService(
  fileId: string,
  password: string
): Promise<ProtectPdfResult> {
  // Fetch original record
  const record = storage.getRecord(fileId)
  if (!record) throw new Error('File not found or expired')

  // Download PDF bytes
  const buffer = await storage.getBuffer(fileId)

  // Load into pdf-lib
  const documentToProtect: any = await (PdfLibDocument as any).load(buffer)

  // Encrypt with user-supplied password
  documentToProtect.encrypt({
    userPassword: password,
    ownerPassword: password
  })

  // Serialise protected PDF
  const bytes = await documentToProtect.save()

  // Upload to UploadThing
  const file = new File(
    [bytes.buffer as ArrayBuffer],
    `protected-${record.originalName}`,
    { type: 'application/pdf' }
  )
  const utapi = new UTApi()
  const uploaded = await utapi.uploadFiles(file)

  if (uploaded.error) throw new Error('Failed to upload protected PDF to UploadThing')

  // Persist new record
  const now = new Date()
  storage.saveRecord({
    id: uploaded.data.key,
    originalName: `protected-${record.originalName}`,
    url: uploaded.data.url,
    uploadedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    sizeMb: uploaded.data.size / (1024 * 1024)
  })

  logger.info(`Protected PDF uploaded: ${uploaded.data.key}`)

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key
  }
}

