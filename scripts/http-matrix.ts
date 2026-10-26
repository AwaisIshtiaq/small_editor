// HTTP-level matrix: exercises all 44 tools through the running dev server
// (POST /api/upload -> POST /api/tasks -> poll GET /api/tasks/:id -> GET
// /api/files/:id). Params mirror the UI's PARAM_DEFAULTS (tool-options.tsx)
// with the same minimal overrides the smoke suite uses.
//
// Run: bun run scripts/http-matrix.ts   (BASE_URL env overrides the target)

import { readFileSync } from 'fs'
import { join } from 'path'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const FIX = join(import.meta.dir, 'fixtures')

type Spec = {
  files: string[]
  params: Record<string, unknown>
  timeoutMs?: number
  note?: string
}

// Minimal-valid params per slug: PARAM_DEFAULTS where they already work,
// otherwise the same overrides the engine-level smoke suite sends.
const SPECS: Record<string, Spec> = {
  // --- Compress / Edit & Sign
  compress: { files: ['alpha.pdf'], params: { quality: 'recommended' } },
  'pdf-editor': {
    files: ['alpha.pdf'],
    params: {
      ops: [
        { kind: 'text', page: 1, x: 100, y: 400, text: 'EDITED', fontSize: 16, color: '#111111' },
        { kind: 'rect', page: 1, x: 10, y: 10, width: 100, height: 30, color: '#ffffff' },
      ],
    },
  },
  sign: { files: ['alpha.pdf'], params: {}, note: 'imageDataId injected from a red.png upload' },
  'pdf-forms': { files: ['alpha.pdf'], params: { ops: [{ kind: 'textfield', page: 1, x: 100, y: 100, width: 160, name: 'field_1' }] } },
  'delete-pages': { files: ['alpha.pdf'], params: { pages: '2' } },
  // --- Split
  'extract-pages': { files: ['alpha.pdf'], params: { pages: '1-3' } },
  split: { files: ['alpha.pdf'], params: { mode: 'ranges', ranges: '1-2,3', step: 1 } },
  'split-bookmarks': { files: ['bookmarks.pdf'], params: { level: 1, expression: '', includePageAfter: false } },
  'split-middle': { files: ['alpha.pdf'], params: { ratio: 50, mode: 'vertical', repagination: false, rightToLeft: false } },
  'split-size': { files: ['alpha.pdf'], params: { size: 1, sizeUnit: 'KB' } },
  'split-text': { files: ['marker.pdf'], params: { areaY: 0, areaHeight: 10, startsWith: 'Invoice' } },
  // --- Merge
  merge: { files: ['alpha.pdf', 'beta.pdf'], params: { normalizePageSizes: false, blankPageIfOdd: false } },
  'alternate-mix': { files: ['alpha.pdf', 'beta.pdf'], params: { step: 1, reverse: false, repeat: false } },
  organize: { files: ['alpha.pdf'], params: { order: [4, 3, 2, 1, 0] } },
  // --- Security
  protect: {
    files: ['alpha.pdf'],
    params: {
      userPassword: 'test123',
      ownerPassword: '',
      allowPrinting: true,
      allowCopying: false,
      allowModifying: false,
      allowAnnotating: false,
      allowFillingForms: false,
      allowAccessibility: true,
      allowAssembly: false,
    },
  },
  unlock: { files: ['encrypted.pdf'], params: { password: 'test123' } },
  watermark: {
    files: ['alpha.pdf'],
    params: { text: 'DRAFT', fontSize: 48, opacity: 0.2, rotation: 45, color: '#888888', position: 'center', scale: 0.5 },
  },
  flatten: { files: ['form.pdf'], params: { mode: 'forms', resolution: 150 } },
  // --- Convert from PDF
  'pdf-to-excel': { files: ['table.pdf'], params: { exportFormat: 'xlsx', singleSheet: false } },
  'pdf-to-jpg': { files: ['alpha.pdf'], params: { pages: 'all', resolution: 72, imageFormat: 'jpg', grayscale: false } },
  'pdf-to-ppt': { files: ['beta.pdf'], params: { resolution: 150 } },
  'pdf-to-text': { files: ['beta.pdf'], params: {} },
  'pdf-to-word': { files: ['alpha.pdf'], params: {} },
  // --- Convert to PDF
  'html-to-pdf': {
    files: [],
    params: {
      source: 'code',
      url: '',
      htmlCode: '<h1>Hi</h1>',
      pageSize: 'A4',
      orientation: 'portrait',
      viewportWidth: 1024,
      margin: 10,
      delay: 0,
      usePrintMedia: false,
    },
    note: '0 files — source=code',
  },
  'jpg-to-pdf': { files: ['red.png', 'gray.png'], params: { pageSize: 'fit', orientation: 'auto', margin: 0, mergeOutputs: true } },
  'word-to-pdf': { files: ['sample.docx'], params: {} },
  // --- Other
  crop: { files: ['alpha.pdf'], params: { margin: 0 } },
  'bates-numbering': {
    files: ['alpha.pdf', 'beta.pdf'],
    params: {
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
    },
  },
  'edit-bookmarks': { files: ['alpha.pdf'], params: { entries: [{ title: 'Intro', page: 1, level: 0 }, { title: 'Deep', page: 2, level: 1 }] } },
  'edit-metadata': { files: ['alpha.pdf'], params: { title: 'HTTP Title', author: '', subject: '', keywords: '', removeAll: false } },
  'extract-images': { files: ['embedded-img.pdf'], params: {} },
  flip: { files: ['alpha.pdf'], params: { mode: 'horizontal' } },
  grayscale: { files: ['alpha.pdf'], params: { compressImages: true } },
  'header-footer': {
    files: ['alpha.pdf'],
    params: { pattern: 'HF-{n}', positions: ['footer-center'], font: 'helvetica', fontSize: 10, color: '#111111', margin: 20, pages: 'all', startAt: 1 },
  },
  'n-up': { files: ['alpha.pdf'], params: { n: 2, pageOrdering: 'horizontal', preservePageSize: false } },
  'page-numbers': {
    files: ['alpha.pdf'],
    params: { position: 'bottom-center', startAt: 1, pattern: 'Page {n} of {total}', font: 'helvetica', fontSize: 12, pages: 'all', margin: 20 },
  },
  rename: { files: ['alpha.pdf'], params: { renamePattern: '{text}', areaY: 0, areaHeight: 20 } },
  repair: { files: ['corrupt.pdf'], params: {} },
  resize: { files: ['beta.pdf'], params: { pageSize: 'a4', customWidth: 0, customHeight: 0, margin: 0, unit: 'pt' } },
  rotate: { files: ['alpha.pdf'], params: { angle: 90, pages: 'all' } },
  'remove-annotations': { files: ['annotated.pdf'], params: { annotationTypes: ['link', 'highlight'] } },
  // --- Scans
  deskew: { files: ['tilted.pdf'], params: { onlyStronglySkewed: true } },
  ocr: { files: ['alpha.pdf'], params: { lang: 'eng', outputFormat: 'pdf' }, timeoutMs: 120_000, note: 'slow — real tesseract' },
  // --- Automate
  workflows: {
    files: ['alpha.pdf'],
    params: {
      steps: [
        { type: 'rotate', params: { angle: 90, pages: 'all' } },
        { type: 'page-numbers', params: { position: 'bottom-center', startAt: 1, pattern: 'Page {n} of {total}', font: 'helvetica', fontSize: 12, pages: 'all', margin: 20 } },
      ],
    },
  },
}

// Registry order keeps the report aligned with the UI catalog.
const { TOOLS } = (await import('../src/lib/pdf-tools/registry.ts')) as { TOOLS: { slug: string; name: string }[] }
const SLUGS = TOOLS.map((t) => t.slug)

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html',
}

function fixtureBuf(name: string): Buffer {
  return readFileSync(join(FIX, name))
}

async function upload(name: string, mime: string): Promise<string> {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(fixtureBuf(name))], name, { type: mime }))
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form })
  const body = await res.json()
  if (!res.ok) throw new Error(`upload ${name}: HTTP ${res.status} ${JSON.stringify(body)}`)
  return body.files[0].id
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

async function runOne(slug: string, spec: Spec): Promise<void> {
  const fileIds: string[] = []
  for (const f of spec.files) fileIds.push(await upload(f, MIME[f.split('.').pop() ?? ''] ?? 'application/octet-stream'))

  const params = { ...spec.params }
  if (slug === 'sign') {
    params.pageNumber = 1
    params.x = 40
    params.y = 40
    params.width = 150
    params.imageDataId = await upload('red.png', 'image/png')
  }

  const created = await fetch(`${BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: slug, fileIds, params }),
  })
  const createdBody = await created.json()
  if (!created.ok) throw new Error(`create: HTTP ${created.status} ${JSON.stringify(createdBody)}`)
  const taskId: string = createdBody.taskId

  const deadline = Date.now() + (spec.timeoutMs ?? 120_000)
  let status = 'processing'
  let last: Record<string, unknown> = {}
  while (Date.now() < deadline) {
    await sleep(500)
    const poll = await fetch(`${BASE}/api/tasks/${taskId}`)
    last = await poll.json()
    status = String(last.status)
    if (status !== 'processing') break
  }
  if (status !== 'done') {
    const err = last.error as { code?: string; message?: string } | undefined
    throw new Error(`task ${status}: ${err?.code ?? '?'} ${err?.message ?? '(timeout)'}`)
  }
  const outputs = last.outputs as { id: string; name: string; size: number }[]
  if (!Array.isArray(outputs) || outputs.length === 0) throw new Error('done but 0 outputs')

  const dl = await fetch(`${BASE}/api/files/${outputs[0].id}`)
  if (dl.status !== 200) throw new Error(`download HTTP ${dl.status}`)
  const bytes = new Uint8Array(await dl.arrayBuffer())
  if (bytes.length === 0) throw new Error('download returned 0 bytes')
  if (slug === 'pdf-to-jpg') {
    // jpg outputs start with the JPEG magic
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) throw new Error('pdf-to-jpg first output is not a JPEG')
  } else if (outputs[0].name.endsWith('.pdf')) {
    const head = Buffer.from(bytes.subarray(0, 5)).toString('latin1')
    if (!head.startsWith('%PDF-')) throw new Error('output is not a PDF')
  }
}

// ---------------------------------------------------------------- runner

let pass = 0
let fail = 0
const failures: string[] = []
for (const slug of SLUGS) {
  const spec = SPECS[slug]
  const t0 = Date.now()
  try {
    if (!spec) throw new Error('no spec in matrix')
    await runOne(slug, spec)
    pass++
    console.log(`PASS  ${slug} (${((Date.now() - t0) / 1000).toFixed(1)}s)${spec.note ? `  [${spec.note}]` : ''}`)
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${slug}: ${msg}`)
    console.log(`FAIL  ${slug} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n      ${msg}`)
  }
}
console.log(`\n${pass}/${SLUGS.length} PASS against ${BASE}`)
if (fail > 0) {
  console.log('failures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
