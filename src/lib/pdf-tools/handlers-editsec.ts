// Edit & sign + security handlers: annotation of pages (text/images/fields/
// stamps), document metadata & outline, and protection. Drawing uses standard
// fonts only (WinAnsi-sanitized); all UI coordinates are TOP-LEFT in pt and
// get converted to pdf-lib's BOTTOM-LEFT origin here.

import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib'
import type { PDFFont, PDFImage, PDFPage } from '@cantoo/pdf-lib'
import { TaskError } from './errors'
import { baseName } from './mime'
import { parsePageSelection } from './parse'
import type { ToolParams } from './registry'
import type { StoredMeta } from './store'
import { validateParams } from './tasks'
import type { TaskContext, TaskHandler } from './types'
import { pdfToImages, tesseractRun } from './bin'
import { extractTextPages } from './pdfjs-server'
import { convertHandlers, firstInput, hexToRgb, winAnsi } from './handlers-convert'
import { coreHandlers } from './handlers-core'

const PDF_MIME = 'application/pdf'

const FONTS = {
  helvetica: StandardFonts.Helvetica,
  times: StandardFonts.TimesRoman,
  courier: StandardFonts.Courier,
} as const

type FontName = keyof typeof FONTS
type Pos = { v: 'top' | 'bottom'; h: 'left' | 'center' | 'right' }

async function pickFont(doc: PDFDocument, name: FontName): Promise<PDFFont> {
  return doc.embedFont(FONTS[name] ?? StandardFonts.Helvetica)
}

// "bottom-center" | "header-left" | "top-right" … → { v, h } (header=top, footer=bottom)
function parsePosition(s: string): Pos {
  const pos: Pos = { v: 'bottom', h: 'center' }
  for (const part of (s ?? '').toLowerCase().split('-')) {
    if (part === 'top' || part === 'header') pos.v = 'top'
    else if (part === 'bottom' || part === 'footer') pos.v = 'bottom'
    else if (part === 'left') pos.h = 'left'
    else if (part === 'right') pos.h = 'right'
    else if (part === 'center') pos.h = 'center'
  }
  return pos
}

// Draw one text line anchored inside the margin box at the given position.
function stampAt(page: PDFPage, text: string, font: PDFFont, size: number, color: { r: number; g: number; b: number }, pos: Pos, margin: number): void {
  const tw = font.widthOfTextAtSize(text, size)
  const W = page.getWidth()
  const H = page.getHeight()
  const x = pos.h === 'left' ? margin : pos.h === 'right' ? W - margin - tw : (W - tw) / 2
  const y = pos.v === 'top' ? H - margin - size : margin
  page.drawText(text, { x, y, size, font, color: rgb(color.r, color.g, color.b) })
}

// ---- edit & sign ----

const sign: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['sign']
  const { file, buf } = await firstInput(ctx)
  const imgBuf = await ctx.readBuf(p.imageDataId)
  if (!imgBuf) throw new TaskError('INVALID_PARAMS', 'Signature image not found — draw a signature first')

  const doc = await PDFDocument.load(buf)
  const pageCount = doc.getPageCount()
  if (p.pageNumber < 1 || p.pageNumber > pageCount) {
    throw new TaskError('INVALID_PARAMS', `Page ${p.pageNumber} is outside this document (1-${pageCount})`)
  }
  const page = doc.getPages()[p.pageNumber - 1]
  const img = await doc.embedPng(imgBuf)
  const height = p.width * (img.height / img.width)
  // UI y is top-left; pdf-lib draws from bottom-left
  page.drawImage(img, { x: p.x, y: page.getHeight() - p.y - height, width: p.width, height })
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-signed.pdf`, PDF_MIME)] }
}

const pdfEditor: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['pdf-editor']
  const { file, buf } = await firstInput(ctx)
  const doc = await PDFDocument.load(buf)
  const pages = doc.getPages()
  const helv = await doc.embedFont(StandardFonts.Helvetica)

  const images = new Map<string, PDFImage>()
  for (const op of p.ops) {
    if (op.kind !== 'image' || images.has(op.imageDataId)) continue
    const imgBuf = await ctx.readBuf(op.imageDataId)
    if (!imgBuf) throw new TaskError('INVALID_PARAMS', `Editor image ${op.imageDataId} not found`)
    images.set(op.imageDataId, await doc.embedPng(imgBuf))
  }

  for (const op of p.ops) {
    if (op.page < 1 || op.page > pages.length) {
      throw new TaskError('INVALID_PARAMS', `Page ${op.page} is outside this document (1-${pages.length})`)
    }
    const page = pages[op.page - 1]
    const H = page.getHeight()
    if (op.kind === 'text') {
      const c = hexToRgb(op.color)
      page.drawText(winAnsi(op.text), { x: op.x, y: H - op.y - op.fontSize, size: op.fontSize, font: helv, color: rgb(c.r, c.g, c.b) })
    } else if (op.kind === 'rect') {
      const c = hexToRgb(op.color)
      page.drawRectangle({ x: op.x, y: H - op.y - op.height, width: op.width, height: op.height, color: rgb(c.r, c.g, c.b) })
    } else {
      const img = images.get(op.imageDataId)
      if (!img) continue
      const height = op.width * (img.height / img.width)
      page.drawImage(img, { x: op.x, y: H - op.y - height, width: op.width, height })
    }
  }
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-edited.pdf`, PDF_MIME)] }
}

const pdfForms: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['pdf-forms']
  const { file, buf } = await firstInput(ctx)
  const doc = await PDFDocument.load(buf)
  const pages = doc.getPages()
  const form = doc.getForm() // pdf-lib writes /AcroForm on save once fields exist
  const helv = await doc.embedFont(StandardFonts.Helvetica)

  for (const op of p.ops) {
    if (op.page < 1 || op.page > pages.length) {
      throw new TaskError('INVALID_PARAMS', `Page ${op.page} is outside this document (1-${pages.length})`)
    }
    const page = pages[op.page - 1]
    const field = form.createTextField(op.name)
    field.addToPage(page, { x: op.x, y: page.getHeight() - op.y - 24, width: op.width, height: 24, font: helv })
  }
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-form.pdf`, PDF_MIME)] }
}

const watermark: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['watermark']
  const { file, buf } = await firstInput(ctx)
  const doc = await PDFDocument.load(buf)

  let img: PDFImage | null = null
  if (typeof p.imageDataId === 'string') {
    const imgBuf = await ctx.readBuf(p.imageDataId)
    if (!imgBuf) throw new TaskError('INVALID_PARAMS', 'Watermark image not found — upload it first')
    img = await doc.embedPng(imgBuf)
  }
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const c = hexToRgb(p.color)
  const opacity = Math.min(1, Math.max(0, p.opacity))

  for (const page of doc.getPages()) {
    const W = page.getWidth()
    const H = page.getHeight()
    if (img) {
      const w = W * Math.min(0.95, Math.max(0.05, p.scale))
      const h = w * (img.height / img.width)
      if (p.position === 'tile') {
        for (let y = 0; y < H; y += h * 2) for (let x = 0; x < W; x += w * 1.6) page.drawImage(img, { x, y, width: w, height: h, opacity })
      } else {
        const y = p.position === 'top' ? H - h - 40 : p.position === 'bottom' ? 40 : (H - h) / 2
        page.drawImage(img, { x: (W - w) / 2, y, width: w, height: h, opacity })
      }
    } else {
      const text = winAnsi(p.text)
      const draw = (x: number, y: number) =>
        page.drawText(text, { x, y, size: p.fontSize, font, color: rgb(c.r, c.g, c.b), opacity, rotate: degrees(p.rotation) })
      if (p.position === 'tile') {
        const tw = font.widthOfTextAtSize(text, p.fontSize)
        for (let y = 0; y < H; y += p.fontSize * 4) for (let x = 0; x < W; x += tw * 1.6) draw(x, y)
      } else {
        draw((W - font.widthOfTextAtSize(text, p.fontSize)) / 2, p.position === 'top' ? H - 40 : p.position === 'bottom' ? 40 : (H - p.fontSize) / 2)
      }
    }
  }
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-watermarked.pdf`, PDF_MIME)] }
}

const pageNumbers: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['page-numbers']
  const { file, buf } = await firstInput(ctx)
  const doc = await PDFDocument.load(buf)
  const pages = doc.getPages()
  const font = await pickFont(doc, p.font)
  const c = hexToRgb('#000000')
  const selected = parsePageSelection(p.pages || 'all', pages.length)
  const pos = parsePosition(p.position)

  selected.forEach((idx, i) => {
    const label = winAnsi(p.pattern.replace(/\{n\}/g, String(p.startAt + i)).replace(/\{total\}/g, String(pages.length)))
    stampAt(pages[idx], label, font, p.fontSize, c, pos, p.margin)
  })
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-numbered.pdf`, PDF_MIME)] }
}

const headerFooter: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['header-footer']
  const { file, buf } = await firstInput(ctx)
  const doc = await PDFDocument.load(buf)
  const pages = doc.getPages()
  const font = await pickFont(doc, p.font)
  const c = hexToRgb(p.color)
  const selected = parsePageSelection(p.pages || 'all', pages.length)
  const date = new Date().toLocaleDateString('en-US')

  selected.forEach((idx, i) => {
    const text = winAnsi(
      p.pattern
        .replace(/\{n\}/g, String(p.startAt + i))
        .replace(/\{total\}/g, String(pages.length))
        .replace(/\{date\}/g, date),
    )
    for (const raw of p.positions) stampAt(pages[idx], text, font, p.fontSize, c, parsePosition(raw), p.margin)
  })
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-headerfooter.pdf`, PDF_MIME)] }
}

const batesNumbering: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['bates-numbering']
  const merged = await PDFDocument.create()
  const font = await merged.embedFont(FONTS[p.font] ?? StandardFonts.Helvetica)
  const c = hexToRgb(p.color)
  const pos = parsePosition(p.pageLocation)

  let counter = p.startFrom
  for (let f = 0; f < ctx.files.length; f++) {
    const meta = ctx.files[f]
    const buf = await ctx.readBuf(meta.id)
    if (!buf) throw new TaskError('FAILED', `${meta.name}: input missing from store`)
    const src = await PDFDocument.load(buf)
    for (const pg of await merged.copyPages(src, src.getPageIndices())) {
      const padded = String(counter).padStart(Math.max(1, p.digits), '0')
      const label =
        p.style === 'full-bates' ? padded
        : p.style === 'bates-with-exhibit' ? `EXHIBIT ${String.fromCharCode(65 + f)}-${padded}`
        : `${p.text ?? ''}${padded}`
      stampAt(merged.addPage(pg), winAnsi(label), font, p.fontSize, c, pos, p.margin)
      counter += Math.max(1, p.increment)
    }
    ctx.progress(((f + 1) / ctx.files.length) * 85)
  }
  return { outputs: [await ctx.putOutput(Buffer.from(await merged.save()), 'bates.pdf', PDF_MIME)] }
}

// ---- other ----

const editMetadata: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['edit-metadata']
  const { file, buf } = await firstInput(ctx)

  if (p.removeAll) {
    // copying pages into a fresh doc drops the original /Info and XMP
    const src = await PDFDocument.load(buf)
    const fresh = await PDFDocument.create()
    for (const pg of await fresh.copyPages(src, src.getPageIndices())) fresh.addPage(pg)
    const info = fresh.context.trailerInfo.Info
    if (info instanceof PDFDict) for (const [key] of info.entries()) info.delete(key)
    return { outputs: [await ctx.putOutput(Buffer.from(await fresh.save()), `${baseName(file.name)}-metadata.pdf`, PDF_MIME)] }
  }

  const doc = await PDFDocument.load(buf)
  if (p.title) doc.setTitle(p.title)
  if (p.author) doc.setAuthor(p.author)
  if (p.subject) doc.setSubject(p.subject)
  if (p.keywords) doc.setKeywords(p.keywords.split(',').map((k) => k.trim()).filter(Boolean))
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-metadata.pdf`, PDF_MIME)] }
}

// Build a viewer-visible /Outlines tree with plain pdf-lib objects
// (/First//Last ends, /Prev//Next sibling chain, /Count = open descendants).
const editBookmarks: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['edit-bookmarks']
  const { file, buf } = await firstInput(ctx)
  const doc = await PDFDocument.load(buf)
  const context = doc.context
  const pages = doc.getPages()

  const rootDict = context.obj({ Type: 'Outlines' })
  const rootRef = context.register(rootDict)
  const lastDictAt: (PDFDict | null)[] = []
  const lastRefAt: (PDFRef | null)[] = []
  const childCounts: number[] = []
  let totalCount = 0

  for (const entry of p.entries) {
    if (entry.page < 1 || entry.page > pages.length) {
      throw new TaskError('INVALID_PARAMS', `Bookmark page ${entry.page} is outside this document (1-${pages.length})`)
    }
    const level = Math.max(0, Math.round(entry.level))
    const parentDict = level === 0 ? rootDict : lastDictAt[level - 1]
    const parentRef = level === 0 ? rootRef : lastRefAt[level - 1]
    if (!parentDict || !parentRef) {
      throw new TaskError('INVALID_PARAMS', `Bookmark "${entry.title}" skips a level (no level-${level - 1} parent)`)
    }

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

    // every ancestor on the current stack gains one open descendant
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
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-bookmarks.pdf`, PDF_MIME)] }
}

const rename: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['rename']
  const outputs: StoredMeta[] = []
  for (let i = 0; i < ctx.files.length; i++) {
    const meta = ctx.files[i]
    const buf = await ctx.readBuf(meta.id)
    if (!buf) throw new TaskError('FAILED', `${meta.name}: input missing from store`)

    let name = baseName(meta.name)
    try {
      const doc = await PDFDocument.load(buf)
      const heights = doc.getPages().map((pg) => pg.getHeight())
      const { pages } = await extractTextPages(buf)
      let extracted = ''
      for (let pi = 0; pi < pages.length && !extracted; pi++) {
        const H = heights[pi] ?? 0
        const inBand = pages[pi]
          .filter((l) => {
            const rel = H > 0 ? (H - l.y) / H : 1 // baseline as % from the top
            return rel >= p.areaY / 100 && rel <= (p.areaY + p.areaHeight) / 100
          })
          .sort((a, b) => b.y - a.y)
        if (inBand[0]) extracted = inBand[0].text.trim()
      }
      const clean = extracted.replace(/[^A-Za-z0-9\-_ ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).trim()
      if (clean) {
        name = (p.renamePattern
          ? p.renamePattern.replace(/\{text\}/g, clean).replace(/\{original\}/g, baseName(meta.name))
          : clean
        ).trim() || baseName(meta.name)
      }
    } catch {
      // unreadable input keeps its original name
    }
    outputs.push(await ctx.putOutput(buf, `${name}.pdf`, PDF_MIME))
    ctx.progress(((i + 1) / ctx.files.length) * 90)
  }
  return { outputs }
}

const removeAnnotations: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['remove-annotations']
  const { file, buf } = await firstInput(ctx)
  const doc = await PDFDocument.load(buf)
  const remove = new Set(p.annotationTypes.map((t) => t.toLowerCase()))

  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of('Annots'), PDFArray)
    if (!annots) continue
    const kept = PDFArray.withContext(doc.context)
    for (let i = 0; i < annots.size(); i++) {
      const entry = annots.get(i)
      const dict = entry instanceof PDFRef ? doc.context.lookup(entry, PDFDict) : entry instanceof PDFDict ? entry : undefined
      const subtype = dict?.get(PDFName.of('Subtype'))
      const st = subtype instanceof PDFName ? subtype.asString().replace(/^\//, '').toLowerCase() : ''
      if (!remove.has(st)) kept.push(entry)
    }
    page.node.set(PDFName.of('Annots'), kept)
  }
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-clean.pdf`, PDF_MIME)] }
}

const flatten: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['flatten']
  const { file, buf } = await firstInput(ctx)
  const workdir = await ctx.workdir()

  if (p.mode === 'forms') {
    const doc = await PDFDocument.load(buf)
    try {
      doc.getForm().flatten()
    } catch {
      // no AcroForm → nothing to flatten, deliver the file as-is
    }
    ctx.progress(90)
    return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-flattened.pdf`, PDF_MIME)] }
  }

  const doc = await PDFDocument.load(buf)
  const sizes = doc.getPages().map((pg) => [pg.getWidth(), pg.getHeight()])
  const inPath = path.join(workdir, 'input.pdf')
  await writeFile(inPath, buf)
  const dpi = Math.min(200, Math.max(72, Math.round(p.resolution)))
  const images = await pdfToImages(inPath, workdir, { dpi, format: 'png' })

  const out = await PDFDocument.create()
  for (let i = 0; i < images.length; i++) {
    const [w, h] = sizes[i] ?? [612, 792]
    const img = await out.embedPng(await readFile(images[i]))
    out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h })
    ctx.progress(30 + ((i + 1) / images.length) * 55)
  }
  return { outputs: [await ctx.putOutput(Buffer.from(await out.save()), `${baseName(file.name)}-flattened.pdf`, PDF_MIME)] }
}

// ---- security ----

const protect: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['protect']
  const { file, buf } = await firstInput(ctx)
  const doc = await PDFDocument.load(buf)
  doc.encrypt({
    userPassword: p.userPassword,
    ownerPassword: p.ownerPassword || p.userPassword,
    permissions: {
      printing: p.allowPrinting ? 'highResolution' : false,
      copying: p.allowCopying,
      modifying: p.allowModifying,
      annotating: p.allowAnnotating,
      fillingForms: p.allowFillingForms,
      contentAccessibility: p.allowAccessibility,
      documentAssembly: p.allowAssembly,
    },
  })
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await doc.save()), `${baseName(file.name)}-protected.pdf`, PDF_MIME)] }
}

const unlock: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['unlock']
  const { file, buf } = await firstInput(ctx)
  let doc: PDFDocument
  try {
    // an empty user password still decrypts owner-locked documents
    doc = await PDFDocument.load(buf, { password: p.password ?? '' })
  } catch {
    throw new TaskError('WRONG_PASSWORD', 'Incorrect password')
  }
  // CRITICAL: save() on a loaded doc KEEPS /Encrypt — copy pages into a fresh
  // document so the output is actually decrypted.
  const fresh = await PDFDocument.create()
  for (const pg of await fresh.copyPages(doc, doc.getPageIndices())) fresh.addPage(pg)
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(await fresh.save()), `${baseName(file.name)}-unlocked.pdf`, PDF_MIME)] }
}

const ocr: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['ocr']
  const { file, buf } = await firstInput(ctx)
  const workdir = await ctx.workdir()
  const inPath = path.join(workdir, 'input.pdf')
  await writeFile(inPath, buf)
  const pngs = await pdfToImages(inPath, workdir, { dpi: 300, format: 'png' })

  const merged = await PDFDocument.create()
  const textParts: string[] = []
  for (let i = 0; i < pngs.length; i++) {
    const base = path.join(workdir, `ocr-${i + 1}`)
    if (p.outputFormat !== 'text') {
      const pdfPath = await tesseractRun(pngs[i], base, 'pdf')
      const src = await PDFDocument.load(await readFile(pdfPath))
      for (const pg of await merged.copyPages(src, src.getPageIndices())) merged.addPage(pg)
    }
    if (p.outputFormat !== 'pdf') {
      const txtPath = await tesseractRun(pngs[i], base, 'txt')
      textParts.push((await readFile(txtPath, 'utf8')).trim())
    }
    ctx.progress(20 + ((i + 1) / pngs.length) * 70)
  }

  const stem = baseName(file.name)
  const outputs: StoredMeta[] = []
  if (p.outputFormat !== 'text') outputs.push(await ctx.putOutput(Buffer.from(await merged.save()), `${stem}-ocr.pdf`, PDF_MIME))
  if (p.outputFormat !== 'pdf') outputs.push(await ctx.putOutput(Buffer.from(textParts.join('\n\n'), 'utf8'), `${stem}-ocr.txt`, 'text/plain'))
  return { outputs }
}

// ---- automate ----

const workflows: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['workflows']
  if (p.steps.length === 0) throw new TaskError('INVALID_PARAMS', 'Workflow needs at least one step')

  const stepWeight = 100 / p.steps.length
  let done = 0
  let current = ctx.files

  for (let i = 0; i < p.steps.length; i++) {
    const step = p.steps[i]
    const stepType: string = step.type
    if (stepType === 'workflows') throw new TaskError('INVALID_PARAMS', 'Workflows cannot be nested inside workflows')
    validateParams(stepType, step.params)
    const handler = [coreHandlers, convertHandlers, editsecHandlers].map((m) => m[stepType]).find(Boolean)
    if (!handler) throw new TaskError('INVALID_PARAMS', `Unknown workflow step: ${stepType}`)

    // spread keeps readBuf/putOutput/workdir — outputs registered here feed
    // the next step directly as input files
    const sub: TaskContext = {
      ...ctx,
      files: current,
      params: step.params,
      progress: (n: number) => ctx.progress(done + (n / 100) * stepWeight),
    }
    const result = await handler(sub)
    done += stepWeight
    current = result.outputs

    const last = i === p.steps.length - 1
    if (!last && (current.length === 0 || !current.every((o) => o.mime === 'application/pdf'))) {
      throw new TaskError('INVALID_PARAMS', `Step ${i + 1} output cannot feed the next step`)
    }
  }
  return { outputs: current }
}

export const editsecHandlers: Record<string, TaskHandler> = {
  sign,
  'pdf-editor': pdfEditor,
  'pdf-forms': pdfForms,
  watermark,
  'page-numbers': pageNumbers,
  'header-footer': headerFooter,
  'bates-numbering': batesNumbering,
  'edit-metadata': editMetadata,
  'edit-bookmarks': editBookmarks,
  rename,
  'remove-annotations': removeAnnotations,
  flatten,
  protect,
  unlock,
  ocr,
  workflows,
}
