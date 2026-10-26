'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react'
import { loadPdf } from '@/lib/pdfjs-client'
import { cn } from '@/lib/utils'

type Thumb = { dataUrl: string; width: number; height: number }

/**
 * Renders pdf.js thumbnails for every page.
 * mode 'select': click toggles pages → onChange(selected 0-based indices)
 * mode 'order' : drag or use arrows → onChange(new order as 0-based indices)
 */
export function PageGrid({
  bytes,
  mode,
  onChange,
}: {
  bytes: Uint8Array
  mode: 'select' | 'order'
  onChange: (pages: number[]) => void
}) {
  const [thumbs, setThumbs] = useState<Thumb[]>([])
  const [count, setCount] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [order, setOrder] = useState<number[]>([])
  const dragFrom = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const doc = await loadPdf(bytes)
      const n = doc.numPages
      if (cancelled) return
      setCount(n)
      setOrder(Array.from({ length: n }, (_, i) => i))
      const next: Thumb[] = []
      for (let p = 1; p <= n; p++) {
        const page = await doc.getPage(p)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 160 / base.width })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        if (cancelled) return
        next.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.75), width: base.width, height: base.height })
        setThumbs([...next])
        page.cleanup()
      }
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [bytes])

  // Report state upward whenever it changes.
  useEffect(() => {
    if (count === 0) return
    if (mode === 'select') onChangeRef.current([...selected].sort((a, b) => a - b))
    else onChangeRef.current(order)
  }, [mode, selected, order, count])

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const reorder = (from: number, to: number) =>
    setOrder((prev) => {
      if (from === null || from === to || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  if (count === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Rendering pages</span>
      </div>
    )
  }

  return (
    <div className="slim-scroll grid max-h-[32rem] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {(mode === 'order' ? order : Array.from({ length: count }, (_, i) => i)).map((pageIndex, displayIdx) => {
        const thumb = thumbs[pageIndex]
        const isSelected = selected.has(pageIndex)
        const position = mode === 'order' ? order.indexOf(pageIndex) : displayIdx
        return (
          <div
            key={pageIndex}
            draggable={mode === 'order'}
            onDragStart={() => {
              dragFrom.current = position
            }}
            onDragOver={(e) => {
              if (mode === 'order') e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              reorder(dragFrom.current ?? -1, position)
              dragFrom.current = null
            }}
            className={cn(
              'relative overflow-hidden rounded-md border bg-white',
              mode === 'select' && 'cursor-pointer transition-shadow',
              mode === 'select' && isSelected && 'ring-2 ring-primary ring-offset-1',
            )}
            {...(mode === 'select'
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-pressed': isSelected,
                  'aria-label': `Page ${pageIndex + 1}`,
                  onClick: () => toggle(pageIndex),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle(pageIndex)
                    }
                  },
                }
              : { 'aria-label': `Page ${pageIndex + 1}, position ${position + 1}` })}
          >
            {thumb ? (
              <img
                src={thumb.dataUrl}
                alt={`Page ${pageIndex + 1}`}
                className="block h-auto w-full select-none"
                draggable={false}
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              </div>
            )}
            <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full border bg-background/90 text-[10px] font-medium">
              {pageIndex + 1}
            </span>
            {mode === 'select' && isSelected ? (
              <span className="absolute inset-0 bg-primary/10" aria-hidden="true" />
            ) : null}
            {mode === 'order' ? (
              <span className="absolute top-1 right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  aria-label={`Move page ${pageIndex + 1} earlier`}
                  disabled={position === 0}
                  className="flex size-6 items-center justify-center rounded border bg-background/95 shadow-sm transition-colors hover:bg-accent disabled:opacity-40"
                  onClick={(e) => {
                    e.stopPropagation()
                    reorder(position, position - 1)
                  }}
                >
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Move page ${pageIndex + 1} later`}
                  disabled={position === order.length - 1}
                  className="flex size-6 items-center justify-center rounded border bg-background/95 shadow-sm transition-colors hover:bg-accent disabled:opacity-40"
                  onClick={(e) => {
                    e.stopPropagation()
                    reorder(position, position + 1)
                  }}
                >
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
