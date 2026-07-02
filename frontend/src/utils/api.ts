const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface FileRecord {
  id: string
  originalName: string
  url: string
  uploadedAt: string
  expiresAt: string
  sizeMb: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface SummaryResponse {
  summary: string
  pages: number
}

/**
 * Register uploaded file metadata with backend
 * Called after UploadThing upload completes
 */
export async function uploadComplete(
  fileKey: string,
  url: string,
  originalName: string,
  sizeMb: number
): Promise<FileRecord> {
  const response = await fetch(`${API_BASE_URL}/api/upload/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileKey,
      url,
      originalName,
      sizeMb,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to register file')
  }

  const data: ApiResponse<FileRecord> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

/**
 * Get file metadata by ID
 */
export async function getFileMetadata(fileId: string): Promise<FileRecord> {
  const response = await fetch(`${API_BASE_URL}/api/upload/${fileId}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'File not found')
  }

  const data: ApiResponse<FileRecord> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

/**
 * Summarize PDF using Gemini AI
 * Extracts text from PDF and generates summary
 */
export async function summarizePdf(fileId: string): Promise<SummaryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/${fileId}/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to summarize PDF')
  }

  const data: ApiResponse<SummaryResponse> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

/**
 * Annotate PDF with Fabric.js annotations
 */
export async function annotatePdf(
  fileId: string,
  annotations: unknown[]
): Promise<{ downloadId: string; url: string }> {
  const response = await fetch(`${API_BASE_URL}/pdf/${fileId}/annotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, annotations }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to annotate PDF')
  }

  const data: ApiResponse<{ downloadId: string; url: string }> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

export interface PdfFileResult {
  fileUrl: string
  fileKey: string
}

export interface MarkdownFileResult {
  fileUrl: string
  fileKey: string
}

/**
 * Delete specific pages from a PDF
 */
export async function deletePages(
  fileId: string,
  pagesToDelete: number[]
): Promise<PdfFileResult> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/delete-pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, pagesToDelete }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete pages')
  }

  const data: ApiResponse<PdfFileResult> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

export interface Thumbnail {
  pageNumber: number
  thumbnailUrl: string
}

export interface ThumbnailsResponse {
  pages: Thumbnail[]
}

/**
 * Fetch PDF page thumbnails from the backend
 */
export async function getPdfThumbnails(fileId: string): Promise<ThumbnailsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/thumbnails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch thumbnails')
  }

  const data: ApiResponse<ThumbnailsResponse> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

/**
 * Password-protect a PDF
 */
export async function protectPdf(
  fileId: string,
  password: string
): Promise<PdfFileResult> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/protect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, password }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to protect PDF')
  }

  const data: ApiResponse<PdfFileResult> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

/**
 * Convert a PDF to dark mode and return a downloadable file.
 */
export async function darkModePdf(fileId: string): Promise<PdfFileResult> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/dark-mode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to convert PDF to dark mode')
  }

  const data: ApiResponse<PdfFileResult> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

/**
 * Convert a text-based PDF to Markdown and return a downloadable file.
 */
export async function convertPdfToMarkdown(fileId: string): Promise<MarkdownFileResult> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/markdown`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to convert PDF to Markdown')
  }

  const data: ApiResponse<MarkdownFileResult> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

export interface WatermarkPdfOptions {
  text: string
  color: string
  transparency: number
  fontSize: number
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'diagonal'
}

/**
 * Add page numbers to the bottom center of every page in a PDF.
 */
export async function addPageNumbers(fileId: string): Promise<PdfFileResult> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/page-numbers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add page numbers to PDF')
  }

  const data: ApiResponse<PdfFileResult> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

/**
 * Add a custom text watermark to every page of a PDF.
 */
export async function watermarkPdf(
  fileId: string,
  options: WatermarkPdfOptions
): Promise<PdfFileResult> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/watermark`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, ...options }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add watermark to PDF')
  }

  const data: ApiResponse<PdfFileResult> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}

/**
 * Translate a PDF to another language.
 */
export async function translatePdf(
  fileId: string,
  targetLanguage: string
): Promise<PdfFileResult> {
  const response = await fetch(`${API_BASE_URL}/api/pdf/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, targetLanguage }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to translate PDF')
  }

  const data: ApiResponse<PdfFileResult> = await response.json()
  if (!data.success || !data.data) {
    throw new Error('Invalid response from server')
  }

  return data.data
}


