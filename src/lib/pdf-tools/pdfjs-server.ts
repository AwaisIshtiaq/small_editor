// Server-side pdf.js: text + outline extraction for split-text, pdf-to-word,
// rename and friends. The legacy build runs without a worker under Node.

import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

export type TextLine = { text: string; x: number; y: number; width: number; height: number; page: number }

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let cached: PdfJs | null = null

// pdfjs worker/fonts live in node_modules; resolve them from the project root
// OR relative to this module (process.cwd() is not always the project root).
function pdfjsAsset(rel: string): string | undefined {
  const candidates = [
    join(process.cwd(), 'node_modules/pdfjs-dist', rel),
    fileURLToPath(new URL(`../../../node_modules/pdfjs-dist/${rel}`, import.meta.url)),
  ]
  for (const c of candidates) if (existsSync(c)) return c
  return undefined
}

async function lib(): Promise<PdfJs> {
  if (!cached) {
    cached = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // Node uses a fake worker; it still needs a resolvable workerSrc to import.
    cached.GlobalWorkerOptions.workerSrc = pdfjsAsset('legacy/build/pdf.worker.mjs') ?? ''
  }
  return cached
}

function standardFontDataUrl(): string | undefined {
  return pdfjsAsset('standard_fonts/')
}

async function open(buf: Buffer) {
  const pdfjs = await lib()
  const task = pdfjs.getDocument({
    data: new Uint8Array(buf), // copy: pdf.js may detach the underlying buffer
    useSystemFonts: true,
    ...(standardFontDataUrl() ? { standardFontDataUrl: standardFontDataUrl() } : {}),
  })
  const doc = await task.promise
  return { doc, done: () => task.destroy() }
}

type RawItem = { str: string; x: number; y: number; width: number; height: number }

// Raw per-page text items (no line grouping) — pdf-to-excel clusters these
// into rows and columns by y/x proximity.
export async function extractTextItems(
  buf: Buffer,
): Promise<{ items: RawItem[][]; pageCount: number }> {
  const { doc, done } = await open(buf)
  try {
    const items: RawItem[][] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const raw: RawItem[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        raw.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
        })
      }
      items.push(raw)
    }
    return { items, pageCount: doc.numPages }
  } finally {
    await done()
  }
}

export async function extractTextPages(buf: Buffer): Promise<{ pages: TextLine[][]; pageCount: number }> {
  const { items, pageCount } = await extractTextItems(buf)
  const pages = items.map((raw, n) => groupLines(raw, n + 1))
  return { pages, pageCount }
}

// Items on one page whose baselines sit within 3pt belong to the same line.
// Fragments closer than ~1pt are kerning splits of one word — join those
// without a separator.
function groupLines(items: RawItem[], page: number): TextLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const groups: { y: number; items: RawItem[] }[] = []
  for (const it of sorted) {
    const g = groups.find((g) => Math.abs(g.y - it.y) < 3)
    if (g) g.items.push(it)
    else groups.push({ y: it.y, items: [it] })
  }
  return groups.map((g) => {
    const parts = g.items.sort((a, b) => a.x - b.x)
    let text = ''
    let prevEnd = -Infinity
    for (const p of parts) {
      if (text && p.x - prevEnd > 1 && !/\s$/.test(text) && !/^\s/.test(p.str)) text += ' '
      text += p.str
      prevEnd = p.x + p.width
    }
    const x = Math.min(...parts.map((p) => p.x))
    const end = Math.max(...parts.map((p) => p.x + p.width))
    const height = Math.max(...parts.map((p) => p.height))
    return { text, x, y: g.y, width: end - x, height, page }
  })
}

type OutlineEntry = { title: string; dest: unknown; items?: OutlineEntry[] }

export async function extractOutline(
  buf: Buffer,
): Promise<{ title: string; page: number; level: number }[] | null> {
  const { doc, done } = await open(buf)
  try {
    const outline = (await doc.getOutline()) as unknown as OutlineEntry[] | null
    if (!outline || outline.length === 0) return null
    const flat: { title: string; page: number; level: number }[] = []
    const walk = async (entries: OutlineEntry[], level: number) => {
      for (const e of entries) {
        let page = 0
        try {
          const dest = typeof e.dest === 'string' ? await doc.getDestination(e.dest) : e.dest
          if (Array.isArray(dest) && dest[0]) page = (await doc.getPageIndex(dest[0])) + 1
        } catch {
          page = 0
        }
        flat.push({ title: e.title, page, level })
        if (e.items?.length) await walk(e.items, level + 1)
      }
    }
    await walk(outline, 1)
    return flat
  } finally {
    await done()
  }
}
