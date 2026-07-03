import { PDFDocument as PdfLibDocument } from 'pdf-lib'
import { UTApi } from 'uploadthing/server'
import { storage } from '../index'
import { logger } from '../logger'

export interface MergePdfResult {
  fileUrl: string
  fileKey: string
}

const MAX_FILES = 10
const MAX_SIZE_MB = 25

export async function mergePdfService(fileIds: string[]): Promise<MergePdfResult> {
  if (!Array.isArray(fileIds) || fileIds.length < 2) {
    throw new Error('MERGE_MIN_FILES')
  }

  if (fileIds.length > MAX_FILES) {
    throw new Error('MERGE_MAX_FILES')
  }

  const records = fileIds.map((fileId) => {
    const record = storage.getRecord(fileId)
    if (!record) throw new Error(`MERGE_FILE_NOT_FOUND:${fileId}`)
    if (record.sizeMb > MAX_SIZE_MB) throw new Error(`MERGE_FILE_TOO_LARGE:${fileId}`)
    return record
  })

  const buffers = await Promise.all(fileIds.map((fileId) => storage.getBuffer(fileId)))

  const mergedPdf = await PdfLibDocument.create()

  for (const buffer of buffers) {
    const srcPdf = await (PdfLibDocument as any).load(buffer)
    const pageIndices = srcPdf.getPageIndices()
    const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndices)
    for (const page of copiedPages) {
      mergedPdf.addPage(page)
    }
  }

  const mergedBytes = await mergedPdf.save()
  const firstName = records[0]?.originalName || 'document.pdf'
  const mergedName = firstName.replace(/\.pdf$/i, '') + '-merged.pdf'

  const file = new File([Buffer.from(mergedBytes)], mergedName, {
    type: 'application/pdf',
  })

  const utapi = new UTApi()
  const uploaded = await utapi.uploadFiles(file)

  if (uploaded.error) {
    throw new Error('Failed to upload merged PDF to UploadThing')
  }

  const now = new Date()
  storage.saveRecord({
    id: uploaded.data.key,
    originalName: mergedName,
    url: uploaded.data.url,
    uploadedAt: now,
    expiresAt: new Date(now.getTime() + Number(process.env.FILE_LIFETIME_MINUTES || 45) * 60 * 1000),
    sizeMb: uploaded.data.size / (1024 * 1024),
  })

  logger.info(`Merged PDF uploaded: ${uploaded.data.key} (${fileIds.length} files)`)

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key,
  }
}
