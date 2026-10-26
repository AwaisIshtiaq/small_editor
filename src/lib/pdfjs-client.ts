'use client'

// Client-only pdf.js helper. Dynamic import keeps pdfjs out of the SSR bundle;
// the worker asset is resolved by Turbopack via import.meta.url.

import type { PDFDocumentProxy } from 'pdfjs-dist'

type PdfJs = typeof import('pdfjs-dist/build/pdf.mjs')

let lib: PdfJs | null = null

async function pdfjs(): Promise<PdfJs> {
  if (!lib) {
    lib = await import('pdfjs-dist/build/pdf.mjs')
    lib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
  }
  return lib
}

// pdf.js transfers (detaches) the buffer handed to the worker — always copy,
// and cache one document per bytes object so repeated renders stay cheap.
const docs = new WeakMap<Uint8Array, Promise<PDFDocumentProxy>>()

export function loadPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  let p = docs.get(bytes)
  if (!p) {
    p = pdfjs().then((m) => m.getDocument({ data: bytes.slice() }).promise)
    p.catch(() => {
      if (docs.get(bytes) === p) docs.delete(bytes)
    })
    docs.set(bytes, p)
  }
  return p
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await loadPdf(bytes)
  return doc.numPages
}

/**
 * Render one page to a JPEG data URL.
 * Returns width/height as the PAGE SIZE IN PDF POINTS (scale 1 viewport),
 * not the rendered pixel size — callers use them for coordinate math.
 */
export async function renderThumb(
  bytes: Uint8Array,
  pageNum: number,
  maxW = 160,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const doc = await loadPdf(bytes)
  const page = await doc.getPage(pageNum)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: maxW / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
  page.cleanup()
  return { dataUrl, width: base.width, height: base.height }
}

export async function renderPageJpeg(
  bytes: Uint8Array,
  pageNum: number,
  dpi = 150,
  opts?: { grayscale?: boolean; format?: 'jpg' | 'png' },
): Promise<Blob> {
  const doc = await loadPdf(bytes)
  const page = await doc.getPage(pageNum)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: dpi / 72 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (opts?.grayscale) ctx.filter = 'grayscale(100%)'
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      opts?.format === 'png' ? 'image/png' : 'image/jpeg',
      0.9,
    )
  })
  page.cleanup()
  return blob
}
