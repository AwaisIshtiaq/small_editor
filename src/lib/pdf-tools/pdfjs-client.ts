// pdf.js loader for the browser only: thumbnails, page selection and the
// client-side PDF→JPG renderer (server Node rendering is not viable — glyph
// path functions cannot cross the worker boundary).
'use client'

type PdfjsModule = typeof import('pdfjs-dist')

let mod: PdfjsModule | null = null

export async function getPdfjs(): Promise<PdfjsModule> {
  if (!mod) {
    mod = await import('pdfjs-dist')
    mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }
  return mod
}

export async function loadDocument(data: ArrayBuffer) {
  const pdfjs = await getPdfjs()
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise
}

export async function renderPageToJpeg(page: import('pdfjs-dist').PDFPageProxy, scale: number, quality = 0.85): Promise<Blob> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPG encoding failed'))), 'image/jpeg', quality),
  )
}
