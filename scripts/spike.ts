// Spike: verify the risky primitives before the big build.
// 1. pdf-lib embedPage boundingBox (crop / split-middle / nup)
// 2. pdf-lib drawPage negative xScale (flip mirror)
// 3. server-side pdfjs text extraction + outline
// 4. encrypt permissions API shape
// 5. chromium headless shell location
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'

async function main() {
  // build a 3-page source with text
  const src = await PDFDocument.create()
  const font = await src.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 3; i++) {
    const p = src.addPage([595, 842])
    p.drawText(`PAGE ${i + 1} hello`, { x: 60, y: 700, size: 24, font, color: rgb(0.1, 0.1, 0.8) })
  }
  const bytes = await src.save()

  // 1) embedPage with boundingBox = left half only
  const crop = await PDFDocument.create()
  const [cp] = await crop.copyPages(src, [0])
  crop.addPage(cp)
  const doc1 = await PDFDocument.load(bytes)
  const emb1 = await doc1.embedPage(doc1.getPage(0), { left: 0, bottom: 0, right: 297, top: 842 })
  const p1 = crop.addPage([297, 842])
  p1.drawPage(emb1, { x: 0, y: 0, width: 297, height: 842 })
  const out1 = await crop.save()
  console.log('SPIKE embedPage bbox OK, bytes:', out1.length)

  // 2) flip: negative xScale
  const flip = await PDFDocument.create()
  const e2 = await doc1.embedPage(doc1.getPage(0))
  const p2 = flip.addPage([595, 842])
  p2.drawPage(e2, { x: 595, y: 0, xScale: -1, yScale: 1, width: 595, height: 842 })
  const out2 = await flip.save()
  console.log('SPIKE flip negative scale OK, bytes:', out2.length)

  // 3) server pdfjs text extraction
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc3 = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
  const page3 = await doc3.getPage(1)
  const tc = await page3.getTextContent()
  const text = tc.items.map((it: any) => it.str).join(' ')
  console.log('SPIKE pdfjs text:', JSON.stringify(text))
  const outline = await doc3.getOutline()
  console.log('SPIKE pdfjs outline:', outline === null ? 'null (none)' : 'present')

  // 4) encrypt permissions shape
  const enc = await PDFDocument.load(bytes)
  try {
    enc.encrypt({ userPassword: 'x', ownerPassword: 'y', permissions: { printing: 'lowResolution', modifying: false, copying: false, annotating: false, fillingForms: true, contentAccessibility: true, documentAssembly: false } })
    const oe = await enc.save()
    console.log('SPIKE encrypt permissions OK, bytes:', oe.length)
  } catch (e) {
    console.log('SPIKE encrypt permissions FAILED:', String(e))
  }

  // 5) chromium candidates
  const { existsSync } = await import('fs')
  const { homedir } = await import('os')
  const cands = [
    `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1200/chrome-linux/headless_shell`,
    `${homedir()}/.cache/ms-playwright/chromium-1200/chrome-linux/chrome`,
  ]
  console.log('SPIKE chromium paths:', cands.map((c) => `${existsSync(c)} ${c}`).join(' | '))
}

main().catch((e) => { console.error('SPIKE FAILED', e); process.exit(1) })
