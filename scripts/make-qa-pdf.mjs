// Build a small multi-page test PDF for editor QA.
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { writeFileSync } from 'fs'

const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)

for (let i = 1; i <= 2; i++) {
  const page = doc.addPage([595.28, 841.89]) // A4 portrait
  page.drawText(`Sample PDF for Editor QA — page ${i}`, { x: 60, y: 760, size: 18, font, color: rgb(0.1, 0.1, 0.1) })
  page.drawText('Line A: The quick brown fox jumps over the lazy dog.', { x: 60, y: 700, size: 12, font })
  page.drawText('Line B: Pack my box with five dozen liquor jugs.', { x: 60, y: 680, size: 12, font })
  page.drawText('Line C: How vexingly quick daft zebras jump!', { x: 60, y: 660, size: 12, font })
}

writeFileSync('/home/z/my-project/scripts/qa-sample.pdf', Buffer.from(await doc.save()))
console.log('wrote scripts/qa-sample.pdf')
