// Conversion handlers: PDF → images/text/office and images/word/html → PDF.
// Heavy lifting goes through ./bin (gs/pdftoppm/soffice/chromium),
// ./pdfjs-server (text extraction) and ./writers (docx/xlsx/csv/pptx/png).

import { existsSync, readdirSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import type { PDFPage } from '@cantoo/pdf-lib'
import type { ToolParams } from './registry'
import { TaskError } from './errors'
import { baseName, mimeForExt, withExt } from './mime'
import { parsePageSelection } from './parse'
import type { StoredMeta } from './store'
import type { TaskContext, TaskHandler } from './types'
import { gsImageToPdf, pdfToImages, runBin, sofficeConvert } from './bin'
import { extractTextItems, extractTextPages } from './pdfjs-server'
import { encodePng, writeCsv, writeDocx, writePptx, writeXlsx } from './writers'

// One text line as produced by extractTextPages (y = baseline from page BOTTOM).
export type TextLine = { text: string; x: number; y: number; width: number; height: number; page: number }

// ---- shared helpers (reused by handlers-editsec) ----

// CP1252 slots beyond Latin-1 that WinAnsiEncoding can encode. The five
// unassigned holes and anything else outside the set crash pdf-lib's encoder.
const WINANSI_EXTRA = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178])
const WINANSI_HOLES = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d])

export function winAnsi(text: string): string {
  let out = ''
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 63
    out += (c <= 0xff && !WINANSI_HOLES.has(c)) || WINANSI_EXTRA.has(c) ? ch : '?'
  }
  return out
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = (hex ?? '').trim().match(/^#?([0-9a-f]{6})$/i)
  const n = m ? parseInt(m[1], 16) : 0
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

// Read the single input file every one-file tool relies on.
export async function firstInput(ctx: TaskContext): Promise<{ file: StoredMeta; buf: Buffer }> {
  const file = ctx.files[0]
  if (!file) throw new TaskError('TOO_FEW_FILES', 'This tool needs an input file')
  const buf = await ctx.readBuf(file.id)
  if (!buf) throw new TaskError('FAILED', `${file.name}: input missing from store`)
  return { file, buf }
}

const PDF_MIME = mimeForExt('pdf')
const PAGE_SIZES = { a4: { w: 595.28, h: 841.89 }, letter: { w: 612, h: 792 } }

// ---- convert-to-pdf ----

const jpgToPdf: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['jpg-to-pdf']
  const workdir = await ctx.workdir()
  const merged = p.mergeOutputs ? await PDFDocument.create() : null
  const outputs: StoredMeta[] = []

  for (let i = 0; i < ctx.files.length; i++) {
    const file = ctx.files[i]
    const buf = await ctx.readBuf(file.id)
    if (!buf) throw new TaskError('FAILED', `${file.name}: input missing from store`)
    const doc = merged ?? (await PDFDocument.create())

    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    let w: number, h: number
    let place: (page: PDFPage, x: number, y: number, dw: number, dh: number) => void
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      const img = ext === 'png' ? await doc.embedPng(buf) : await doc.embedJpg(buf)
      w = img.width
      h = img.height
      place = (page, x, y, dw, dh) => page.drawImage(img, { x, y, width: dw, height: dh })
    } else {
      // gif/bmp/tiff/webp: pdf-lib can't embed these — gs wraps the image
      // into a one-page PDF that we then embed 1:1.
      const inPath = path.join(workdir, `img-${i}.${ext || 'img'}`)
      await writeFile(inPath, buf)
      const pdfPath = await gsImageToPdf(inPath, path.join(workdir, `img-${i}.pdf`))
      const holder = await PDFDocument.load(await readFile(pdfPath))
      const embedded = await doc.embedPage(holder.getPages()[0])
      w = embedded.width
      h = embedded.height
      place = (page, x, y, dw, dh) => page.drawPage(embedded, { x, y, width: dw, height: dh })
    }

    const m = Math.max(0, p.margin)
    let pageW: number, pageH: number
    if (p.pageSize === 'fit') {
      pageW = w + 2 * m
      pageH = h + 2 * m
    } else {
      const base = PAGE_SIZES[p.pageSize]
      const landscape = p.orientation === 'landscape' || (p.orientation === 'auto' && w > h)
      pageW = landscape ? base.h : base.w
      pageH = landscape ? base.w : base.h
    }
    const page = doc.addPage([pageW, pageH])
    const scale = p.pageSize === 'fit' ? 1 : Math.min((pageW - 2 * m) / w, (pageH - 2 * m) / h)
    const dw = w * scale
    const dh = h * scale
    place(page, (pageW - dw) / 2, (pageH - dh) / 2, dw, dh)

    if (!merged) outputs.push(await ctx.putOutput(Buffer.from(await doc.save()), withExt(file.name, 'pdf'), PDF_MIME))
    ctx.progress(((i + 1) / ctx.files.length) * 90)
  }

  if (merged) outputs.push(await ctx.putOutput(Buffer.from(await merged.save()), 'images-merged.pdf', PDF_MIME))
  ctx.progress(100)
  return { outputs }
}

const pdfToJpg: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['pdf-to-jpg']
  const { file, buf } = await firstInput(ctx)
  const workdir = await ctx.workdir()
  const stem = baseName(file.name)

  const src = await PDFDocument.load(buf)
  const pageCount = src.getPageCount()
  const selected = p.pages && p.pages.trim() && p.pages !== 'all' ? parsePageSelection(p.pages, pageCount) : null

  let renderPath = path.join(workdir, 'full.pdf')
  await writeFile(renderPath, buf)
  if (selected && selected.length !== pageCount) {
    // Render only the selection but keep ORIGINAL page numbers in the names.
    const sub = await PDFDocument.create()
    for (const pg of await sub.copyPages(src, selected)) sub.addPage(pg)
    renderPath = path.join(workdir, 'subset.pdf')
    await writeFile(renderPath, await sub.save())
  }

  const fmt = p.imageFormat === 'jpg' ? 'jpeg' : p.imageFormat
  const images = await pdfToImages(renderPath, workdir, { dpi: p.resolution, format: fmt, gray: p.grayscale })
  ctx.progress(85)

  const outputs: StoredMeta[] = []
  for (let i = 0; i < images.length; i++) {
    const pageNo = selected ? selected[i] + 1 : i + 1
    outputs.push(await ctx.adoptOutput(images[i], `${stem}-${pageNo}.${p.imageFormat}`, mimeForExt(p.imageFormat)))
  }
  ctx.progress(100)
  return { outputs }
}

const pdfToText: TaskHandler = async (ctx) => {
  const { file, buf } = await firstInput(ctx)
  ctx.progress(20)
  const { pages } = await extractTextPages(buf)
  const text = pages.map((lines) => lines.map((l) => l.text).join('\n')).join('\n\n')
  ctx.progress(90)
  return { outputs: [await ctx.putOutput(Buffer.from(text, 'utf8'), withExt(file.name, 'txt'), mimeForExt('txt'))] }
}

const pdfToWord: TaskHandler = async (ctx) => {
  const { file, buf } = await firstInput(ctx)
  ctx.progress(20)
  const { pages } = await extractTextPages(buf)
  const blocks: { text: string; size: number }[] = []
  for (const lines of pages) {
    if (lines.length === 0) continue
    // y is the baseline from the page bottom → descending = reading order
    const sorted = [...lines].sort((a, b) => b.y - a.y || a.x - b.x)
    const heights = sorted.map((l) => l.height).filter((h) => h > 0).sort((a, b) => a - b)
    const median = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 12
    let block = sorted[0].text
    for (let i = 1; i < sorted.length; i++) {
      // vertical gap beyond 1.6× median line height starts a new paragraph;
      // a new page always starts a new block (loop body runs per page)
      if (sorted[i - 1].y - sorted[i].y > 1.6 * median) {
        blocks.push({ text: block, size: 11 })
        block = sorted[i].text
      } else {
        block += ` ${sorted[i].text}`
      }
    }
    blocks.push({ text: block, size: 11 })
  }
  ctx.progress(60)
  const docx = await writeDocx(blocks)
  return { outputs: [await ctx.putOutput(docx, withExt(file.name, 'docx'), mimeForExt('docx'))] }
}

const pdfToPpt: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['pdf-to-ppt']
  const { file, buf } = await firstInput(ctx)
  const workdir = await ctx.workdir()
  const inPath = path.join(workdir, 'input.pdf')
  await writeFile(inPath, buf)

  const dpi = Math.min(150, Math.max(96, Math.round(p.resolution)))
  const images = await pdfToImages(inPath, workdir, { dpi, format: 'png' })
  const slides: { image: Buffer; ext: 'png' }[] = []
  for (let i = 0; i < images.length; i++) {
    slides.push({ image: await readFile(images[i]), ext: 'png' })
    ctx.progress(20 + ((i + 1) / images.length) * 60)
  }
  const pptx = await writePptx(slides)
  return { outputs: [await ctx.putOutput(pptx, withExt(file.name, 'pptx'), mimeForExt('pptx'))] }
}

// Cluster a page's raw text items into visual rows (baseline y tolerance 3pt),
// then split each row into cells at x-gaps > 12pt between one item's end and
// the next item's start. Empty cells ('') are kept.
function itemRows(items: { str: string; x: number; y: number; width: number }[]): string[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y)
  const rows: (typeof sorted)[] = []
  for (const it of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(row[0].y - it.y) <= 3) row.push(it)
    else rows.push([it])
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x)
    const cells: string[] = [row[0].str]
    for (let i = 1; i < row.length; i++) {
      if (row[i].x - (row[i - 1].x + row[i - 1].width) > 12) cells.push('')
      cells[cells.length - 1] += row[i].str
    }
    return cells
  })
}

const pdfToExcel: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['pdf-to-excel']
  const { file, buf } = await firstInput(ctx)
  ctx.progress(20)
  const { items } = await extractTextItems(buf)
  ctx.progress(50)

  if (p.exportFormat === 'csv') {
    const rows: string[][] = []
    items.forEach((pageItems, i) => {
      rows.push(...itemRows(pageItems))
      if (i < items.length - 1) rows.push([])
    })
    return { outputs: [await ctx.putOutput(Buffer.from(writeCsv(rows), 'utf8'), withExt(file.name, 'csv'), mimeForExt('csv'))] }
  }

  const sheets = items.map((pageItems, i) => ({ name: `Page ${i + 1}`, rows: itemRows(pageItems) }))
  const xlsx = await writeXlsx(sheets)
  return { outputs: [await ctx.putOutput(xlsx, withExt(file.name, 'xlsx'), mimeForExt('xlsx'))] }
}

const wordToPdf: TaskHandler = async (ctx) => {
  const { file, buf } = await firstInput(ctx)
  const workdir = await ctx.workdir()
  const ext = (file.name.split('.').pop() ?? 'docx').toLowerCase()
  const inPath = path.join(workdir, `input.${ext}`)
  await writeFile(inPath, buf)
  const pdfPath = await sofficeConvert(inPath, workdir, 'pdf')
  ctx.progress(85)
  return { outputs: [await ctx.adoptOutput(pdfPath, withExt(file.name, 'pdf'), PDF_MIME)] }
}

function findChromium(): string | null {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH
  for (const candidate of ['/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(candidate)) return candidate
  }
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright')
  if (existsSync(cache)) {
    for (const entry of readdirSync(cache)) {
      const chrome = path.join(cache, entry, 'chrome-linux', 'chrome')
      if (existsSync(chrome)) return chrome
    }
  }
  return null
}

// Output name for url/code sources (no upload): hostname.pdf / code.pdf.
function htmlOutputName(p: ToolParams['html-to-pdf'], files: StoredMeta[]): string {
  if (p.source === 'file' && files.length > 0) return withExt(files[0].name, 'pdf')
  if (p.source === 'url') {
    try {
      return `${new URL(p.url).hostname.replace(/[^a-z0-9.-]/gi, '') || 'page'}.pdf`
    } catch {
      return 'page.pdf'
    }
  }
  return 'code.pdf'
}

// HTML → plain text: block tags become paragraph breaks, tags/entities go.
function htmlToText(html: string): string {
  const broken = html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article|blockquote|pre|table|ul|ol)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n\n')
  const decoded = broken
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
  return decoded
    .replace(/<[^>]+>/g, '')
    .split('\n\n')
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

async function textLayoutPdf(text: string): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const W = 612, H = 792, M = 56, LH = 14
  let page = doc.addPage([W, H])
  let y = H - M
  for (const para of text.split('\n\n')) {
    let line = ''
    const wrapped: string[] = []
    for (const word of para.split(' ')) {
      if (line && line.length + 1 + word.length > 80) {
        wrapped.push(line)
        line = word
      } else {
        line = line ? `${line} ${word}` : word
      }
    }
    if (line) wrapped.push(line)
    for (const l of wrapped) {
      if (y < M) {
        page = doc.addPage([W, H])
        y = H - M
      }
      page.drawText(winAnsi(l), { x: M, y, size: 11, font, color: rgb(0, 0, 0) })
      y -= LH
    }
    y -= LH / 2
  }
  return Buffer.from(await doc.save())
}

const htmlToPdf: TaskHandler = async (ctx) => {
  const p = ctx.params as ToolParams['html-to-pdf']
  const workdir = await ctx.workdir()
  const out = path.join(workdir, 'out.pdf')

  const chrome = findChromium()
  if (chrome) {
    let target = p.url
    if (p.source === 'code') {
      // chrome print-to-pdf takes paper size and margins from @page CSS
      const size = p.pageSize === 'Letter' ? 'letter' : 'a4'
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: ${size} ${p.orientation}; margin: ${Math.max(0, p.margin)}mm; }</style></head><body>${p.htmlCode}</body></html>`
      const f = path.join(workdir, 'input.html')
      await writeFile(f, html, 'utf8')
      target = `file://${f}`
    } else if (p.source === 'file') {
      if (ctx.files.length === 0) throw new TaskError('TOO_FEW_FILES', 'Upload an HTML file or switch the source to URL/code')
      const buf = await ctx.readBuf(ctx.files[0].id)
      if (!buf) throw new TaskError('FAILED', `${ctx.files[0].name}: input missing from store`)
      const f = path.join(workdir, 'input.html')
      await writeFile(f, buf)
      target = `file://${f}`
    }
    const args = ['--headless=new', '--disable-gpu', '--no-sandbox', `--print-to-pdf=${out}`, `--virtual-time-budget=${Math.max(0, Math.round(p.delay || 0))}`]
    await runBin(chrome, [...args, target], { timeoutMs: 60000 })
    ctx.progress(90)
    return { outputs: [await ctx.adoptOutput(out, htmlOutputName(p, ctx.files), PDF_MIME)] }
  }

  // text fallback (no chromium in this environment): strip tags and lay out plain text
  let html: string
  if (p.source === 'url') {
    try {
      const res = await fetch(p.url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = await res.text()
    } catch (e) {
      throw new TaskError('FAILED', `Could not fetch ${p.url}: ${e instanceof Error ? e.message : String(e)}`)
    }
  } else if (p.source === 'file') {
    if (ctx.files.length === 0) throw new TaskError('TOO_FEW_FILES', 'Upload an HTML file or switch the source to URL/code')
    const buf = await ctx.readBuf(ctx.files[0].id)
    if (!buf) throw new TaskError('FAILED', `${ctx.files[0].name}: input missing from store`)
    html = buf.toString('utf8')
  } else {
    html = p.htmlCode ?? ''
  }
  ctx.progress(50)
  const bytes = await textLayoutPdf(htmlToText(html))
  return { outputs: [await ctx.putOutput(bytes, htmlOutputName(p, ctx.files), PDF_MIME)] }
}

// ---- convert-from-pdf ----

const extractImages: TaskHandler = async (ctx) => {
  const { file, buf } = await firstInput(ctx)
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({ data: new Uint8Array(buf), verbosity: 0 })
  const pdf = await task.promise
  const stem = baseName(file.name)
  const outputs: StoredMeta[] = []
  const LIMIT = 200

  for (let pageNo = 1; pageNo <= pdf.numPages && outputs.length < LIMIT; pageNo++) {
    const page = await pdf.getPage(pageNo)
    const { fnArray, argsArray } = await page.getOperatorList()
    const seen = new Set<string>()
    let imgNo = 0
    for (let i = 0; i < fnArray.length && outputs.length < LIMIT; i++) {
      if (fnArray[i] !== OPS.paintImageXObject && fnArray[i] !== OPS.paintImageXObjectRepeat) continue
      const name = argsArray[i][0]
      if (typeof name !== 'string' || seen.has(name)) continue
      seen.add(name)
      const holder = name.startsWith('g_') ? page.commonObjs : page.objs
      // objs.get delivers via callback once the image is decoded (image data
      // often resolves AFTER getOperatorList returns, so has() is not a gate);
      // cap the wait so a never-resolving object can't stall the task
      const obj = await new Promise<unknown>((resolve) => {
        const timer = setTimeout(() => resolve(null), 10000)
        try {
          holder.get(name, (o: unknown) => {
            clearTimeout(timer)
            resolve(o)
          })
        } catch {
          clearTimeout(timer)
          resolve(null)
        }
      })
      const img = obj as { data?: Uint8Array; width?: number; height?: number } | null
      if (!img || !(img.data instanceof Uint8Array) || !img.width || !img.height) continue
      const { width, height, data } = img
      const pixels = width * height
      const channels = data.length / pixels
      const rgba = new Uint8Array(pixels * 4)
      if (channels === 4) {
        rgba.set(data.subarray(0, rgba.length))
      } else if (channels === 3) {
        for (let px = 0, s = 0, d = 0; px < pixels; px++, s += 3, d += 4) {
          rgba[d] = data[s]
          rgba[d + 1] = data[s + 1]
          rgba[d + 2] = data[s + 2]
          rgba[d + 3] = 255
        }
      } else if (channels === 1) {
        for (let px = 0, d = 0; px < pixels; px++, d += 4) {
          rgba[d] = data[px]
          rgba[d + 1] = data[px]
          rgba[d + 2] = data[px]
          rgba[d + 3] = 255
        }
      } else {
        continue
      }
      imgNo++
      outputs.push(await ctx.putOutput(Buffer.from(encodePng(rgba, width, height)), `${stem}-p${pageNo}-img${imgNo}.png`, mimeForExt('png')))
    }
    ctx.progress((pageNo / pdf.numPages) * 90)
  }
  await task.destroy()
  if (outputs.length === 0) throw new TaskError('FAILED', 'No embedded images found')
  return { outputs }
}

export const convertHandlers: Record<string, TaskHandler> = {
  'jpg-to-pdf': jpgToPdf,
  'pdf-to-jpg': pdfToJpg,
  'pdf-to-text': pdfToText,
  'pdf-to-word': pdfToWord,
  'pdf-to-ppt': pdfToPpt,
  'pdf-to-excel': pdfToExcel,
  'word-to-pdf': wordToPdf,
  'html-to-pdf': htmlToPdf,
  'extract-images': extractImages,
}
