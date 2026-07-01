import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { pathToFileURL } from 'url'
import { UTApi } from 'uploadthing/server'
import { storage } from '../index'
import { logger } from '../logger'

const projectRoot: string = process.cwd()
const workerPath: string = projectRoot + '/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
const pdfjsAny = pdfjs as any
pdfjsAny.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

const standardFontsPath: string = projectRoot + '/node_modules/pdfjs-dist/standard_fonts/'
const standardFontDataUrl: string = pathToFileURL(standardFontsPath).href + '/'

const TEXT_THRESHOLD = 100

type TextFragment = {
  text: string
  x: number
  y: number
  width: number
  fontSize: number
  fontName: string
}

type TextLine = {
  fragments: TextFragment[]
  text: string
  x: number
  y: number
  fontSize: number
  isBold: boolean
  cells: string[]
}

type LineKind = 'blank' | 'heading' | 'bullet' | 'table' | 'paragraph'

export interface MarkdownExportResult {
  fileUrl: string
  fileKey: string
}

function clampSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
}

function detectBullet(text: string): { body: string; indentPrefix: string } | null {
  const bulletMatch = text.match(/^(?:[•\-–—*·◦▪])\s+(.*)$/)
  if (bulletMatch) {
    return { body: bulletMatch[1], indentPrefix: '' }
  }

  const numberedMatch = text.match(/^(\(?\d+[.)])\s+(.*)$/)
  if (numberedMatch) {
    return { body: numberedMatch[2], indentPrefix: numberedMatch[1] }
  }

  return null
}

function buildCells(fragments: TextFragment[]): string[] {
  if (fragments.length === 0) return []
  const sorted = [...fragments].sort((a, b) => a.x - b.x)
  const cells: string[] = []
  let current: string[] = [sorted[0].text]
  let previous = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const fragment = sorted[i]
    const gap = fragment.x - (previous.x + previous.width)
    if (gap > Math.max(22, previous.fontSize * 1.8)) {
      cells.push(clampSpace(current.join(' ')))
      current = [fragment.text]
    } else {
      current.push(fragment.text)
    }
    previous = fragment
  }

  cells.push(clampSpace(current.join(' ')))
  return cells.filter(cell => cell.length > 0)
}

function groupFragmentsIntoLines(fragments: TextFragment[]): TextLine[] {
  const ordered = [...fragments].sort((left, right) => {
    const yDelta = right.y - left.y
    if (Math.abs(yDelta) > 1) return yDelta
    return left.x - right.x
  })

  const groups: TextFragment[][] = []
  let currentGroup: TextFragment[] = []
  let currentY: number | null = null

  for (const fragment of ordered) {
    if (currentGroup.length === 0) {
      currentGroup = [fragment]
      currentY = fragment.y
      continue
    }

    const threshold = Math.max(2, fragment.fontSize * 0.35)
    if (currentY !== null && Math.abs(fragment.y - currentY) <= threshold) {
      currentGroup.push(fragment)
      currentY = (currentY * (currentGroup.length - 1) + fragment.y) / currentGroup.length
    } else {
      groups.push(currentGroup)
      currentGroup = [fragment]
      currentY = fragment.y
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups.map((group) => {
    const sorted = [...group].sort((left, right) => left.x - right.x)
    const text = clampSpace(sorted.map((fragment) => fragment.text).join(' '))
    const fontSize = Math.max(...sorted.map((fragment) => fragment.fontSize), 0)
    const isBold = sorted.some((fragment) => /bold|black|heavy|semibold|medium|gothic|bd|sb|w[6-9]/i.test(fragment.fontName))
    return {
      fragments: sorted,
      text,
      x: Math.min(...sorted.map((fragment) => fragment.x)),
      y: sorted[0]?.y ?? 0,
      fontSize,
      isBold,
      cells: buildCells(sorted),
    }
  })
}

function shouldSplitLine(line: TextLine, bodyFontSize: number, maxFontSize: number): boolean {
  if (line.cells.length < 2) return false
  
  // If it's classified as a table row, do not split it
  const shortCells = line.cells.filter(cell => cell.length <= 40).length
  if (shortCells >= 2) return false // Likely a table row

  return true
}

function splitLineIntoColumns(line: TextLine): TextLine[] {
  const sortedFrags = [...line.fragments].sort((a, b) => a.x - b.x)
  const cellGroups: TextFragment[][] = []
  let currentGroup: TextFragment[] = [sortedFrags[0]]
  let previous = sortedFrags[0]

  for (let i = 1; i < sortedFrags.length; i++) {
    const fragment = sortedFrags[i]
    const gap = fragment.x - (previous.x + previous.width)
    if (gap > Math.max(22, previous.fontSize * 1.8)) {
      cellGroups.push(currentGroup)
      currentGroup = [fragment]
    } else {
      currentGroup.push(fragment)
    }
    previous = fragment
  }
  cellGroups.push(currentGroup)

  return cellGroups.map(group => {
    const text = clampSpace(group.map(f => f.text).join(' '))
    const fontSize = Math.max(...group.map(f => f.fontSize), 0)
    const isBold = group.some(f => /bold|black|heavy|semibold|medium|gothic|bd|sb|w[6-9]/i.test(f.fontName))
    return {
      fragments: group,
      text,
      x: Math.min(...group.map(f => f.x)),
      y: line.y,
      fontSize,
      isBold,
      cells: [text]
    }
  })
}

function detectPageColumns(lines: TextLine[], minX: number, maxX: number): number | null {
  const width = maxX - minX
  if (width < 250) return null

  const centerX = minX + width / 2
  
  let leftCount = 0
  let rightCount = 0
  let crossingCount = 0

  for (const line of lines) {
    if (!line.text.trim()) continue
    const lineLeft = line.x
    const lineRight = Math.max(...line.fragments.map(f => f.x + f.width))

    if (line.y < 80 || line.y > 720) continue

    if (lineRight <= centerX + 15) {
      leftCount++
    } else if (lineLeft >= centerX - 15) {
      rightCount++
    } else {
      crossingCount++
    }
  }

  if (leftCount > 4 && rightCount > 4 && crossingCount / (leftCount + rightCount + crossingCount) < 0.35) {
    return centerX
  }

  return null
}

function sortPageLines(lines: TextLine[], minX: number, maxX: number): TextLine[] {
  const dividerX = detectPageColumns(lines, minX, maxX)
  if (dividerX === null) {
    return lines
  }

  const sortedLines = [...lines].sort((a, b) => b.y - a.y)
  const result: TextLine[] = []
  
  let leftBuffer: TextLine[] = []
  let rightBuffer: TextLine[] = []

  const flushColumns = () => {
    if (leftBuffer.length > 0) {
      leftBuffer.sort((a, b) => b.y - a.y)
      result.push(...leftBuffer)
      leftBuffer = []
    }
    if (rightBuffer.length > 0) {
      rightBuffer.sort((a, b) => b.y - a.y)
      result.push(...rightBuffer)
      rightBuffer = []
    }
  }

  for (const line of sortedLines) {
    if (!line.text.trim()) {
      result.push(line)
      continue
    }

    const lineLeft = line.x
    const lineRight = Math.max(...line.fragments.map(f => f.x + f.width))
    const isCrossing = lineLeft < dividerX - 15 && lineRight > dividerX + 15

    if (isCrossing) {
      flushColumns()
      result.push(line)
    } else if (lineRight <= dividerX + 15) {
      leftBuffer.push(line)
    } else {
      rightBuffer.push(line)
    }
  }

  flushColumns()
  return result
}

function classifyLine(line: TextLine, bodyFontSize: number, maxFontSize: number): LineKind {
  if (!line.text.trim()) return 'blank'

  const bullet = detectBullet(line.text)
  if (bullet) return 'bullet'

  if (line.cells.length >= 2) {
    const shortCells = line.cells.filter(cell => cell.length <= 40).length
    if (shortCells >= 2) return 'table'
  }

  const shortText = line.text.length <= 120
  const headingCandidate = shortText && (
    line.fontSize >= Math.max(16, maxFontSize * 0.75) ||
    (line.isBold && line.fontSize >= bodyFontSize - 1) ||
    (line.fontSize >= bodyFontSize + 3)
  )

  if (headingCandidate) return 'heading'

  return 'paragraph'
}

function headingLevel(line: TextLine, bodyFontSize: number, maxFontSize: number): number {
  if (line.fontSize >= Math.max(22, maxFontSize * 0.90)) return 1
  if (line.fontSize >= Math.max(16, maxFontSize * 0.78)) return 2
  return 3
}

function formatTable(rows: string[][]): string {
  if (rows.length === 0) return ''

  const columnCount = Math.max(...rows.map(row => row.length))
  const normalizedRows = rows.map((row) => {
    const padded = [...row]
    while (padded.length < columnCount) padded.push('')
    return padded.map(cell => escapeMarkdown(cell.trim()))
  })

  const header = normalizedRows[0]
  const separator = header.map(() => '---')
  const body = normalizedRows.slice(1)

  return [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function mergeParagraphLines(lines: TextLine[]): string {
  let paragraph = ''

  for (const line of lines) {
    const text = clampSpace(line.text)
    if (!text) continue

    if (paragraph.length === 0) {
      paragraph = text
      continue
    }

    if (paragraph.endsWith('-')) {
      paragraph = paragraph.slice(0, -1) + text
    } else {
      paragraph += ` ${text}`
    }
  }

  return paragraph.trim()
}

function formatPage(lines: TextLine[]): string {
  if (lines.length === 0) return ''

  // 1. Find bounds
  const xs = lines.filter(l => l.text.trim()).map(l => l.x)
  const minX = xs.length > 0 ? Math.min(...xs) : 0
  const maxXs = lines.filter(l => l.text.trim()).map(l => Math.max(...l.fragments.map(f => f.x + f.width)))
  const maxX = maxXs.length > 0 ? Math.max(...maxXs) : 600

  const ys = lines.filter(l => l.text.trim()).map(l => l.y)
  const minY = ys.length > 0 ? Math.min(...ys) : 0
  const maxY = ys.length > 0 ? Math.max(...ys) : 800

  // 2. Filter out page headers/footers containing page numbers
  const filteredLines = lines.filter(line => {
    const text = line.text.trim()
    const isPageNum = /^(page\s+)?\d+(\s*[\/\-]\s*\d+)?$/i.test(text) || /^\d+\s*of\s*\d+$/i.test(text)
    if (isPageNum && (line.y < minY + 45 || line.y > maxY - 45)) {
      return false
    }
    return true
  })

  // 3. Sort lines using layout-aware sorter
  const sortedLines = sortPageLines(filteredLines, minX, maxX)

  // 4. Calculate font sizes
  const fontSizes = sortedLines.filter(line => line.text.trim()).map(line => line.fontSize).sort((left, right) => left - right)
  const bodyFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 12
  const maxFontSize = fontSizes.length > 0 ? fontSizes[fontSizes.length - 1] : bodyFontSize

  const output: string[] = []
  let paragraphBuffer: TextLine[] = []
  let tableBuffer: TextLine[] = []

  const flushParagraph = () => {
    const paragraph = mergeParagraphLines(paragraphBuffer)
    if (paragraph) output.push(paragraph)
    paragraphBuffer = []
  }

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      output.push(formatTable(tableBuffer.map(line => line.cells)))
    } else if (tableBuffer.length === 1) {
      paragraphBuffer.push(tableBuffer[0])
      flushParagraph()
    }
    tableBuffer = []
  }

  for (const line of sortedLines) {
    const kind = classifyLine(line, bodyFontSize, maxFontSize)

    if (kind === 'blank') {
      flushTable()
      flushParagraph()
      continue
    }

    if (kind === 'heading') {
      flushTable()
      flushParagraph()
      const level = headingLevel(line, bodyFontSize, maxFontSize)
      output.push(`${'#'.repeat(level)} ${clampSpace(line.text)}`)
      continue
    }

    if (kind === 'bullet') {
      flushTable()
      flushParagraph()
      const bullet = detectBullet(line.text)
      const indentLevel = Math.max(0, Math.round((line.x - 30) / 18))
      const prefix = '  '.repeat(indentLevel)
      const marker = bullet?.indentPrefix && /^\d/.test(bullet.indentPrefix) ? `${bullet.indentPrefix} ` : '- '
      output.push(`${prefix}${marker}${escapeMarkdown(clampSpace(bullet?.body ?? line.text))}`)
      continue
    }

    if (kind === 'table') {
      flushParagraph()
      tableBuffer.push(line)
      continue
    }

    if (tableBuffer.length > 0) {
      flushTable()
    }

    // Separate paragraphs if the vertical gap is too large
    if (paragraphBuffer.length > 0) {
      const lastLine = paragraphBuffer[paragraphBuffer.length - 1]
      const gap = lastLine.y - line.y
      if (gap > Math.max(18, lastLine.fontSize * 1.9)) {
        flushParagraph()
      }
    }

    paragraphBuffer.push(line)
  }

  flushTable()
  flushParagraph()

  return output.join('\n\n').replace(/\n{3,}/g, '\n\n')
}

async function extractPageLines(page: any): Promise<TextLine[]> {
  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableCombineTextItems: false,
  } as any)

  const fragments: TextFragment[] = []

  for (const item of textContent.items ?? []) {
    const textItem = item as any
    if (!textItem?.str || typeof textItem.str !== 'string') continue

    const transform = Array.isArray(textItem.transform) ? textItem.transform : [1, 0, 0, 1, 0, 0]
    const fontSize = Math.max(4, Math.hypot(Number(transform[0]) || 0, Number(transform[1]) || 0))
    fragments.push({
      text: textItem.str,
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      width: Number(textItem.width) || 0,
      fontSize,
      fontName: String(textItem.fontName || ''),
    })
  }

  const rawLines = groupFragmentsIntoLines(fragments)
  
  const fontSizes = rawLines.filter(line => line.text.trim()).map(line => line.fontSize).sort((left, right) => left - right)
  const bodyFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 12
  const maxFontSize = fontSizes.length > 0 ? fontSizes[fontSizes.length - 1] : bodyFontSize

  const splitLines: TextLine[] = []
  for (const line of rawLines) {
    if (shouldSplitLine(line, bodyFontSize, maxFontSize)) {
      splitLines.push(...splitLineIntoColumns(line))
    } else {
      splitLines.push(line)
    }
  }

  return splitLines
}

function detectHasText(lines: TextLine[]): boolean {
  const rawText = lines.map(line => line.text).join(' ').trim()
  return rawText.length >= TEXT_THRESHOLD
}

function buildMarkdown(pages: string[]): string {
  const body = pages
    .map((pageText) => pageText.trim())
    .filter(pageText => pageText.length > 0)
    .join('\n\n')

  return `${body.trim()}\n`
}

export async function exportPdfToMarkdown(fileId: string): Promise<MarkdownExportResult> {
  const record = storage.getRecord(fileId)
  if (!record) throw new Error('File not found or expired')

  const buffer = await storage.getBuffer(fileId)
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    disableFontFace: true,
    standardFontDataUrl,
  } as any)

  const pdf = await loadingTask.promise
  const pageMarkdown: string[] = []
  let totalTextLength = 0

  try {
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex)
      const lines = await extractPageLines(page)

      totalTextLength += lines.map(line => line.text).join(' ').trim().length

      const markdown = formatPage(lines)
      if (markdown.trim()) {
        pageMarkdown.push(markdown)
      }

      page.cleanup()
    }
  } finally {
    pdf.destroy()
  }

  if (totalTextLength < TEXT_THRESHOLD) {
    throw new Error('UNSUPPORTED_SCANNED_PDF')
  }

  const markdownText = buildMarkdown(pageMarkdown)
  const markdownBytes = new TextEncoder().encode(markdownText)
  const file = new File(
    [markdownBytes],
    `${record.originalName.replace(/\.pdf$/i, '')}.md`,
    { type: 'text/markdown' },
  )

  const utapi = new UTApi()
  const uploaded = await utapi.uploadFiles(file)
  if (uploaded.error) throw new Error('Failed to upload markdown export to UploadThing')

  const now = new Date()
  storage.saveRecord({
    id: uploaded.data.key,
    originalName: `${record.originalName.replace(/\.pdf$/i, '')}.md`,
    url: uploaded.data.url,
    uploadedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    sizeMb: uploaded.data.size / (1024 * 1024),
  })

  logger.info(`Markdown export uploaded: ${uploaded.data.key}`)

  return {
    fileUrl: uploaded.data.url,
    fileKey: uploaded.data.key,
  }
}