// Organize/compress handler family: merge, the split-* group, page selection
// tools, and the geometry/quality rewriters (rotate, crop, resize, flip, n-up,
// deskew, compress, grayscale, repair).

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { PDFDocument, degrees, type PDFEmbeddedPage, type PDFPage } from '@cantoo/pdf-lib'
import { TaskError } from './errors'
import { parsePageSelection } from './parse'
import { baseName, withExt } from './mime'
import type { ToolParams } from './registry'
import type { StoredMeta } from './store'
import type { TaskContext, TaskHandler } from './types'
import { gsImageToPdf, gsPdfWrite, pdfToImages, qpdfRepair } from './bin'
import { decodePng, encodePng } from './writers'
import { extractOutline, extractTextPages } from './pdfjs-server'

const PDF_MIME = 'application/pdf'

type Bbox = { left: number; bottom: number; right: number; top: number }

async function readInput(ctx: TaskContext, fileId: string): Promise<Buffer> {
  const buf = await ctx.readBuf(fileId)
  if (!buf) throw new TaskError('NOT_FOUND', 'Input file not found or expired')
  return buf
}

async function loadPdf(ctx: TaskContext, fileId: string): Promise<{ buf: Buffer; doc: PDFDocument }> {
  const buf = await readInput(ctx, fileId)
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(buf, { ignoreEncryption: true })
  } catch (err) {
    throw new TaskError('FAILED', `Cannot parse PDF: ${(err as Error).message}`)
  }
  if (doc.isEncrypted) throw new TaskError('ENCRYPTED', 'File is password-protected. Unlock it first.')
  return { buf, doc }
}

function parsePages(sel: string, pageCount: number): number[] {
  try {
    return parsePageSelection(sel, pageCount)
  } catch (err) {
    throw new TaskError('INVALID_PARAMS', (err as Error).message)
  }
}

function seq(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i)
}

// StandardFonts encode WinAnsi (≈Latin-1); anything outside would crash save().
export function sanitizeWinAnsi(s: string): string {
  return s.replace(/[^\n\r\t\x20-\x7E\xA0-\xFF]/g, '?')
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'
}

function fullBbox(page: PDFPage): Bbox {
  const mb = page.getMediaBox()
  return { left: mb.x, bottom: mb.y, right: mb.x + mb.width, top: mb.y + mb.height }
}

async function saveOne(ctx: TaskContext, doc: PDFDocument, name: string): Promise<StoredMeta> {
  return ctx.putOutput(Buffer.from(await doc.save()), withExt(name, 'pdf'), PDF_MIME)
}

async function copyInto(out: PDFDocument, src: PDFDocument, indices: number[]): Promise<void> {
  const pages = await out.copyPages(src, indices)
  pages.forEach((p) => out.addPage(p))
}

function firstFile(ctx: TaskContext) {
  const f = ctx.files[0]
  if (!f) throw new TaskError('TOO_FEW_FILES', 'This tool needs a PDF file')
  return f
}

export const coreHandlers: Record<string, TaskHandler> = {
  // ---------------------------------------------------------- merge
  merge: async (ctx) => {
    const { normalizePageSizes, blankPageIfOdd } = ctx.params as ToolParams['merge']
    const out = await PDFDocument.create()
    let targetW = 0
    let targetH = 0
    for (let i = 0; i < ctx.files.length; i++) {
      const { doc } = await loadPdf(ctx, ctx.files[i].id)
      const indices = doc.getPageIndices()
      if (indices.length === 0) continue
      const first = doc.getPage(indices[0])
      const fileW = first.getWidth()
      const fileH = first.getHeight()
      if (i === 0 && normalizePageSizes) {
        targetW = fileW
        targetH = fileH
      }
      const normalize = normalizePageSizes && targetW > 0
      for (const idx of indices) {
        if (!normalize) {
          await copyInto(out, doc, [idx])
          continue
        }
        const pg = doc.getPage(idx)
        const mb = pg.getMediaBox()
        if (Math.abs(mb.width - targetW) < 0.01 && Math.abs(mb.height - targetH) < 0.01) {
          await copyInto(out, doc, [idx])
          continue
        }
        const emb = await out.embedPage(pg, fullBbox(pg))
        const page = out.addPage([targetW, targetH])
        page.drawPage(emb, { x: 0, y: 0, xScale: targetW / emb.width, yScale: targetH / emb.height })
      }
      if (blankPageIfOdd && indices.length % 2 === 1) {
        out.addPage([normalize ? targetW : fileW, normalize ? targetH : fileH])
      }
      ctx.progress(Math.round(((i + 1) / ctx.files.length) * 100))
    }
    return { outputs: [await saveOne(ctx, out, 'merged')] }
  },

  // ---------------------------------------------------------- split
  split: async (ctx) => {
    const { mode, ranges, step } = ctx.params as ToolParams['split']
    const { doc } = await loadPdf(ctx, firstFile(ctx).id)
    const pageCount = doc.getPageCount()
    const groups: number[][] = []
    if (mode === 'ranges') {
      for (const part of ranges.split(',')) {
        if (!part.trim()) continue
        groups.push(parsePages(part, pageCount))
      }
    } else {
      const n = Math.max(1, Math.floor(step))
      for (let start = 0; start < pageCount; start += n) {
        groups.push(seq(start, Math.min(start + n, pageCount)))
      }
    }
    const usable = groups.filter((g) => g.length > 0)
    if (usable.length === 0) throw new TaskError('INVALID_PARAMS', 'No pages selected by the given ranges')
    const base = baseName(firstFile(ctx).name)
    const outputs: StoredMeta[] = []
    for (let i = 0; i < usable.length; i++) {
      const part = await PDFDocument.create()
      await copyInto(part, doc, usable[i])
      outputs.push(await saveOne(ctx, part, `${base}-${i + 1}`))
      ctx.progress(Math.round(((i + 1) / usable.length) * 100))
    }
    return { outputs }
  },

  'split-bookmarks': async (ctx) => {
    const { level, expression, includePageAfter } = ctx.params as ToolParams['split-bookmarks']
    const file = firstFile(ctx)
    const { buf, doc } = await loadPdf(ctx, file.id)
    const pageCount = doc.getPageCount()
    const outline = await extractOutline(buf)
    if (!outline) throw new TaskError('INVALID_PARAMS', 'Document has no bookmarks')
    const expr = expression.trim().toLowerCase()
    const marks = outline
      .filter((o) => o.level === level && o.page >= 1)
      .filter((o) => !expr || o.title.toLowerCase().includes(expr))
      .sort((a, b) => a.page - b.page)
    if (marks.length === 0) throw new TaskError('INVALID_PARAMS', 'No bookmarks match the given level/expression')
    const base = baseName(file.name)
    const outputs: StoredMeta[] = []
    const usedNames = new Map<string, number>()
    for (let i = 0; i < marks.length; i++) {
      const start = marks[i].page
      let end = i + 1 < marks.length ? marks[i + 1].page - 1 : pageCount
      if (includePageAfter) end += 1
      end = Math.min(end, pageCount)
      if (end < start) continue
      const part = await PDFDocument.create()
      await copyInto(part, doc, seq(start - 1, end))
      const slug = slugify(marks[i].title)
      const seen = usedNames.get(slug) ?? 0
      usedNames.set(slug, seen + 1)
      outputs.push(await saveOne(ctx, part, `${base}-${slug}${seen > 0 ? `-${seen + 1}` : ''}`))
      ctx.progress(Math.round(((i + 1) / marks.length) * 100))
    }
    if (outputs.length === 0) throw new TaskError('INVALID_PARAMS', 'Bookmarks produced no non-empty chapters')
    return { outputs }
  },

  'split-middle': async (ctx) => {
    const { ratio, mode, rightToLeft } = ctx.params as ToolParams['split-middle']
    // UI may send 0..100; normalize to 0..1 and keep away from degenerate bboxes
    const r = Math.min(0.95, Math.max(0.05, ratio > 1 ? ratio / 100 : ratio))
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const out = await PDFDocument.create()
    const pageCount = doc.getPageCount()
    for (let i = 0; i < pageCount; i++) {
      const pg = doc.getPage(i)
      const w = pg.getWidth()
      const h = pg.getHeight()
      const halves: { bbox: Bbox; w: number; h: number }[] = []
      if (mode === 'vertical') {
        const parts: Bbox[] = [
          { left: 0, bottom: 0, right: w * r, top: h },
          { left: w * r, bottom: 0, right: w, top: h },
        ]
        if (rightToLeft) parts.reverse()
        for (const bbox of parts) halves.push({ bbox, w: bbox.right - bbox.left, h })
      } else {
        halves.push({ bbox: { left: 0, bottom: h * r, right: w, top: h }, w, h: h * (1 - r) })
        halves.push({ bbox: { left: 0, bottom: 0, right: w, top: h * r }, w, h: h * r })
      }
      for (const half of halves) {
        const emb = await out.embedPage(pg, half.bbox)
        const page = out.addPage([half.w, half.h])
        page.drawPage(emb, { x: 0, y: 0 })
      }
      ctx.progress(Math.round(((i + 1) / pageCount) * 95))
    }
    return { outputs: [await saveOne(ctx, out, `${baseName(file.name)}-split`)] }
  },

  'split-size': async (ctx) => {
    const { size, sizeUnit } = ctx.params as ToolParams['split-size']
    const limit = size * (sizeUnit === 'MB' ? 1048576 : 1024)
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const base = baseName(file.name)
    const pageCount = doc.getPageCount()
    const chunks: Buffer[] = []
    let current = await PDFDocument.create()
    let count = 0
    for (let i = 0; i < pageCount; i++) {
      const [p] = await current.copyPages(doc, [i])
      current.addPage(p)
      count++
      const serialized = Buffer.from(await current.save())
      if (serialized.byteLength <= limit) {
        ctx.progress(Math.round(((i + 1) / pageCount) * 95))
        continue
      }
      if (count > 1) {
        current.removePage(count - 1)
        chunks.push(Buffer.from(await current.save()))
        current = await PDFDocument.create()
        const [overflow] = await current.copyPages(doc, [i])
        current.addPage(overflow)
        count = 1
      } else {
        chunks.push(serialized)
        current = await PDFDocument.create()
        count = 0
      }
      ctx.progress(Math.round(((i + 1) / pageCount) * 95))
    }
    if (count > 0) chunks.push(Buffer.from(await current.save()))
    const outputs: StoredMeta[] = []
    for (let i = 0; i < chunks.length; i++) {
      outputs.push(await ctx.putOutput(chunks[i], withExt(`${base}-${i + 1}`, 'pdf'), PDF_MIME))
    }
    return { outputs }
  },

  'split-text': async (ctx) => {
    const { areaY, areaHeight, startsWith } = ctx.params as ToolParams['split-text']
    const marker = startsWith.trim()
    if (!marker) throw new TaskError('INVALID_PARAMS', 'Marker text is required')
    const file = firstFile(ctx)
    const { buf, doc } = await loadPdf(ctx, file.id)
    const { pages } = await extractTextPages(buf)
    const pageCount = doc.getPageCount()
    // Per-page marker text found in the scan band (null when absent).
    const band: (string | null)[] = []
    for (let n = 0; n < pageCount; n++) {
      const h = doc.getPage(n).getHeight()
      const top = (areaY / 100) * h
      const bottom = ((areaY + areaHeight) / 100) * h
      let found: string | null = null
      for (const line of pages[n] ?? []) {
        const fromTop = h - line.y // pdf.js baseline y is measured from the bottom
        if (fromTop >= top && fromTop <= bottom && line.text.trimStart().startsWith(marker)) {
          found = line.text.trim()
          break
        }
      }
      band.push(found)
    }
    if (!band.some(Boolean)) throw new TaskError('INVALID_PARAMS', 'Marker text not found')
    // Split when the marker text CHANGES from page to page: pages sharing the
    // same band text (and continuation pages without a marker) stay together.
    const starts = [1]
    let running: string | null = band[0] ?? null
    for (let n = 2; n <= pageCount; n++) {
      const k = band[n - 1]
      if (k && k !== running) starts.push(n)
      if (k) running = k
    }
    const base = baseName(file.name)
    const outputs: StoredMeta[] = []
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i]
      const end = i + 1 < starts.length ? starts[i + 1] - 1 : pageCount
      if (end < start) continue
      const part = await PDFDocument.create()
      await copyInto(part, doc, seq(start - 1, end))
      outputs.push(await saveOne(ctx, part, `${base}-${outputs.length + 1}`))
    }
    return { outputs }
  },

  // ---------------------------------------------------------- page selection
  'extract-pages': async (ctx) => {
    const { pages } = ctx.params as ToolParams['extract-pages']
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const sel = parsePages(pages, doc.getPageCount())
    if (sel.length === 0) throw new TaskError('INVALID_PARAMS', 'No pages selected')
    const out = await PDFDocument.create()
    await copyInto(out, doc, sel)
    return { outputs: [await saveOne(ctx, out, `${baseName(file.name)}-extract`)] }
  },

  'delete-pages': async (ctx) => {
    const { pages } = ctx.params as ToolParams['delete-pages']
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const pageCount = doc.getPageCount()
    const drop = new Set(parsePages(pages, pageCount))
    const keep = seq(0, pageCount).filter((i) => !drop.has(i))
    if (keep.length === 0) throw new TaskError('INVALID_PARAMS', 'Cannot delete every page')
    const out = await PDFDocument.create()
    await copyInto(out, doc, keep)
    return { outputs: [await saveOne(ctx, out, `${baseName(file.name)}-deleted`)] }
  },

  'alternate-mix': async (ctx) => {
    const { step, reverse, repeat } = ctx.params as ToolParams['alternate-mix']
    const docs: PDFDocument[] = []
    for (const f of ctx.files) docs.push((await loadPdf(ctx, f.id)).doc)
    const take = Math.max(1, Math.floor(step))
    const order = reverse ? [...docs.keys()].reverse() : [...docs.keys()]
    const pos = docs.map(() => 0)
    const out = await PDFDocument.create()
    let live = docs.length
    let stop = false
    const total = docs.reduce((n, d) => n + d.getPageCount(), 0)
    let copied = 0
    while (live > 0 && !stop) {
      let exhaustedThisRound = false
      for (const di of order) {
        if (pos[di] >= docs[di].getPageCount()) continue
        const end = Math.min(pos[di] + take, docs[di].getPageCount())
        await copyInto(out, docs[di], seq(pos[di], end))
        copied += end - pos[di]
        pos[di] = end
        if (pos[di] >= docs[di].getPageCount()) {
          live--
          exhaustedThisRound = true
        }
      }
      // "stop at first exhaustion" finishes the round so equal-length docs
      // (the scan-merge case) never lose their last page
      if (!repeat && exhaustedThisRound) stop = true
      ctx.progress(Math.round((copied / Math.max(1, total)) * 100))
    }
    return { outputs: [await saveOne(ctx, out, 'mixed')] }
  },

  organize: async (ctx) => {
    const { order } = ctx.params as ToolParams['organize']
    if (order.length === 0) throw new TaskError('INVALID_PARAMS', 'Empty page order')
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const pageCount = doc.getPageCount()
    if (order.some((i) => i < 0 || i >= pageCount)) {
      throw new TaskError('INVALID_PARAMS', `Page index out of range (0-${pageCount - 1})`)
    }
    const out = await PDFDocument.create()
    // one copy per occurrence so repeated indices stay independent pages
    for (const idx of order) {
      await copyInto(out, doc, [idx])
    }
    return { outputs: [await saveOne(ctx, out, 'organized')] }
  },

  rotate: async (ctx) => {
    const { angle, pages } = ctx.params as ToolParams['rotate']
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const pageCount = doc.getPageCount()
    const sel = new Set(pages ? parsePages(pages, pageCount) : seq(0, pageCount))
    for (const idx of sel) {
      const pg = doc.getPage(idx)
      pg.setRotation(degrees((((pg.getRotation().angle + angle) % 360) + 360) % 360))
    }
    return { outputs: [await saveOne(ctx, doc, `${baseName(file.name)}-rotated`)] }
  },

  // ---------------------------------------------------------- quality
  compress: async (ctx) => {
    const { quality } = ctx.params as ToolParams['compress']
    const file = firstFile(ctx)
    const name = `${baseName(file.name)}-compressed`
    if (quality === 'lossless') {
      const { doc } = await loadPdf(ctx, file.id)
      return { outputs: [await saveOne(ctx, doc, name)] }
    }
    const settings = (
      { extremely: 'screen', recommended: 'ebook', good: 'printer', great: 'prepress' } as const
    )[quality as 'extremely' | 'recommended' | 'good' | 'great']
    const buf = await readInput(ctx, file.id)
    const dir = await ctx.workdir()
    const inPath = join(dir, 'in.pdf')
    await writeFile(inPath, buf)
    const outPath = await gsPdfWrite([inPath], join(dir, 'out.pdf'), { settings })
    const gsBytes = await readFile(outPath)
    const final = gsBytes.byteLength < buf.byteLength ? gsBytes : buf
    return { outputs: [await ctx.putOutput(final, withExt(name, 'pdf'), PDF_MIME)] }
  },

  grayscale: async (ctx) => {
    const file = firstFile(ctx)
    const dir = await ctx.workdir()
    const inPath = join(dir, 'in.pdf')
    await writeFile(inPath, await readInput(ctx, file.id))
    const outPath = await gsPdfWrite([inPath], join(dir, 'out.pdf'), { gray: true })
    return {
      outputs: [await ctx.adoptOutput(outPath, withExt(`${baseName(file.name)}-grayscale`, 'pdf'), PDF_MIME)],
    }
  },

  crop: async (ctx) => {
    const { margin } = ctx.params as ToolParams['crop']
    const file = firstFile(ctx)
    const { buf, doc } = await loadPdf(ctx, file.id)
    const dir = await ctx.workdir()
    const inPath = join(dir, 'in.pdf')
    await writeFile(inPath, buf)
    const pngs = await pdfToImages(inPath, dir, { dpi: 72, format: 'png' })
    const pageCount = Math.min(doc.getPageCount(), pngs.length)
    for (let i = 0; i < pageCount; i++) {
      const img = decodePng(await readFile(pngs[i]))
      const pg = doc.getPage(i)
      const mb = pg.getMediaBox()
      const rot = ((pg.getRotation().angle % 360) + 360) % 360
      const box = inkBbox(img.rgba, img.width, img.height)
      let box2: { x0: number; y0: number; x1: number; y1: number }
      if (!box) {
        box2 = { x0: mb.x, y0: mb.y, x1: mb.x + mb.width, y1: mb.y + mb.height }
      } else {
        // rendered px == pt at 72dpi; map image bbox (y down) back to user space
        const corners = [
          imagePointToPdf(box.x0, box.y0, img.width, img.height, mb, rot),
          imagePointToPdf(box.x1, box.y1, img.width, img.height, mb, rot),
        ]
        box2 = {
          x0: Math.min(...corners.map((c) => c.x)),
          y0: Math.min(...corners.map((c) => c.y)),
          x1: Math.max(...corners.map((c) => c.x)),
          y1: Math.max(...corners.map((c) => c.y)),
        }
      }
      const x0 = Math.max(mb.x, box2.x0 + margin)
      const y0 = Math.max(mb.y, box2.y0 + margin)
      const x1 = Math.min(mb.x + mb.width, box2.x1 - margin)
      const y1 = Math.min(mb.y + mb.height, box2.y1 - margin)
      if (x1 - x0 >= 1 && y1 - y0 >= 1) pg.setCropBox(x0, y0, x1 - x0, y1 - y0)
      ctx.progress(Math.round(((i + 1) / pageCount) * 95))
    }
    return { outputs: [await saveOne(ctx, doc, `${baseName(file.name)}-crop`)] }
  },

  resize: async (ctx) => {
    const { pageSize, customWidth, customHeight, margin, unit } = ctx.params as ToolParams['resize']
    const factor = unit === 'mm' ? 2.8346 : unit === 'in' ? 72 : 1
    const sizes: Record<string, [number, number]> = { a4: [595, 842], a3: [842, 1191], letter: [612, 792] }
    const [tw, th] =
      pageSize === 'custom'
        ? [customWidth * factor, customHeight * factor]
        : sizes[pageSize] ?? sizes.a4
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const out = await PDFDocument.create()
    const pageCount = doc.getPageCount()
    const fitW = Math.max(1, tw - 2 * margin)
    const fitH = Math.max(1, th - 2 * margin)
    for (let i = 0; i < pageCount; i++) {
      const pg = doc.getPage(i)
      const emb = await out.embedPage(pg, fullBbox(pg))
      const scale = Math.min(fitW / emb.width, fitH / emb.height)
      const page = out.addPage([tw, th])
      page.drawPage(emb, {
        x: (tw - emb.width * scale) / 2,
        y: (th - emb.height * scale) / 2,
        xScale: scale,
        yScale: scale,
      })
      ctx.progress(Math.round(((i + 1) / pageCount) * 95))
    }
    return { outputs: [await saveOne(ctx, out, `${baseName(file.name)}-resized`)] }
  },

  flip: async (ctx) => {
    const { mode } = ctx.params as ToolParams['flip']
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const out = await PDFDocument.create()
    const pageCount = doc.getPageCount()
    for (let i = 0; i < pageCount; i++) {
      const pg = doc.getPage(i)
      const mb = pg.getMediaBox()
      const emb = await out.embedPage(pg, fullBbox(pg))
      const page = out.addPage([mb.width, mb.height])
      page.drawPage(
        emb,
        mode === 'horizontal'
          ? { x: mb.x + mb.width, y: mb.y, xScale: -1, yScale: 1 }
          : { x: mb.x, y: mb.y + mb.height, xScale: 1, yScale: -1 },
      )
    }
    ctx.progress(100)
    return { outputs: [await saveOne(ctx, out, 'flipped')] }
  },

  'n-up': async (ctx) => {
    const { n, pageOrdering, preservePageSize } = ctx.params as ToolParams['n-up']
    const perSheet = Math.max(1, Math.min(9, Math.floor(n)))
    const file = firstFile(ctx)
    const { doc } = await loadPdf(ctx, file.id)
    const pageCount = doc.getPageCount()
    const cols = perSheet === 2 ? 2 : perSheet === 4 ? 2 : 3
    const rows = Math.max(1, Math.ceil(perSheet / cols))
    let sheetW: number
    let sheetH: number
    if (preservePageSize) {
      const first = doc.getPage(doc.getPageIndices()[0])
      sheetW = first.getWidth()
      sheetH = first.getHeight()
    } else if (perSheet < 4) {
      sheetW = 842 // A4 landscape
      sheetH = 595
    } else {
      sheetW = 1191 // A3 landscape
      sheetH = 842
    }
    const out = await PDFDocument.create()
    const embedded: PDFEmbeddedPage[] = []
    for (let i = 0; i < pageCount; i++) {
      const pg = doc.getPage(i)
      embedded.push(await out.embedPage(pg, fullBbox(pg)))
      ctx.progress(Math.round(((i + 1) / pageCount) * 80))
    }
    const gutter = 4
    const cellW = sheetW / cols
    const cellH = sheetH / rows
    for (let s = 0; s < embedded.length; s += perSheet) {
      const page = out.addPage([sheetW, sheetH])
      for (let k = 0; k < perSheet && s + k < embedded.length; k++) {
        const emb = embedded[s + k]
        const row = pageOrdering === 'horizontal' ? Math.floor(k / cols) : k % rows
        const col = pageOrdering === 'horizontal' ? k % cols : Math.floor(k / rows)
        const scale = Math.min((cellW - 2 * gutter) / emb.width, (cellH - 2 * gutter) / emb.height)
        const dw = emb.width * scale
        const dh = emb.height * scale
        page.drawPage(emb, {
          x: col * cellW + (cellW - dw) / 2,
          y: sheetH - (row + 1) * cellH + (cellH - dh) / 2,
          xScale: scale,
          yScale: scale,
        })
      }
    }
    return { outputs: [await saveOne(ctx, out, 'n-up')] }
  },

  deskew: async (ctx) => {
    const { onlyStronglySkewed } = ctx.params as ToolParams['deskew']
    const file = firstFile(ctx)
    const { buf, doc } = await loadPdf(ctx, file.id)
    const dir = await ctx.workdir()
    const inPath = join(dir, 'in.pdf')
    await writeFile(inPath, buf)
    const pngs = await pdfToImages(inPath, dir, { dpi: 150, format: 'png' })
    const pageCount = Math.min(doc.getPageCount(), pngs.length)
    const out = await PDFDocument.create()
    let deskewed = 0
    for (let i = 0; i < pageCount; i++) {
      const img = decodePng(await readFile(pngs[i]))
      const skew = estimateSkew(img)
      if (Math.abs(skew) < (onlyStronglySkewed ? 1 : 0.1)) {
        await copyInto(out, doc, [i]) // not skewed enough to touch — keep vector page
      } else {
        deskewed++
        const rotated = rotateBitmap(img, skew)
        const pngPath = join(dir, `deskew-${i + 1}.png`)
        await writeFile(pngPath, encodePng(rotated.rgba, rotated.width, rotated.height))
        const single = await gsImageToPdf(pngPath, join(dir, `deskew-${i + 1}.pdf`))
        const oneDoc = await PDFDocument.load(await readFile(single), { ignoreEncryption: true })
        const srcPage = oneDoc.getPage(oneDoc.getPageIndices()[0])
        const emb = await out.embedPage(srcPage, fullBbox(srcPage))
        const mb = doc.getPage(i).getMediaBox()
        const page = out.addPage([mb.width, mb.height])
        // gs sizes image pages 1px=1pt; the render was 150dpi → scale back
        page.drawPage(emb, { x: 0, y: 0, xScale: mb.width / emb.width, yScale: mb.height / emb.height })
      }
      ctx.progress(Math.round(((i + 1) / pageCount) * 95))
    }
    if (onlyStronglySkewed && deskewed === 0) {
      return { outputs: [await ctx.putOutput(buf, withExt(`${baseName(file.name)}-deskew`, 'pdf'), PDF_MIME)] }
    }
    return { outputs: [await saveOne(ctx, out, `${baseName(file.name)}-deskew`)] }
  },

  repair: async (ctx) => {
    const file = firstFile(ctx)
    const buf = await readInput(ctx, file.id)
    let doc: PDFDocument
    try {
      doc = await PDFDocument.load(buf, { ignoreEncryption: true })
    } catch {
      const dir = await ctx.workdir()
      const inPath = join(dir, 'in.pdf')
      await writeFile(inPath, buf)
      let rescued: Buffer
      try {
        rescued = await readFile(await qpdfRepair(inPath, join(dir, 'fixed.pdf')))
      } catch {
        throw new TaskError('FAILED', 'Could not repair document')
      }
      try {
        doc = await PDFDocument.load(rescued, { ignoreEncryption: true })
      } catch {
        throw new TaskError('FAILED', 'Could not repair document')
      }
    }
    const out = await PDFDocument.create()
    await copyInto(out, doc, doc.getPageIndices())
    return { outputs: [await saveOne(ctx, out, 'repaired')] }
  },
}

// Scan for non-white pixels (any channel < 250); coords in px, y down. 1px = 1pt at 72dpi.
function inkBbox(rgba: Uint8Array, w: number, h: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    const row = y * w * 4
    for (let x = 0; x < w; x++) {
      const i = row + x * 4
      if (rgba[i] < 250 || rgba[i + 1] < 250 || rgba[i + 2] < 250) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

// Inverse-map a rendered pixel (y down) to PDF user space, honoring /Rotate.
function imagePointToPdf(
  nx: number,
  ny: number,
  rw: number,
  rh: number,
  mb: { x: number; y: number; width: number; height: number },
  rot: number,
): { x: number; y: number } {
  switch (rot) {
    case 90:
      return { x: mb.x + ny, y: mb.y + nx }
    case 180:
      return { x: mb.x + rw - nx, y: mb.y + ny }
    case 270:
      return { x: mb.x + rh - ny, y: mb.y + rw - nx }
    default:
      return { x: mb.x + nx, y: mb.y + rh - ny }
  }
}

// Projection-profile skew estimate: the angle whose line histogram is most
// concentrated (max sum of squares) wins. Positive = text rises to the right.
function estimateSkew(img: { rgba: Uint8Array; width: number; height: number }): number {
  const { rgba, width: W, height: H } = img
  const xs: number[] = []
  const ys: number[] = []
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4
      const gray = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000
      if (gray < 128) {
        xs.push(x)
        ys.push(y)
      }
    }
  }
  if (xs.length < 100) return 0
  let best = 0
  let bestScore = -1
  for (let a = -10; a <= 10; a += 0.5) {
    const t = Math.tan((a * Math.PI) / 180)
    const off = Math.ceil(Math.abs(t) * (W / 2)) + 1
    const hist = new Int32Array(H + 2 * off)
    for (let k = 0; k < xs.length; k++) {
      hist[ys[k] + Math.round(t * (xs[k] - W / 2)) + off]++
    }
    let score = 0
    for (let k = 0; k < hist.length; k++) score += hist[k] * hist[k]
    if (score > bestScore) {
      bestScore = score
      best = a
    }
  }
  return best
}

// Nearest-neighbor inverse rotation sampled around the center; output stays W×H.
function rotateBitmap(
  img: { rgba: Uint8Array; width: number; height: number },
  skewDeg: number,
): { rgba: Uint8Array; width: number; height: number } {
  const { rgba: src, width: W, height: H } = img
  const out = new Uint8Array(W * H * 4).fill(255)
  const s = (skewDeg * Math.PI) / 180
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
      out[di] = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = 255
    }
  }
  return { rgba: out, width: W, height: H }
}
