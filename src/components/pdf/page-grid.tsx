'use client'

import { useEffect, useState } from 'react'
import { loadDocument } from '@/lib/pdf-tools/pdfjs-client'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface Placement {
  pageNumber: number
  x: number
  y: number
  pageWidth: number
  pageHeight: number
}

interface PageGridProps {
  data: ArrayBuffer
  mode: 'select' | 'order' | 'place'
  selected?: Set<number> // 0-based for select mode
  onToggle?: (index: number) => void
  order?: number[]
  onOrderChange?: (order: number[]) => void
  placement?: Placement | null
  onPlace?: (p: Placement) => void
}

// Renders page thumbnails with pdf.js. Three jobs depending on mode:
// select (delete/extract), order (organize), place (sign: click a page, then
// click where the signature goes; coordinates are converted to PDF points).
export function PageGrid({ data, mode, selected, onToggle, order, onOrderChange, placement, onPlace }: PageGridProps) {
  const [thumbs, setThumbs] = useState<string[] | null>(null)
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | null>(null)
  const [activePage, setActivePage] = useState<number | null>(null)
  const [big, setBig] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const buf = data.slice(0)
    ;(async () => {
      try {
        const pdf = await loadDocument(buf)
        const urls: string[] = []
        const dims: { w: number; h: number }[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const base = page.getViewport({ scale: 1 })
          dims.push({ w: base.width, h: base.height })
          const viewport = page.getViewport({ scale: 132 / base.width })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
          urls.push(canvas.toDataURL('image/jpeg', 0.75))
        }
        if (!cancelled) {
          setThumbs(urls)
          setSizes(dims)
          if (mode === 'place') setActivePage(0)
        }
      } catch (e) {
        if (!cancelled)
          setError(/password/i.test(String(e)) ? 'This PDF is password-protected — unlock it first.' : 'Could not read this PDF.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, mode])

  useEffect(() => {
    let cancelled = false
    if (mode !== 'place' || activePage === null || !thumbs) return
    ;(async () => {
      const pdf = await loadDocument(data.slice(0))
      const page = await pdf.getPage(activePage + 1)
      const viewport = page.getViewport({ scale: 560 / page.getViewport({ scale: 1 }).width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
      if (!cancelled) setBig(canvas.toDataURL('image/jpeg', 0.8))
    })()
    return () => {
      cancelled = true
    }
  }, [mode, activePage, data, thumbs])

  if (error) return <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>

  if (!thumbs || !sizes)
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    )

  const seq = mode === 'order' ? order ?? [] : thumbs.map((_, i) => i)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {thumbs.length} page{thumbs.length === 1 ? '' : 's'}
          {mode === 'select' && selected && selected.size > 0 ? ` · ${selected.size} selected` : ''}
          {mode === 'order' ? ' · drag pages to reorder' : ''}
          {mode === 'place' ? ' · click a page, then click where the element goes' : ''}
        </span>
        {mode === 'select' && (
          <div className="flex gap-2">
            <button type="button" className="underline hover:text-foreground" onClick={() => thumbs.forEach((_, i) => onToggle?.(i))}>
              Select all
            </button>
            <button type="button" className="underline hover:text-foreground" onClick={() => selected?.forEach((i) => onToggle?.(i))}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div className={cn('grid max-h-96 gap-3 overflow-y-auto pr-1', mode === 'place' ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6')}>
        {seq.map((pageIdx, slot) => {
          const isSel = selected?.has(pageIdx)
          return (
            <button
              key={pageIdx}
              type="button"
              draggable={mode === 'order'}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', String(slot))}
              onDragOver={(e) => mode === 'order' && e.preventDefault()}
              onDrop={(e) => {
                if (mode !== 'order' || !onOrderChange) return
                e.preventDefault()
                const from = Number(e.dataTransfer.getData('text/plain'))
                const next = [...(order ?? [])]
                next.splice(from, 1)
                next.splice(slot, 0, pageIdx)
                onOrderChange(next)
              }}
              onClick={() => {
                if (mode === 'select') onToggle?.(pageIdx)
                if (mode === 'place') setActivePage(pageIdx)
              }}
              className={cn(
                'relative overflow-hidden rounded-md border bg-white transition-all',
                isSel ? 'border-primary ring-2 ring-primary' : 'border-border',
                mode === 'place' && activePage === pageIdx && 'border-primary ring-2 ring-primary',
              )}
            >
              <img src={thumbs[pageIdx]} alt={`Page ${pageIdx + 1}`} className="block w-full" draggable={false} />
              {mode === 'order' && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-xs font-medium text-primary-foreground">{slot + 1}</span>
              )}
              {isSel && (
                <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">✓</span>
              )}
              <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[10px] text-white">{pageIdx + 1}</span>
            </button>
          )
        })}
      </div>

      {mode === 'place' && activePage !== null && big && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Page {activePage + 1} — click on the page to position the element
          </p>
          <div
            className="relative mx-auto w-fit cursor-crosshair rounded-md border"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const fx = (e.clientX - rect.left) / rect.width
              const fy = (e.clientY - rect.top) / rect.height
              const dim = sizes[activePage]
              onPlace?.({
                pageNumber: activePage + 1,
                x: Math.round(fx * dim.w),
                y: Math.round((1 - fy) * dim.h), // PDF origin is bottom-left
                pageWidth: dim.w,
                pageHeight: dim.h,
              })
            }}
          >
            <img src={big} alt={`Page ${activePage + 1} preview`} className="block max-w-full" draggable={false} />
            {placement && placement.pageNumber === activePage + 1 && (
              <span
                className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/20"
                style={{
                  left: `${(placement.x / placement.pageWidth) * 100}%`,
                  top: `${(1 - placement.y / placement.pageHeight) * 100}%`,
                  width: '18%',
                  height: '7%',
                  transform: 'translateY(-100%)',
                }}
              />
            )}
          </div>
          {placement && (
            <p className="text-center text-xs text-muted-foreground">
              Placed on page {placement.pageNumber} at {placement.x}, {placement.y} pt
            </p>
          )}
        </div>
      )}
    </div>
  )
}
