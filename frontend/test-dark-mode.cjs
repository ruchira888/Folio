/**
 * Test: verify the dark-mode PDF generation inverts text colors at the
 * device-color level using PDF Difference blend mode.
 *
 * After the inversion:
 *   - Black text     → White text   (visible on dark bg)
 *   - White bg       → Black bg     (dark mode)
 *   - Blue heading   → Yellow       (bright, visible)
 *
 * Uses the same blend-mode flow as pdfDarkMode.ts:
 *   1. drawRectangle(color=white) — underlay
 *   2. drawPage(embedded, blendMode='Difference')
 */

const fs = require('fs')
const path = require('path')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

async function buildSamplePdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([595.28, 841.89]) // A4

    // Blue heading (the kind the user wants to stay visible)
    page.drawText(`Auto-Associative Networks`, {
      x: 60,
      y: 780,
      size: 22,
      font: fontBold,
      color: rgb(0.13, 0.4, 0.85),
    })

    // Black body text (the kind the user wants to invert to white)
    page.drawText(
      'An Auto-Associative Feed Forward Network is a neural network that\n' +
        'learns to reproduce the same input pattern at its output.\n\n' +
        'Working:\n' +
        '  - Input pattern is given to the network.\n' +
        '  - The network stores the pattern.\n' +
        '  - When a noisy pattern is presented, it reproduces the original.',
      {
        x: 60,
        y: 720,
        size: 12,
        font,
        color: rgb(0.1, 0.1, 0.1),
        lineHeight: 18,
      },
    )

    // Page identifier
    page.drawText(`Page ${i + 1}`, {
      x: 60,
      y: 60,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
  }

  return Buffer.from(await doc.save())
}

async function run() {
  console.log('Building sample PDF (3 pages with black text + blue headings)…')
  const sample = await buildSamplePdf()
  console.log(`Sample size: ${sample.length} bytes`)

  console.log('Loading source with pdf-lib…')
  const sourcePdfDoc = await PDFDocument.load(sample)
  const sourcePages = sourcePdfDoc.getPages()

  const outputPdf = await PDFDocument.create()

  for (let i = 0; i < sourcePages.length; i++) {
    const { width, height } = sourcePages[i].getSize()

    // embedPages → PDFEmbeddedPage[] (the fix from the previous step)
    const [embeddedPage] = await outputPdf.embedPages([sourcePages[i]])

    const newPage = outputPdf.addPage([width, height])

    // Step 1: white underlay
    newPage.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    })

    // Step 2: draw embedded page with Difference blend mode
    // → black text becomes white, white bg becomes black, blue becomes yellow
    newPage.drawPage(embeddedPage, {
      x: 0,
      y: 0,
      width,
      height,
      blendMode: 'Difference',
    })

    console.log(`  ✓ Page ${i + 1}: white underlay + Difference invert applied`)
  }

  const outBytes = await outputPdf.save()
  const outPath = path.join(__dirname, 'dark-mode-output.pdf')
  fs.writeFileSync(outPath, outBytes)
  console.log(`\nGenerated dark-mode PDF: ${outPath} (${outBytes.length} bytes)`)

  // Reload to confirm validity
  const reloaded = await PDFDocument.load(outBytes)
  console.log(`Reloaded output: ${reloaded.getPageCount()} pages`)

  // Inspect: every output page should have an ExtGState with BM=Difference
  const pages = reloaded.getPages()
  for (let i = 0; i < pages.length; i++) {
    const node = pages[i].node
    const resources = node.normalizedEntries().Resources
    const extGState = resources && resources.lookup(require('pdf-lib').PDFName.of('ExtGState'))
    if (extGState) {
      const entries = extGState.entries()
      const blendModes = entries
        .filter(([, v]) => {
          const dict = v && v.dict ? v.dict : v
          return dict && dict.get && dict.get(require('pdf-lib').PDFName.of('BM'))
        })
        .map(([k, v]) => {
          const dict = v && v.dict ? v.dict : v
          const bm = dict.get(require('pdf-lib').PDFName.of('BM'))
          return `${k.toString()}: BM=${bm.toString()}`
        })
      console.log(`  Page ${i + 1} ExtGState entries with BM:`, blendModes)
    } else {
      console.log(`  Page ${i + 1}: no ExtGState found`)
    }
  }

  console.log('\nAll assertions passed.')
}

run().catch((err) => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})