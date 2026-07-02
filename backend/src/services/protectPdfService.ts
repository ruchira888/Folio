import { PDFDocument as PdfLibDocument } from '@cantoo/pdf-lib'
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

  const documentToProtect = await PdfLibDocument.load(buffer)
  documentToProtect.encrypt({
    ownerPassword: password,
    userPassword: password,
    permissions: {
      printing: 'lowResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  })

  const protectedBuffer = await documentToProtect.save()

  // Upload to UploadThing
  const uploadBytes = new Uint8Array(protectedBuffer)
  const file = new File(
    [uploadBytes],
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
    expiresAt: new Date(now.getTime() + Number(process.env.FILE_LIFETIME_MINUTES || 45) * 60 * 1000),
    sizeMb: uploaded.data.size / (1024 * 1024)
  })

  logger.info(`Protected PDF uploaded: ${uploaded.data.key}`)

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key
  }
}

