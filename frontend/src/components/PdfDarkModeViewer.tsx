import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, ChevronLeft, ChevronRight, Loader2, Scan, FileText, Moon } from 'lucide-react'
import {
  loadPdf,
  scanPages,
  renderPageCanvas,
  renderTextLayer,
  applySoftInvert,
  generateDarkModePdf,
  type PdfDocument,
  type PageRenderResult,
} from '../utils/pdfDarkMode'

interface PdfDarkModeViewerProps {
  file: File
  onBack: () => void
}

interface RenderedPage {
  pageNumber: number
  pageType: 'text' | 'scanned'
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  textLayerRef: React.RefObject<HTMLDivElement | null>
  canvasContainerRef: React.RefObject<HTMLDivElement | null>
  width: number
  height: number
}

export default function PdfDarkModeViewer({ file, onBack }: PdfDarkModeViewerProps) {
  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [pageResults, setPageResults] = useState<PageRenderResult[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [renderingPages, setRenderingPages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 })

  // Track refs per page slot (pre-allocated so they survive re-renders)
  const pageRefs = useRef<{
    canvas: (HTMLCanvasElement | null)[]
    textLayer: (HTMLDivElement | null)[]
    canvasContainer: (HTMLDivElement | null)[]
  }>({ canvas: [], textLayer: [], canvasContainer: [] })

  // Load + scan
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    loadPdf(file)
      .then(async (doc) => {
        if (cancelled) return
        setPdf(doc)
        const results = await scanPages(doc)
        if (cancelled) return
        setPageResults(results)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load PDF')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [file])

  // Render visible pages
  const renderVisiblePages = useCallback(
    async (page: number) => {
      if (!pdf) return

      const pagesToRender = [page]
      if (page > 1) pagesToRender.unshift(page - 1)
      if (page < pageResults.length) pagesToRender.push(page + 1)

      setRenderingPages(true)
      for (const idx of pagesToRender) {
        const result = pageResults[idx - 1]
        if (!result) continue

        const canvas = pageRefs.current.canvas[idx - 1]
        const textLayerEl = pageRefs.current.textLayer[idx - 1]
        const canvasContainer = pageRefs.current.canvasContainer[idx - 1]

        if (!canvas || !textLayerEl || !canvasContainer) continue
        if (canvas.dataset.rendered === String(idx)) continue

        const sourcePage = await pdf.getPage(idx)

        // Canvas
        await renderPageCanvas(sourcePage, canvas)

        if (result.pageType === 'text') {
          // Text layer on top
          await renderTextLayer(sourcePage, textLayerEl)
          canvasContainer.style.filter = ''
        } else {
          // Scanned: soft invert the canvas container
          canvasContainer.style.filter = ''
          applySoftInvert(canvas)
        }

        canvas.dataset.rendered = String(idx)
        textLayerEl.dataset.rendered = String(idx)
      }
      setRenderingPages(false)
    },
    [pdf, pageResults],
  )

  useEffect(() => {
    if (pageResults.length === 0) return
    renderVisiblePages(currentPage)
  }, [currentPage, pageResults, renderVisiblePages])

  // Download
  const handleDownload = async () => {
    if (!pdf) return
    setDownloading(true)
    setDownloadProgress({ current: 0, total: pageResults.length })

    try {
      const blob = await generateDarkModePdf(
        file,
        pageResults,
        file.name.replace(/\.pdf$/i, '-dark.pdf'),
        (current, total) => setDownloadProgress({ current, total }),
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.pdf$/i, '-dark.pdf')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate dark-mode PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#F59E0B]" />
        <p className="text-sm font-medium text-slate-500">Loading PDF…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    )
  }

  if (!pdf || pageResults.length === 0) return null

  const result = pageResults[currentPage - 1]
  const textCount = pageResults.filter((r) => r.pageType === 'text').length
  const scannedCount = pageResults.length - textCount

  // Calculate scaled dimensions to fit modal
  const maxW = 680
  const maxH = 560
  const scaleX = maxW / result.width
  const scaleY = maxH / result.height
  const displayScale = Math.min(scaleX, scaleY, 1)
  const displayW = result.width * displayScale
  const displayH = result.height * displayScale

  // Pre-allocate refs up to page count
  while (pageRefs.current.canvas.length < pageResults.length) {
    pageRefs.current.canvas.push(null)
    pageRefs.current.textLayer.push(null)
    pageRefs.current.canvasContainer.push(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="flex items-center gap-3">
          {/* Page type badges */}
          <div className="hidden items-center gap-2 text-xs sm:flex">
            <span className="flex items-center gap-1 rounded-full bg-slate-700 px-2.5 py-1 font-medium text-slate-200">
              <FileText className="h-3 w-3" />
              {textCount} text
            </span>
            {scannedCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-slate-700 px-2.5 py-1 font-medium text-slate-300">
                <Scan className="h-3 w-3" />
                {scannedCount} scanned
              </span>
            )}
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-[#F59E0B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D97706] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {downloadProgress.current}/{downloadProgress.total}
                </span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download Dark PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Page info */}
      <p className="text-center text-xs font-medium text-slate-500">
        Page {currentPage} of {pageResults.length}
        {result.pageType === 'scanned' && ' · Scanned page — soft inverted'}
      </p>

      {/* Page viewer — dark themed */}
      <div className="flex justify-center overflow-auto bg-[#0a0a0a] rounded-2xl p-4">
        <div
          className="relative flex items-center justify-center"
          style={{ width: displayW, height: displayH }}
        >
          {/* Canvas container */}
          <div
            ref={(el) => {
              pageRefs.current.canvasContainer[currentPage - 1] = el
            }}
            style={{
              width: displayW,
              height: displayH,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <canvas
              ref={(el) => {
                pageRefs.current.canvas[currentPage - 1] = el
              }}
              width={result.width}
              height={result.height}
              style={{
                width: displayW,
                height: displayH,
                display: 'block',
              }}
            />

            {/* Text layer — only rendered for text pages */}
            <div
              ref={(el) => {
                pageRefs.current.textLayer[currentPage - 1] = el
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: displayW,
                height: displayH,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            />
          </div>
        </div>
      </div>

      {/* Page nav */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-300 transition-colors hover:border-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {pageResults.map((r, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`h-1.5 rounded-full transition-all ${
                i + 1 === currentPage
                  ? 'w-5 bg-[#F59E0B]'
                  : r.pageType === 'scanned'
                    ? 'w-1.5 bg-slate-600 hover:bg-slate-400'
                    : 'w-1.5 bg-slate-500 hover:bg-slate-300'
              }`}
              title={`Page ${i + 1} (${r.pageType})`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentPage((p) => Math.min(pageResults.length, p + 1))}
          disabled={currentPage === pageResults.length}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-300 transition-colors hover:border-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-slate-600">
        Text pages are fully searchable and selectable in the download
      </p>
    </div>
  )
}
