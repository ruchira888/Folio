import { UTApi } from 'uploadthing/server'
import { storage } from '../index'
import { logger } from '../logger'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const execFileAsync = promisify(execFile)

const projectRoot: string = process.cwd()
const PYTHON_EXE = process.env.PYTHON_PATH || 'python'
const PROTECT_SCRIPT = path.join(projectRoot, 'src', 'scripts', 'protectPdf.py')

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

  const tempDir = os.tmpdir()
  const inputPath = path.join(tempDir, `protect-in-${fileId}.pdf`)
  const outputPath = path.join(tempDir, `protect-out-${fileId}.pdf`)

  let protectedBuffer: Buffer
  try {
    fs.writeFileSync(inputPath, buffer)

    const { stdout, stderr } = await execFileAsync(
      PYTHON_EXE,
      [PROTECT_SCRIPT, inputPath, outputPath, password],
      {
        timeout: 120000,
        maxBuffer: 20 * 1024 * 1024,
      }
    )

    if (stderr?.trim()) {
      logger.warn(`protectPdf.py stderr: ${stderr.trim()}`)
    }

    const result = stdout.trim()
    if (!result.startsWith('SUCCESS')) {
      throw new Error(result || 'Failed to encrypt PDF')
    }

    protectedBuffer = fs.readFileSync(outputPath)
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes('No module named') || message.includes('pikepdf')) {
      throw new Error('PDF encryption dependency missing on server (pikepdf).')
    }
    throw error
  } finally {
    try { fs.unlinkSync(inputPath) } catch {}
    try { fs.unlinkSync(outputPath) } catch {}
  }

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
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    sizeMb: uploaded.data.size / (1024 * 1024)
  })

  logger.info(`Protected PDF uploaded: ${uploaded.data.key}`)

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key
  }
}

