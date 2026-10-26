// Engine-level smoke test: covers all 44 tools by importing the handlers
// directly and running them against the real TTL store. Asserts real output
// properties (page counts, text content, encryption state, byte magic).
//
// Run: STORE_DIR=/tmp/smoke-store bun run scripts/smoke-test.ts
// (STORE_DIR defaults to a fresh per-run dir so tests never pollute the app.)

// MUST run before any src import touches the store.
process.env.STORE_DIR ||= `/tmp/smoke-store-${process.pid}`

import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from '@cantoo/pdf-lib'
import { unzipSync } from 'fflate'

const FIX = join(import.meta.dir, 'fixtures')

type StoredMeta = {
  id: string
  name: string
  mime: string
  size: number
  pages: number
}

const { putFile } = await import('../src/lib/pdf-tools/store')
const { buildContext, runHandler } = await import('../src/lib/pdf-tools/runner')
const { parsePageCount } = await import('../src/lib/pdf-tools/parse')
const { extractTextPages, extractOutline } = await import('../src/lib/pdf-tools/pdfjs-server')
const { mimeForExt } = await import('../src/lib/pdf-tools/mime')
const { TaskError } = await import('../src/lib/pdf-tools/errors')

// ---------------------------------------------------------------- harness

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function loadDoc(buf: Buffer): Promise<PDFDocument> {
  return PDFDocument.load(buf, { ignoreEncryption: true })
}

async function pageText(buf: Buffer): Promise<string[]> {
  const { pages } = await extractTextPages(buf)
  return pages.map((lines) => lines.map((l) => l.text).join(' '))
}

async function fix(name: string, mime?: string): Promise<StoredMeta> {
  const buf = readFileSync(join(FIX, name))
  const m = mime ?? mimeForExt(name.split('.').pop() ?? 'bin')
  const pages = m === 'application/pdf' ? parsePageCount(buf) : 0
  return putFile(buf, name, m, pages)
}

async function fixBytes(name: string): Promise<Buffer> {
  return readFileSync(join(FIX, name))
}

let seq = 0
async function run(slug: string, files: StoredMeta[], params: Record<string, unknown>) {
  const ctx = await buildContext(`smoke-${++seq}`, files, params)
  return runHandler(slug, files, params, ctx)
}

async function firstOutputBuf(res: { outputs: StoredMeta[] }): Promise<Buffer> {
  ok(res.outputs.length > 0, 'expected at least one output')
  const { readFileBuf } = await import('../src/lib/pdf-tools/store')
  const buf = await readFileBuf(res.outputs[0].id)
  ok(buf !== null, 'output missing from store')
  return buf
}

const tests: { name: string; fn: () => Promise<void> }[] = []
function test(name: string, fn: () => Promise<void>): void {
  tests.push({ name, fn })
}

async function expectError(fn: () => Promise<unknown>, code?: string, msgPart?: string): Promise<void> {
  try {
    await fn()
  } catch (e) {
    ok(e instanceof Error, `expected an Error, got ${String(e)}`)
    if (code) ok((e as TaskError).code === code, `expected code ${code}, got ${(e as TaskError).code}: ${(e as Error).message}`)
    if (msgPart) ok((e as Error).message.includes(msgPart), `expected message to contain "${msgPart}", got "${(e as Error).message}"`)
    return
  }
  throw new Error(`expected a throw${code ? ` (${code})` : ''}, but the call succeeded`)
}

// ---------------------------------------------------------------- 44 tools

test('merge: 5p + 3p -> 8p', async () => {
  const a = await fix('alpha.pdf')
  const b = await fix('beta.pdf')
  const res = await run('merge', [a, b], { normalizePageSizes: false, blankPageIfOdd: false })
  ok(res.outputs.length === 1, `want 1 output, got ${res.outputs.length}`)
  ok(res.outputs[0].name === 'merged.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 8, `want 8 pages, got ${doc.getPageCount()}`)
})

test('split ranges "1-2,3" -> 2 outputs (2p + 1p)', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('split', [a], { mode: 'ranges', ranges: '1-2,3', step: 1 })
  ok(res.outputs.length === 2, `want 2 outputs, got ${res.outputs.length}`)
  ok(res.outputs[0].name === 'alpha-1.pdf' && res.outputs[1].name === 'alpha-2.pdf', 'bad split names')
  const d1 = await loadDoc(await firstOutputBuf(res))
  ok(d1.getPageCount() === 2, `want 2 pages in part 1, got ${d1.getPageCount()}`)
})

test('split step 1 -> one file per page', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('split', [a], { mode: 'step', step: 1 })
  ok(res.outputs.length === 5, `want 5 outputs, got ${res.outputs.length}`)
  for (const o of res.outputs) ok(o.name.endsWith('.pdf'), `bad name ${o.name}`)
})

test('split-bookmarks level 1 -> 2 chapters (2p + 4p)', async () => {
  const bm = await fix('bookmarks.pdf')
  const res = await run('split-bookmarks', [bm], { level: 1, expression: '', includePageAfter: false })
  ok(res.outputs.length === 2, `want 2 outputs, got ${res.outputs.length}`)
  ok(res.outputs[0].name.includes('chapter-a'), `bad name ${res.outputs[0].name}`)
  ok(res.outputs[1].name.includes('chapter-b'), `bad name ${res.outputs[1].name}`)
  const d1 = await loadDoc(await firstOutputBuf(res))
  ok(d1.getPageCount() === 2, `chapter A should span 2 pages, got ${d1.getPageCount()}`)
  const buf2 = await firstOutputBuf({ outputs: [res.outputs[1]] })
  const d2 = await loadDoc(await buf2)
  ok(d2.getPageCount() === 4, `chapter B should span 4 pages, got ${d2.getPageCount()}`)
})

test('split-middle vertical -> 10 half-pages', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('split-middle', [a], { ratio: 50, mode: 'vertical', repagination: false, rightToLeft: false })
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 10, `want 10 half pages, got ${doc.getPageCount()}`)
  const w = doc.getPage(0).getWidth()
  ok(Math.abs(w - 595.28 / 2) < 1, `half width should be ~297.6, got ${w}`)
})

test('split-size 1KB -> multiple parts', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('split-size', [a], { size: 1, sizeUnit: 'KB' })
  ok(res.outputs.length >= 2, `want >=2 outputs, got ${res.outputs.length}`)
  for (const o of res.outputs) {
    ok(o.size <= 1024 + 4096, `part ${o.name} way over limit: ${o.size}B`) // a single oversized page is allowed
    await loadDoc(await firstOutputBuf({ outputs: [o] }))
  }
})

test('split-text: Invoice 001 | Invoice 002 -> 2 docs of 2 pages', async () => {
  const m = await fix('marker.pdf')
  const res = await run('split-text', [m], { areaY: 0, areaHeight: 10, startsWith: 'Invoice' })
  ok(res.outputs.length === 2, `want 2 outputs (001 and 002), got ${res.outputs.length}`)
  const d1 = await loadDoc(await firstOutputBuf(res))
  ok(d1.getPageCount() === 2, `doc 1 should hold pages 1-2, got ${d1.getPageCount()}`)
  const buf2 = await firstOutputBuf({ outputs: [res.outputs[1]] })
  const d2 = await loadDoc(buf2)
  ok(d2.getPageCount() === 2, `doc 2 should hold pages 3-4, got ${d2.getPageCount()}`)
  ok((await pageText(buf2))[0].includes('Invoice 002'), 'doc 2 first page should carry Invoice 002')
})

test('extract-pages 2-4 -> 3 pages', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('extract-pages', [a], { pages: '2-4' })
  ok(res.outputs[0].name === 'alpha-extract.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 3, `want 3 pages, got ${doc.getPageCount()}`)
})

test('delete-pages 2 -> 4 pages', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('delete-pages', [a], { pages: '2' })
  ok(res.outputs[0].name === 'alpha-deleted.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 4, `want 4 pages, got ${doc.getPageCount()}`)
})

test('alternate-mix: interleave 5p+3p -> 6 pages, sizes alternate', async () => {
  const a = await fix('alpha.pdf')
  const b = await fix('beta.pdf')
  const res = await run('alternate-mix', [a, b], { step: 1, reverse: false, repeat: false })
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 6, `want 6 pages (stop at first exhaustion), got ${doc.getPageCount()}`)
  const w0 = doc.getPage(0).getWidth()
  const w1 = doc.getPage(1).getWidth()
  ok(Math.abs(w0 - 595.28) < 1, `page 1 should be A4-wide, got ${w0}`)
  ok(Math.abs(w1 - 612) < 1, `page 2 should be letter-wide, got ${w1}`)
})

test('organize reversed -> page 1 is "Alpha page 5"', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('organize', [a], { order: [4, 3, 2, 1, 0] })
  const buf = await firstOutputBuf(res)
  const doc = await loadDoc(buf)
  ok(doc.getPageCount() === 5, `want 5 pages, got ${doc.getPageCount()}`)
  ok((await pageText(buf))[0].includes('Alpha page 5'), 'page 1 of reversed output should read "Alpha page 5"')
})

test('rotate 90 -> /Rotate 90', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('rotate', [a], { angle: 90, pages: 'all' })
  ok(res.outputs[0].name === 'alpha-rotated.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPage(0).getRotation().angle === 90, `want rotation 90, got ${doc.getPage(0).getRotation().angle}`)
})

test('compress recommended: output <= input, still valid', async () => {
  const a = await fix('alpha.pdf')
  const inBytes = await fixBytes('alpha.pdf')
  const res = await run('compress', [a], { quality: 'recommended' })
  ok(res.outputs[0].name === 'alpha-compressed.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  ok(out.byteLength <= inBytes.byteLength, `compress grew the file: ${out.byteLength} > ${inBytes.byteLength}`)
  await loadDoc(out)
})

test('grayscale -> valid 5p output', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('grayscale', [a], { compressImages: true })
  ok(res.outputs[0].name === 'alpha-grayscale.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 5, `want 5 pages, got ${doc.getPageCount()}`)
})

test('crop: cropbox shrinks vs mediabox', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('crop', [a], { margin: 0 })
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 5, `want 5 pages, got ${doc.getPageCount()}`)
  const cb = doc.getPage(0).getCropBox()
  const mb = doc.getPage(0).getMediaBox()
  ok(cb.width < mb.width - 10 && cb.height < mb.height - 10, `cropbox ${cb.width}x${cb.height} should be smaller than mediabox ${mb.width}x${mb.height}`)
})

test('resize beta -> A4 width ~595', async () => {
  const b = await fix('beta.pdf')
  const res = await run('resize', [b], { pageSize: 'a4', customWidth: 0, customHeight: 0, margin: 0, unit: 'pt' })
  ok(res.outputs[0].name === 'beta-resized.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  const w = doc.getPage(0).getWidth()
  ok(Math.abs(w - 595.28) < 1, `want A4 width 595.28, got ${w}`)
})

test('flip horizontal: valid, differs from input', async () => {
  const a = await fix('alpha.pdf')
  const inBytes = await fixBytes('alpha.pdf')
  const res = await run('flip', [a], { mode: 'horizontal' })
  ok(res.outputs[0].name === 'flipped.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  ok(!out.equals(inBytes), 'flip output must differ from input')
  const doc = await loadDoc(out)
  ok(doc.getPageCount() === 5, `want 5 pages, got ${doc.getPageCount()}`)
})

test('n-up 2 -> 3 sheets of 2 (last sheet 1 page)', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('n-up', [a], { n: 2, pageOrdering: 'horizontal', preservePageSize: false })
  ok(res.outputs[0].name === 'n-up.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 3, `want 3 sheets, got ${doc.getPageCount()}`)
  const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()]
  ok(Math.abs(w - 842) < 1 && Math.abs(h - 595) < 1, `sheet should be A4 landscape, got ${w}x${h}`)
})

test('deskew tilted.pdf: valid 1-page output', async () => {
  const t = await fix('tilted.pdf')
  const res = await run('deskew', [t], { onlyStronglySkewed: true })
  ok(res.outputs[0].name === 'tilted-deskew.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 1, `want 1 page, got ${doc.getPageCount()}`)
})

test('repair corrupt.pdf: loads with >=1 page', async () => {
  const c = await fix('corrupt.pdf')
  const res = await run('repair', [c], {})
  ok(res.outputs[0].name === 'repaired.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() >= 1, 'repair should recover at least one page')
})

test('sign: places red.png signature', async () => {
  const a = await fix('alpha.pdf')
  const sig = await putFile(await fixBytes('red.png'), 'signature.png', 'image/png')
  const inBytes = await fixBytes('alpha.pdf')
  const res = await run('sign', [a], { pageNumber: 1, x: 40, y: 40, width: 150, imageDataId: sig.id })
  ok(res.outputs[0].name === 'alpha-signed.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  ok(!out.equals(inBytes), 'sign output must differ from input')
  await loadDoc(out)
})

test('pdf-editor: text op lands in page text', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('pdf-editor', [a], {
    ops: [
      { kind: 'text', page: 1, x: 100, y: 400, text: 'EDITED', fontSize: 16, color: '#111111' },
      { kind: 'rect', page: 1, x: 10, y: 10, width: 100, height: 30, color: '#ffffff' },
    ],
  })
  ok(res.outputs[0].name === 'alpha-edited.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  ok((await pageText(out))[0].includes('EDITED'), 'editor text op should appear in extracted text')
})

test('pdf-forms: creates 1 text field', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('pdf-forms', [a], { ops: [{ kind: 'textfield', page: 1, x: 100, y: 100, width: 160, name: 'field_1' }] })
  ok(res.outputs[0].name === 'alpha-form.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getForm().getFields().length === 1, `want 1 field, got ${doc.getForm().getFields().length}`)
})

test('watermark: bytes differ, text visible', async () => {
  const a = await fix('alpha.pdf')
  const inBytes = await fixBytes('alpha.pdf')
  const res = await run('watermark', [a], {
    text: 'DRAFT',
    fontSize: 48,
    opacity: 0.4,
    rotation: 45,
    color: '#888888',
    position: 'center',
    scale: 0.5,
  })
  ok(res.outputs[0].name === 'alpha-watermarked.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  ok(!out.equals(inBytes), 'watermark output must differ from input')
  ok((await pageText(out))[0].includes('DRAFT'), 'watermark text should be extractable')
})

test('page-numbers: "Page 1 of 5" on page 1', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('page-numbers', [a], {
    position: 'bottom-center',
    startAt: 1,
    pattern: 'Page {n} of {total}',
    font: 'helvetica',
    fontSize: 12,
    pages: 'all',
    margin: 20,
  })
  ok(res.outputs[0].name === 'alpha-numbered.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  ok((await pageText(out))[0].includes('Page 1 of 5'), `page 1 text missing "Page 1 of 5": "${(await pageText(out))[0]}"`)
})

test('header-footer: HF-1 footer on page 1', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('header-footer', [a], {
    pattern: 'HF-{n}',
    positions: ['footer-center'],
    font: 'helvetica',
    fontSize: 10,
    color: '#111111',
    margin: 20,
    pages: 'all',
    startAt: 1,
  })
  ok(res.outputs[0].name === 'alpha-headerfooter.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  ok((await pageText(out))[0].includes('HF-1'), 'page 1 footer text missing HF-1')
})

test('bates-numbering: 2 files -> 8 pages, 000001/000006 stamps', async () => {
  const a = await fix('alpha.pdf')
  const b = await fix('beta.pdf')
  const res = await run('bates-numbering', [a, b], {
    style: 'full-bates',
    text: '',
    digits: 6,
    startFrom: 1,
    increment: 1,
    pageLocation: 'bottom-right',
    font: 'helvetica',
    fontSize: 10,
    color: '#111111',
    margin: 20,
  })
  ok(res.outputs[0].name === 'bates.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  const texts = await pageText(out)
  ok(texts.length === 8, `want 8 pages, got ${texts.length}`)
  ok(texts[0].includes('000001'), `page 1 should carry 000001: "${texts[0]}"`)
  ok(texts[5].includes('000006'), `page 6 should carry 000006: "${texts[5]}"`)
})

test('edit-metadata: title/author roundtrip', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('edit-metadata', [a], { title: 'My Title', author: 'Me', subject: 'Sub', keywords: 'a, b', removeAll: false })
  ok(res.outputs[0].name === 'alpha-metadata.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getTitle() === 'My Title', `bad title "${doc.getTitle()}"`)
  ok(doc.getAuthor() === 'Me', `bad author "${doc.getAuthor()}"`)
})

test('edit-bookmarks: extractOutline sees new entries', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('edit-bookmarks', [a], {
    entries: [
      { title: 'Intro', page: 1, level: 0 },
      { title: 'Deep', page: 2, level: 1 },
    ],
  })
  ok(res.outputs[0].name === 'alpha-bookmarks.pdf', `bad name ${res.outputs[0].name}`)
  const outline = await extractOutline(await firstOutputBuf(res))
  ok(outline !== null, 'outline should exist after edit-bookmarks')
  ok(outline!.some((o) => o.title === 'Intro' && o.page === 1), `Intro@1 missing: ${JSON.stringify(outline)}`)
  ok(outline!.some((o) => o.title === 'Deep' && o.page === 2), `Deep@2 missing: ${JSON.stringify(outline)}`)
})

test('rename: output named from top-band text', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('rename', [a], { renamePattern: '{text}', areaY: 0, areaHeight: 20 })
  ok(res.outputs[0].name.startsWith('Alpha'), `output should be renamed from "Alpha page 1", got ${res.outputs[0].name}`)
})

test('remove-annotations: link+highlight gone', async () => {
  const an = await fix('annotated.pdf')
  const res = await run('remove-annotations', [an], { annotationTypes: ['link', 'highlight'] })
  ok(res.outputs[0].name === 'annotated-clean.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  const { PDFArray, PDFName } = await import('@cantoo/pdf-lib')
  const annots = doc.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray)
  ok(!annots || annots.size() === 0, `want 0 annotations, got ${annots ? annots.size() : 'no /Annots'}`)
})

test('flatten forms: 2 fields -> 0 fields', async () => {
  const f = await fix('form.pdf')
  const res = await run('flatten', [f], { mode: 'forms', resolution: 150 })
  ok(res.outputs[0].name === 'form-flattened.pdf', `bad name ${res.outputs[0].name}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getForm().getFields().length === 0, `want 0 fields after flatten, got ${doc.getForm().getFields().length}`)
})

test('protect: AES-256, loads only with password', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('protect', [a], {
    userPassword: 'test123',
    ownerPassword: '',
    allowPrinting: true,
    allowCopying: false,
    allowModifying: false,
    allowAnnotating: false,
    allowFillingForms: false,
    allowAccessibility: true,
    allowAssembly: false,
  })
  ok(res.outputs[0].name === 'alpha-protected.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  let plainThrew = false
  try {
    await PDFDocument.load(out)
  } catch {
    plainThrew = true
  }
  ok(plainThrew, 'protected output must not load without a password')
  const doc = await PDFDocument.load(out, { password: 'test123' })
  ok(doc.getPageCount() === 5, `want 5 pages, got ${doc.getPageCount()}`)
})

test('unlock: fresh decrypted doc (no /Encrypt, passwordless load)', async () => {
  const e = await fix('encrypted.pdf')
  const res = await run('unlock', [e], { password: 'test123' })
  ok(res.outputs[0].name === 'encrypted-unlocked.pdf', `bad name ${res.outputs[0].name}`)
  const out = await firstOutputBuf(res)
  const doc = await PDFDocument.load(out) // plain load: no options at all
  ok(!doc.isEncrypted, 'unlocked output must not be encrypted')
  ok(doc.getPageCount() === 2, `want 2 pages, got ${doc.getPageCount()}`)
})

test('protect -> unlock roundtrip', async () => {
  const a = await fix('alpha.pdf')
  const prot = await run('protect', [a], {
    userPassword: 'pw-roundtrip',
    ownerPassword: '',
    allowPrinting: true,
    allowCopying: false,
    allowModifying: false,
    allowAnnotating: false,
    allowFillingForms: false,
    allowAccessibility: true,
    allowAssembly: false,
  })
  const unlocked = await run('unlock', prot.outputs, { password: 'pw-roundtrip' })
  const doc = await PDFDocument.load(await firstOutputBuf(unlocked))
  ok(!doc.isEncrypted && doc.getPageCount() === 5, 'roundtrip output should be a plain 5-page doc')
})

test('ocr both: searchable pdf + txt containing "Alpha" (real tesseract)', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('ocr', [a], { lang: 'eng', outputFormat: 'both' })
  ok(res.outputs.length === 2, `want pdf + txt, got ${res.outputs.length}`)
  ok(res.outputs[0].name === 'alpha-ocr.pdf' && res.outputs[1].name === 'alpha-ocr.txt', `bad names ${res.outputs.map((o) => o.name)}`)
  const { readFileBuf } = await import('../src/lib/pdf-tools/store')
  const txt = (await readFileBuf(res.outputs[1].id))!.toString('utf8')
  ok(txt.includes('Alpha'), `ocr text should contain "Alpha": "${txt.slice(0, 120)}"`)
  const pdf = await loadDoc((await readFileBuf(res.outputs[0].id))!)
  ok(pdf.getPageCount() === 5, `ocr pdf should keep 5 pages, got ${pdf.getPageCount()}`)
})

test('pdf-to-jpg: 5 jpgs with JPEG magic', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('pdf-to-jpg', [a], { pages: 'all', resolution: 72, imageFormat: 'jpg', grayscale: false })
  ok(res.outputs.length === 5, `want 5 jpgs, got ${res.outputs.length}`)
  for (let i = 0; i < res.outputs.length; i++) {
    ok(res.outputs[i].name === `alpha-${i + 1}.jpg`, `bad name ${res.outputs[i].name}`)
    const buf = await firstOutputBuf({ outputs: [res.outputs[i]] })
    ok(buf[0] === 0xff && buf[1] === 0xd8, `${res.outputs[i].name} is not a JPEG`)
  }
})

test('pdf-to-text: beta text extracted', async () => {
  const b = await fix('beta.pdf')
  const res = await run('pdf-to-text', [b], {})
  ok(res.outputs[0].name === 'beta.txt', `bad name ${res.outputs[0].name}`)
  const txt = (await firstOutputBuf(res)).toString('utf8')
  ok(txt.includes('Beta page 1'), `txt should contain "Beta page 1": "${txt.slice(0, 80)}"`)
})

test('pdf-to-word: docx with "Alpha" in document.xml', async () => {
  const a = await fix('alpha.pdf')
  const res = await run('pdf-to-word', [a], {})
  ok(res.outputs[0].name === 'alpha.docx', `bad name ${res.outputs[0].name}`)
  const zip = unzipSync(await firstOutputBuf(res))
  const docXml = Buffer.from(zip['word/document.xml']).toString('utf8')
  ok(docXml.includes('Alpha'), 'document.xml should contain "Alpha"')
})

test('pdf-to-ppt: beta -> 3 slides', async () => {
  const b = await fix('beta.pdf')
  const res = await run('pdf-to-ppt', [b], { resolution: 150 })
  ok(res.outputs[0].name === 'beta.pptx', `bad name ${res.outputs[0].name}`)
  const zip = unzipSync(await firstOutputBuf(res))
  for (let s = 1; s <= 3; s++) ok(`ppt/slides/slide${s}.xml` in zip, `slide${s}.xml missing from pptx`)
})

test('pdf-to-excel: table.pdf -> 3 columns (A/1/x)', async () => {
  const t = await fix('table.pdf')
  const res = await run('pdf-to-excel', [t], { exportFormat: 'xlsx', singleSheet: false })
  ok(res.outputs[0].name === 'table.xlsx', `bad name ${res.outputs[0].name}`)
  const zip = unzipSync(await firstOutputBuf(res))
  const sheet = Buffer.from(zip['xl/worksheets/sheet1.xml']).toString('utf8')
  // inlineStr cells render as <t xml:space="preserve">A</t>, numerics as <v>1</v>
  ok(sheet.includes('>A<') && sheet.includes('>x<'), `xlsx should carry cells A and x: ${sheet.slice(0, 240)}`)
  ok(sheet.includes('<v>1</v>'), 'xlsx should carry numeric cell 1')
})

test('jpg-to-pdf: red+gray merged into 2-page pdf', async () => {
  const red = await fix('red.png')
  const gray = await fix('gray.png')
  const res = await run('jpg-to-pdf', [red, gray], { pageSize: 'fit', orientation: 'auto', margin: 0, mergeOutputs: true })
  ok(res.outputs.length === 1 && res.outputs[0].name === 'images-merged.pdf', `bad outputs ${res.outputs.map((o) => o.name)}`)
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === 2, `want 2 pages, got ${doc.getPageCount()}`)
})

test('jpg-to-pdf exotic: gif/bmp/tiff/webp (when ffmpeg made them)', async () => {
  const names = ['tiny.gif', 'tiny.bmp', 'tiny.tiff', 'tiny.webp'].filter((n) => {
    try {
      readFileSync(join(FIX, n))
      return true
    } catch {
      return false
    }
  })
  if (names.length === 0) {
    console.log('  SKIP exotic jpg-to-pdf (no ffmpeg fixtures)')
    return
  }
  const files: StoredMeta[] = []
  for (const n of names) files.push(await fix(n))
  const res = await run('jpg-to-pdf', files, { pageSize: 'fit', orientation: 'auto', margin: 0, mergeOutputs: true })
  const doc = await loadDoc(await firstOutputBuf(res))
  ok(doc.getPageCount() === names.length, `want ${names.length} pages, got ${doc.getPageCount()}`)
})

test('word-to-pdf: docx -> valid pdf with "Hello Word"', async () => {
  const d = await fix('sample.docx')
  const res = await run('word-to-pdf', [d], {})
  ok(res.outputs[0].name === 'sample.pdf', `bad name ${res.outputs[0].name}`)
  const buf = await firstOutputBuf(res)
  const doc = await loadDoc(buf)
  ok(doc.getPageCount() >= 1, 'word-to-pdf output should have pages')
  ok((await pageText(buf)).join(' ').includes('Hello Word'), 'converted pdf should contain "Hello Word"')
})

test('html-to-pdf code: <h1>Hi</h1> -> pdf', async () => {
  const res = await run('html-to-pdf', [], {
    source: 'code',
    url: '',
    htmlCode: '<h1>Hi</h1>',
    pageSize: 'A4',
    orientation: 'portrait',
    viewportWidth: 1024,
    margin: 10,
    delay: 0,
    usePrintMedia: false,
  })
  ok(res.outputs[0].name === 'code.pdf', `bad name ${res.outputs[0].name}`)
  await loadDoc(await firstOutputBuf(res))
})

test('html-to-pdf file: sample.html -> pdf', async () => {
  const h = await fix('sample.html', 'text/html')
  const res = await run('html-to-pdf', [h], {
    source: 'file',
    url: '',
    htmlCode: '',
    pageSize: 'A4',
    orientation: 'portrait',
    viewportWidth: 1024,
    margin: 10,
    delay: 0,
    usePrintMedia: false,
  })
  ok(res.outputs[0].name === 'sample.pdf', `bad name ${res.outputs[0].name}`)
  await loadDoc(await firstOutputBuf(res))
})

test('extract-images: >=1 png with PNG magic', async () => {
  const e = await fix('embedded-img.pdf')
  const res = await run('extract-images', [e], {})
  ok(res.outputs.length >= 1, `want >=1 image, got ${res.outputs.length}`)
  const buf = await firstOutputBuf(res)
  ok(res.outputs[0].name.endsWith('.png'), `bad name ${res.outputs[0].name}`)
  ok(buf[0] === 0x89 && buf[1] === 0x50, 'extracted image should be a PNG')
})

test('workflows: rotate 90 -> page-numbers chains', async () => {
  const a = await fix('alpha.pdf')
  const inBytes = await fixBytes('alpha.pdf')
  const res = await run('workflows', [a], {
    steps: [
      { type: 'rotate', params: { angle: 90, pages: 'all' } },
      {
        type: 'page-numbers',
        params: { position: 'bottom-center', startAt: 1, pattern: 'Page {n} of {total}', font: 'helvetica', fontSize: 12, pages: 'all', margin: 20 },
      },
    ],
  })
  ok(res.outputs.length === 1, `want 1 final output, got ${res.outputs.length}`)
  const buf = await firstOutputBuf(res)
  ok(!buf.equals(inBytes), 'workflow output must differ from input')
  const doc = await loadDoc(buf)
  ok(doc.getPageCount() === 5, `page count preserved, got ${doc.getPageCount()}`)
  ok(doc.getPage(0).getRotation().angle === 90, `final doc should carry the rotate step, got ${doc.getPage(0).getRotation().angle}`)
  ok((await pageText(buf))[0].includes('Page 1 of 5'), 'final doc should carry the page-numbers step')
})

// ---------------------------------------------------------------- regressions

test('regression: pageCount parsed at upload (alpha -> 5)', async () => {
  const meta = await fix('alpha.pdf')
  ok(meta.pages === 5, `upload-time pageCount should be 5, got ${meta.pages}`)
})

test('regression: encrypted.pdf pageCount visible at upload', async () => {
  const meta = await fix('encrypted.pdf')
  ok(meta.pages === 2, `encrypted pageCount should be 2, got ${meta.pages}`)
})

test('regression: parsePageCount on corrupt bytes never throws', async () => {
  // First 400 bytes of alpha.pdf: the fragment still contains one surviving
  // /Type /Page dict, so 1 is a legitimate count — the contract is graceful,
  // bounded parsing (never a throw, never a wild number).
  let pc = -1
  let threw = false
  try {
    pc = parsePageCount(await fixBytes('corrupt.pdf'))
  } catch {
    threw = true
  }
  ok(!threw, 'parsePageCount threw on truncated bytes')
  ok(pc >= 0 && pc <= 1, `parsePageCount(corrupt) should be 0 or 1, got ${pc}`)
})

// ---------------------------------------------------------------- negatives

test('negative: unknown task type throws BAD_REQUEST', async () => {
  await expectError(() => run('definitely-not-a-slug', [], {}), 'BAD_REQUEST', 'No handler')
})

test('negative: split range 99-100 on 5p doc throws', async () => {
  const a = await fix('alpha.pdf')
  await expectError(() => run('split', [a], { mode: 'ranges', ranges: '99-100', step: 1 }), 'INVALID_PARAMS', 'outside this document')
})

test('negative: sign on page 99 throws', async () => {
  const a = await fix('alpha.pdf')
  const sig = await putFile(await fixBytes('red.png'), 'signature.png', 'image/png')
  await expectError(() => run('sign', [a], { pageNumber: 99, x: 10, y: 10, width: 100, imageDataId: sig.id }), 'INVALID_PARAMS', 'outside this document')
})

test('negative: unlock with wrong password -> WRONG_PASSWORD', async () => {
  const e = await fix('encrypted.pdf')
  await expectError(() => run('unlock', [e], { password: 'not-the-password' }), 'WRONG_PASSWORD')
})

// ---------------------------------------------------------------- runner

let pass = 0
let fail = 0
const failures: string[] = []
for (const t of tests) {
  const t0 = Date.now()
  try {
    await t.fn()
    pass++
    console.log(`PASS  ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${t.name}: ${msg}`)
    console.log(`FAIL  ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n      ${msg}`)
  }
}
console.log(`\n${pass}/${tests.length} PASS  (store: ${process.env.STORE_DIR})`)
if (fail > 0) {
  console.log('failures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
