// Deterministic fixture generator for the Small Editor test harness.
// Run: bun run scripts/make-fixtures.ts   (FORCE=1 regenerates everything)
// Every fixture is built from fixed inputs (no timestamps, no randomness) so
// smoke-test.ts and http-matrix.ts can assert on real content properties.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  StandardFonts,
  rgb,
} from '@cantoo/pdf-lib'
import { decodePng, encodePng, writeDocx } from '../src/lib/pdf-tools/writers'

const DIR = join(import.meta.dir, 'fixtures')
const FORCE = process.env.FORCE === '1'

function out(name: string): string {
  return join(DIR, name)
}

function stale(name: string): boolean {
  return FORCE || !existsSync(out(name))
}

function sh(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stderr.toString().trim()}`)
}

function have(cmd: string): boolean {
  return spawnSync('bash', ['-c', `command -v ${cmd}`]).status === 0
}

function redRgba(w: number, h: number): Uint8Array {
  const px = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = 220
    px[i * 4 + 1] = 30
    px[i * 4 + 2] = 30
    px[i * 4 + 3] = 255
  }
  return px
}

function grayRgba(w: number, h: number): Uint8Array {
  const px = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = 136
    px[i * 4 + 1] = 136
    px[i * 4 + 2] = 136
    px[i * 4 + 3] = 255
  }
  return px
}

// Nearest-neighbor rotation around the center, output stays W×H (same math as
// the deskew handler's rotateBitmap — the fixture skews, deskew straightens).
function rotateBitmap(
  img: { rgba: Uint8Array; width: number; height: number },
  deg: number,
): { rgba: Uint8Array; width: number; height: number } {
  const { rgba: src, width: W, height: H } = img
  const outBuf = new Uint8Array(W * H * 4).fill(255)
  const s = (deg * Math.PI) / 180
  const cos = Math.cos(s)
  const sin = Math.sin(s)
  const cx = W / 2
  const cy = H / 2
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx
      const dy = y - cy
      const sx = Math.round(cx + dx * cos + dy * sin)
      const sy = Math.round(cy - dx * sin + dy * cos)
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue
      const si = (sy * W + sx) * 4
      const di = (y * W + x) * 4
      outBuf[di] = src[si]
      outBuf[di + 1] = src[si + 1]
      outBuf[di + 2] = src[si + 2]
      outBuf[di + 3] = 255
    }
  }
  return { rgba: outBuf, width: W, height: H }
}

// pdftoppm writes "prefix-1.png" (or zero-padded from 10 pages up) — find them.
function pdftoppmPages(prefix: string, ext: string): string[] {
  const base = prefix.split('/').pop() ?? prefix
  return readdirSync(tmpdir())
    .filter((n) => n.startsWith(`${base}-`) && n.endsWith(`.${ext}`))
    .sort()
    .map((n) => join(tmpdir(), n))
}

let tmpSeq = 0
function tmpPrefix(tag: string): string {
  return join(tmpdir(), `fix-${process.pid}-${tmpSeq++}-${tag}`)
}

// ---------------------------------------------------------------- fixtures

// 5 pages A4: big heading, a red rectangle, and a 2x3 table block on page 3.
async function makeAlpha(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  for (let n = 1; n <= 5; n++) {
    const page = doc.addPage([595.28, 841.89])
    page.drawText(`Alpha page ${n}`, { x: 60, y: 742, size: 28, font: bold, color: rgb(0.1, 0.1, 0.1) })
    page.drawRectangle({ x: 500, y: 700, width: 40, height: 30, color: rgb(0.86, 0.12, 0.12) })
    if (n === 3) {
      const rows = [
        ['Name', 'Qty'],
        ['Widget', '2'],
        ['Gadget', '5'],
      ]
      for (let i = 0; i < rows.length; i++) {
        page.drawText(rows[i][0], { x: 80, y: 500 - i * 24, size: 14, font, color: rgb(0, 0, 0) })
        page.drawText(rows[i][1], { x: 220, y: 500 - i * 24, size: 14, font, color: rgb(0, 0, 0) })
      }
    }
  }
  return Buffer.from(await doc.save())
}

async function makeBeta(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let n = 1; n <= 3; n++) {
    const page = doc.addPage([612, 792])
    page.drawText(`Beta page ${n}`, { x: 60, y: 700, size: 24, font, color: rgb(0, 0, 0) })
  }
  return Buffer.from(await doc.save())
}

// Copy of alpha limited to 2 pages, AES-256 encrypted with userPassword test123.
async function makeEncrypted(alpha: Buffer): Promise<Buffer> {
  const src = await PDFDocument.load(alpha)
  const doc = await PDFDocument.create()
  for (const p of await doc.copyPages(src, [0, 1])) doc.addPage(p)
  doc.encrypt({
    userPassword: 'test123',
    ownerPassword: 'test123',
    permissions: {
      printing: 'highResolution',
      copying: true,
      modifying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true,
    },
  })
  return Buffer.from(await doc.save())
}

async function makeForm(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Form fixture', { x: 72, y: 700, size: 20, font, color: rgb(0, 0, 0) })
  const form = doc.getForm()
  form.createTextField('name').addToPage(page, { x: 72, y: 600, width: 200, height: 24, font })
  form.createTextField('email').addToPage(page, { x: 72, y: 550, width: 200, height: 24, font })
  return Buffer.from(await doc.save())
}

// One page carrying a /Link and a /Highlight annotation (raw /Annots dicts).
async function makeAnnotated(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Annotated fixture', { x: 72, y: 700, size: 20, font, color: rgb(0, 0, 0) })
  page.drawText('link and highlight live here', { x: 72, y: 660, size: 12, font, color: rgb(0, 0, 0) })
  const ctx = doc.context
  const link = ctx.register(
    ctx.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [72, 600, 300, 620],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: 'https://example.com' },
    }),
  )
  const highlight = ctx.register(
    ctx.obj({
      Type: 'Annot',
      Subtype: 'Highlight',
      Rect: [72, 655, 260, 672],
      QuadPoints: [72, 655, 260, 655, 72, 672, 260, 672],
      F: 4,
    }),
  )
  page.node.set(PDFName.of('Annots'), ctx.obj([link, highlight]))
  return Buffer.from(await doc.save())
}

// 6 pages (3 chapters x 2 pages) with a real /Outlines tree:
// Chapter A@1 (level 1) > Section A.1@2 (level 2), Chapter B@3 > Section B.1@4.
async function makeBookmarks(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let n = 1; n <= 6; n++) {
    doc.addPage([595.28, 841.89]).drawText(`Bookmarks page ${n}`, { x: 60, y: 700, size: 20, font, color: rgb(0, 0, 0) })
  }
  // Mirror of the edit-bookmarks handler's outline builder.
  const entries = [
    { title: 'Chapter A', page: 1, level: 0 },
    { title: 'Section A.1', page: 2, level: 1 },
    { title: 'Chapter B', page: 3, level: 0 },
    { title: 'Section B.1', page: 4, level: 1 },
  ]
  const context = doc.context
  const pages = doc.getPages()
  const rootDict = context.obj({ Type: 'Outlines' })
  const rootRef = context.register(rootDict)
  const lastDictAt: (PDFDictLike | null)[] = []
  const lastRefAt: (PDFRef | null)[] = []
  const childCounts: number[] = []
  let totalCount = 0
  for (const entry of entries) {
    const level = Math.max(0, Math.round(entry.level))
    const parentDict = level === 0 ? rootDict : lastDictAt[level - 1]
    const parentRef = level === 0 ? rootRef : lastRefAt[level - 1]
    if (!parentDict || !parentRef) throw new Error('fixture outline skips a level')
    const dict = context.obj({
      Title: PDFHexString.fromText(entry.title),
      Parent: parentRef,
      Dest: [pages[entry.page - 1].ref, 'XYZ', null, null, null],
    })
    const ref = context.register(dict)
    const prevDict = lastDictAt[level]
    const prevRef = lastRefAt[level]
    if (prevDict && prevRef) {
      prevDict.set(PDFName.of('Next'), ref)
      dict.set(PDFName.of('Prev'), prevRef)
    }
    if (!parentDict.get(PDFName.of('First'))) parentDict.set(PDFName.of('First'), ref)
    parentDict.set(PDFName.of('Last'), ref)
    for (let l = 0; l < level; l++) {
      childCounts[l] = (childCounts[l] ?? 0) + 1
      lastDictAt[l]?.set(PDFName.of('Count'), PDFNumber.of(childCounts[l]))
    }
    totalCount++
    lastDictAt[level] = dict
    lastRefAt[level] = ref
    lastDictAt.splice(level + 1)
    lastRefAt.splice(level + 1)
  }
  rootDict.set(PDFName.of('Count'), PDFNumber.of(totalCount))
  doc.catalog.set(PDFName.of('Outlines'), rootRef)
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
  return Buffer.from(await doc.save())
}

async function makeMeta(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  doc.addPage([595.28, 841.89]).drawText('Meta fixture', { x: 60, y: 700, size: 20, font, color: rgb(0, 0, 0) })
  doc.setTitle('Fixture Title')
  doc.setAuthor('Fixture Author')
  doc.setSubject('Fixture Subject')
  doc.setKeywords(['fixture', 'metadata'])
  return Buffer.from(await doc.save())
}

async function makeImages(redPng: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const img = await doc.embedPng(redPng)
  for (let n = 0; n < 2; n++) {
    const page = doc.addPage([300, 200])
    page.drawImage(img, { x: 50, y: 50, width: 100, height: 80 })
  }
  return Buffer.from(await doc.save())
}

// 1 page holding a 40x30 PNG and a JPEG (pdftoppm raster of images.pdf p.1).
async function makeEmbeddedImg(redPng: Buffer, imagesPdf: Buffer): Promise<Buffer> {
  const prefix = tmpPrefix('raster')
  const tmpPdf = `${prefix}.pdf`
  writeFileSync(tmpPdf, imagesPdf)
  sh('pdftoppm', ['-jpeg', '-r', '72', tmpPdf, prefix])
  const jpg = readFileSync(pdftoppmPages(prefix, 'jpg')[0])

  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89])
  const big = await doc.embedJpg(jpg)
  page.drawImage(big, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  const small = await doc.embedPng(encodePng(redRgba(40, 30), 40, 30))
  page.drawImage(small, { x: 60, y: 60, width: 40, height: 30 })
  return Buffer.from(await doc.save())
}

// 120x90 blue JPEG: render a solid-blue 120x90pt page at 72dpi.
async function makePhotoJpg(): Promise<void> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([120, 90])
  page.drawRectangle({ x: 0, y: 0, width: 120, height: 90, color: rgb(0.16, 0.38, 0.86) })
  const prefix = tmpPrefix('photo')
  const tmpPdf = `${prefix}.pdf`
  writeFileSync(tmpPdf, Buffer.from(await doc.save()))
  sh('pdftoppm', ['-jpeg', '-r', '72', tmpPdf, prefix])
  writeFileSync(out('photo.jpg'), readFileSync(pdftoppmPages(prefix, 'jpg')[0]))
}

// alpha page 1 rasterized at 150dpi, tilted 4 degrees, re-embedded as a PDF.
async function makeTilted(alpha: Buffer): Promise<void> {
  const prefix = tmpPrefix('tilt')
  const tmpPdf = `${prefix}.pdf`
  writeFileSync(tmpPdf, alpha)
  sh('pdftoppm', ['-png', '-r', '150', tmpPdf, prefix])
  const img = decodePng(readFileSync(pdftoppmPages(prefix, 'png')[0]))
  const rotated = rotateBitmap(img, 4)
  const doc = await PDFDocument.create()
  const embedded = await doc.embedPng(encodePng(rotated.rgba, rotated.width, rotated.height))
  doc.addPage([rotated.width, rotated.height]).drawImage(embedded, {
    x: 0,
    y: 0,
    width: rotated.width,
    height: rotated.height,
  })
  writeFileSync(out('tilted.pdf'), Buffer.from(await doc.save()))
}

// 3x3 table with wide x-gaps so column clustering can separate the cells.
async function makeTable(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const rows = [
    ['A', '1', 'x'],
    ['B', '2', 'y'],
    ['C', '3', 'z'],
  ]
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      page.drawText(rows[r][c], { x: 72 + c * 40, y: 700 - r * 24, size: 14, font, color: rgb(0, 0, 0) })
    }
  }
  return Buffer.from(await doc.save())
}

// 4 invoice pages: 001 on pages 1-2, 002 on pages 3-4 (first line, top band).
async function makeMarker(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let n = 1; n <= 4; n++) {
    const page = doc.addPage([595.28, 841.89])
    page.drawText(n <= 2 ? 'Invoice 001' : 'Invoice 002', { x: 72, y: 782, size: 16, font, color: rgb(0, 0, 0) })
    page.drawText(`Body content ${n}`, { x: 72, y: 400, size: 12, font, color: rgb(0, 0, 0) })
  }
  return Buffer.from(await doc.save())
}

type PDFDictLike = { set(name: PDFName, value: unknown): void; get(name: PDFName): unknown }

// ---------------------------------------------------------------- main

async function main() {
  mkdirSync(DIR, { recursive: true })
  const made: string[] = []
  const skipNotice: string[] = []

  const put = (name: string, data: Buffer | string) => {
    writeFileSync(out(name), data)
    made.push(name)
  }

  if (stale('red.png')) put('red.png', encodePng(redRgba(100, 80), 100, 80))
  if (stale('gray.png')) put('gray.png', encodePng(grayRgba(100, 80), 100, 80))

  let alpha: Buffer | null = null
  if (stale('alpha.pdf')) {
    alpha = await makeAlpha()
    put('alpha.pdf', alpha)
  }
  if (alpha === null) alpha = readFileSync(out('alpha.pdf'))

  if (stale('beta.pdf')) put('beta.pdf', await makeBeta())
  if (stale('encrypted.pdf')) put('encrypted.pdf', await makeEncrypted(alpha))
  if (stale('form.pdf')) put('form.pdf', await makeForm())
  if (stale('annotated.pdf')) put('annotated.pdf', await makeAnnotated())
  if (stale('bookmarks.pdf')) put('bookmarks.pdf', await makeBookmarks())
  if (stale('meta.pdf')) put('meta.pdf', await makeMeta())

  let imagesPdf: Buffer | null = null
  if (stale('images.pdf')) {
    imagesPdf = await makeImages(readFileSync(out('red.png')))
    put('images.pdf', imagesPdf)
  }
  if (imagesPdf === null) imagesPdf = readFileSync(out('images.pdf'))
  if (stale('embedded-img.pdf')) put('embedded-img.pdf', await makeEmbeddedImg(readFileSync(out('red.png')), imagesPdf))

  if (stale('photo.jpg')) await makePhotoJpg()

  // gif/bmp/tiff/webp via ffmpeg (ImageMagick absent in this sandbox).
  if (have('ffmpeg')) {
    for (const ext of ['gif', 'bmp', 'tiff', 'webp']) {
      const name = `tiny.${ext}`
      if (stale(name)) {
        sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', out('red.png'), out(name)])
        made.push(name)
      }
    }
  } else {
    skipNotice.push('ffmpeg not found — tiny.gif/bmp/tiff/webp skipped (jpg-to-pdf exotic-format tests will adapt)')
  }

  if (stale('sample.docx')) {
    put('sample.docx', await writeDocx([{ text: 'Hello Word' }, { text: 'Second line', heading: true }]))
  }
  if (stale('sample.html')) {
    put('sample.html', '<html><body><h1>HTML Fixture</h1><p>Paragraph one.</p><p>Paragraph two.</p></body></html>')
  }
  if (stale('corrupt.pdf')) put('corrupt.pdf', alpha.subarray(0, 400))
  if (stale('tilted.pdf')) await makeTilted(alpha)
  if (stale('table.pdf')) put('table.pdf', await makeTable())
  if (stale('marker.pdf')) put('marker.pdf', await makeMarker())

  console.log(`fixtures dir: ${DIR}`)
  for (const name of made) console.log(`  made    ${name}`)
  for (const n of skipNotice) console.log(`  SKIPPED ${n}`)
  const all = readdirSync(DIR).sort()
  console.log(`present (${all.length}): ${all.join(' ')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
