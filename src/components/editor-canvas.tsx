'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SignaturePad } from '@/components/signature-pad'
import { loadPdf, renderThumb } from '@/lib/pdfjs-client'
import { cn } from '@/lib/utils'
import type { EditorOp, FormOp } from '@/lib/pdf-tools/registry'

type Mode = 'sign' | 'pdf-editor' | 'pdf-forms'

// All overlay coordinates are page points, TOP-LEFT origin (y grows downward),
// scaled from the rendered canvas. Handlers convert to PDF bottom-left space.
const SIGN_WIDTH_PT = 150
const TEXT_FONT_SIZE = 16
const TEXT_COLOR = '#111111'
const FIELD_WIDTH_PT = 160

/**
 * Visual editor for sign / pdf-editor / pdf-forms: renders the selected page
 * large and overlays click-placed signature, text, white-out or form fields.
 */
export function EditorCanvas({
  slug,
  bytes,
  onRun,
  running,
}: {
  slug: Mode
  bytes: Uint8Array
  onRun: (params: Record<string, unknown>) => void
  running: boolean
}) {
  const [pageCount, setPageCount] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [img, setImg] = useState<{ dataUrl: string; width: number; height: number } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // sign
  const [sigId, setSigId] = useState<string | null>(null)
  const [sigUrl, setSigUrl] = useState<string | null>(null)
  const [place, setPlace] = useState<{ x: number; y: number } | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // pdf-editor
  const [tool, setTool] = useState<'text' | 'rect'>('text')
  const [ops, setOps] = useState<EditorOp[]>([])
  const [draft, setDraft] = useState<{ x: number; y: number; value: string } | null>(null)
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null)
  const [rectEnd, setRectEnd] = useState<{ x: number; y: number } | null>(null)

  // pdf-forms
  const [formOps, setFormOps] = useState<FormOp[]>([])
  const fieldSeq = useRef(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const doc = await loadPdf(bytes)
        if (cancelled) return
        setPageCount(doc.numPages)
        const t = await renderThumb(bytes, pageNumber, 900)
        if (cancelled) return
        setImg({ dataUrl: t.dataUrl, width: t.width, height: t.height })
      } catch {
        if (!cancelled) setLoadError('Could not render this PDF page.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bytes, pageNumber])

  const handleSignature = useCallback(
    async (blob: Blob | null) => {
      if (!blob) {
        setSigId(null)
        return
      }
      try {
        const fd = new FormData()
        fd.append('files', new File([blob], 'signature.png', { type: 'image/png' }))
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error?.message ?? 'Signature upload failed')
        setSigId(json.files[0].id as string)
        setSigUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Signature upload failed')
      }
    },
    [],
  )

  const toPt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!img) return null
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * img.width,
      y: ((e.clientY - rect.top) / rect.height) * img.height,
    }
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`

  const commitDraft = () => {
    if (!draft || !draft.value.trim()) {
      setDraft(null)
      return
    }
    setOps((prev) => [
      ...prev,
      {
        kind: 'text',
        page: pageNumber,
        x: draft.x,
        y: draft.y,
        text: draft.value,
        fontSize: TEXT_FONT_SIZE,
        color: TEXT_COLOR,
      },
    ])
    setDraft(null)
  }

  const commitRect = () => {
    if (rectStart && rectEnd) {
      const x = Math.min(rectStart.x, rectEnd.x)
      const y = Math.min(rectStart.y, rectEnd.y)
      const width = Math.abs(rectEnd.x - rectStart.x)
      const height = Math.abs(rectEnd.y - rectStart.y)
      if (width > 2 && height > 2) {
        setOps((prev) => [...prev, { kind: 'rect', page: pageNumber, x, y, width, height, color: '#ffffff' }])
      }
    }
    setRectStart(null)
    setRectEnd(null)
  }

  const placeField = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!img) return
    const p = toPt(e)
    if (!p) return
    fieldSeq.current += 1
    setFormOps((prev) => [
      ...prev,
      { kind: 'textfield', page: pageNumber, x: p.x, y: p.y, width: FIELD_WIDTH_PT, name: `field_${fieldSeq.current}` },
    ])
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!img) return
    if (slug === 'sign') {
      const p = toPt(e)
      if (p) setPlace(p)
    } else if (slug === 'pdf-forms') {
      placeField(e)
    } else if (tool === 'text') {
      const p = toPt(e)
      if (p) setDraft({ x: p.x, y: p.y, value: '' })
    }
    // rect mode is handled by pointer down/move/up
  }

  const canRun =
    slug === 'sign' ? !!sigId && !!place && !running : slug === 'pdf-editor' ? ops.length > 0 && !running : formOps.length > 0 && !running

  const run = () => {
    if (slug === 'sign' && sigId && place) {
      onRun({ pageNumber, x: place.x, y: place.y, width: SIGN_WIDTH_PT, imageDataId: sigId })
    } else if (slug === 'pdf-editor') {
      onRun({ ops })
    } else if (slug === 'pdf-forms') {
      onRun({ ops: formOps })
    }
  }

  const hint =
    slug === 'sign'
      ? sigId
        ? 'Click on the page to place your signature'
        : 'Draw a signature below, then click on the page to place it'
      : slug === 'pdf-forms'
        ? 'Click on the page to add a text field'
        : tool === 'text'
          ? 'Click on the page to add text'
          : 'Click and drag to white-out an area'

  const shownOps: { key: string; label: string; remove: () => void }[] =
    slug === 'pdf-editor'
      ? ops.map((op, i) => ({
          key: `op-${i}`,
          label:
            op.kind === 'text'
              ? `p${op.page} Text: ${op.text.slice(0, 24)}`
              : op.kind === 'rect'
                ? `p${op.page} White-out ${Math.round(op.width)}×${Math.round(op.height)}pt`
                : `p${op.page} Image`,
          remove: () => setOps((prev) => prev.filter((_, j) => j !== i)),
        }))
      : slug === 'pdf-forms'
        ? formOps.map((op, i) => ({
            key: `field-${i}`,
            label: `p${op.page} Field: ${op.name}`,
            remove: () => setFormOps((prev) => prev.filter((_, j) => j !== i)),
          }))
        : []

  return (
    <div className="space-y-4">
      {/* page selector */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-24 text-center text-sm tabular-nums">
            Page {pageNumber} of {pageCount || '…'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={pageNumber >= pageCount}
            onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* editor toolbar */}
      {slug === 'pdf-editor' ? (
        <div className="flex gap-2" role="group" aria-label="Editor tools">
          <Button
            type="button"
            size="sm"
            variant={tool === 'text' ? 'default' : 'outline'}
            aria-pressed={tool === 'text'}
            onClick={() => setTool('text')}
          >
            Text
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tool === 'rect' ? 'default' : 'outline'}
            aria-pressed={tool === 'rect'}
            onClick={() => setTool('rect')}
          >
            White-out
          </Button>
        </div>
      ) : null}

      {/* canvas + overlays */}
      {loadError ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : (
        <div
          className={cn(
            'relative mx-auto w-full max-w-3xl overflow-hidden rounded-md border bg-white select-none',
            slug === 'pdf-editor' && tool === 'rect' ? 'cursor-crosshair' : 'cursor-crosshair',
          )}
          onClick={onCanvasClick}
          onMouseMove={(e) => {
            if (slug !== 'sign' || !img) return
            const p = toPt(e)
            if (p) setCursor(p)
          }}
          onMouseLeave={() => setCursor(null)}
          onPointerDown={(e) => {
            if (slug !== 'pdf-editor' || tool !== 'rect' || !img) return
            const rect = e.currentTarget.getBoundingClientRect()
            setRectStart({
              x: ((e.clientX - rect.left) / rect.width) * img.width,
              y: ((e.clientY - rect.top) / rect.height) * img.height,
            })
            setRectEnd(null)
          }}
          onPointerMove={(e) => {
            if (slug !== 'pdf-editor' || tool !== 'rect' || !rectStart || !img) return
            const rect = e.currentTarget.getBoundingClientRect()
            setRectEnd({
              x: ((e.clientX - rect.left) / rect.width) * img.width,
              y: ((e.clientY - rect.top) / rect.height) * img.height,
            })
          }}
          onPointerUp={() => {
            if (slug === 'pdf-editor' && tool === 'rect') commitRect()
          }}
        >
          {img ? (
            <img src={img.dataUrl} alt={`Page ${pageNumber} preview`} className="pointer-events-none block h-auto w-full" draggable={false} />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">Rendering page</span>
            </div>
          )}

          {img ? (
            <>
              {/* sign: cursor preview + placed signature */}
              {slug === 'sign' && sigUrl && cursor && !place ? (
                <div
                  className="pointer-events-none absolute rounded-sm border-2 border-dashed border-emerald-500 bg-emerald-500/10"
                  style={{
                    left: pct(cursor.x, img.width),
                    top: pct(cursor.y, img.height),
                    width: pct(SIGN_WIDTH_PT, img.width),
                    height: pct(SIGN_WIDTH_PT * 0.4, img.height),
                  }}
                  aria-hidden="true"
                />
              ) : null}
              {slug === 'sign' && sigUrl && place ? (
                <img
                  src={sigUrl}
                  alt="Signature placement preview"
                  className="pointer-events-none absolute rounded-sm border-2 border-emerald-500/70"
                  style={{ left: pct(place.x, img.width), top: pct(place.y, img.height), width: pct(SIGN_WIDTH_PT, img.width) }}
                />
              ) : null}

              {/* editor: inline text input at click position */}
              {slug === 'pdf-editor' && draft && img ? (
                <Input
                  autoFocus
                  value={draft.value}
                  aria-label="Text to place on page"
                  placeholder="Type text, press Enter"
                  className="absolute rounded-sm border-emerald-500 bg-white/95 text-sm"
                  style={{
                    left: pct(draft.x, img.width),
                    top: pct(draft.y, img.height),
                    width: '45%',
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitDraft()
                    if (e.key === 'Escape') setDraft(null)
                  }}
                  onBlur={commitDraft}
                />
              ) : null}

              {/* editor: white-out drag preview */}
              {slug === 'pdf-editor' && rectStart && rectEnd && img ? (
                <div
                  className="pointer-events-none absolute border border-red-700/60 bg-red-500/40"
                  style={{
                    left: pct(Math.min(rectStart.x, rectEnd.x), img.width),
                    top: pct(Math.min(rectStart.y, rectEnd.y), img.height),
                    width: pct(Math.abs(rectEnd.x - rectStart.x), img.width),
                    height: pct(Math.abs(rectEnd.y - rectStart.y), img.height),
                  }}
                  aria-hidden="true"
                />
              ) : null}

              {/* forms: field preview at cursor */}
              {slug === 'pdf-forms' && cursor ? (
                <div
                  className="pointer-events-none absolute rounded-sm border-2 border-dashed border-emerald-500 bg-emerald-500/10"
                  style={{
                    left: pct(cursor.x, img.width),
                    top: pct(cursor.y, img.height),
                    width: pct(FIELD_WIDTH_PT, img.width),
                    height: pct(20, img.height),
                  }}
                  aria-hidden="true"
                />
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {/* placed ops chips */}
      {shownOps.length > 0 ? (
        <ul className="slim-scroll flex max-h-28 flex-wrap gap-2 overflow-y-auto" aria-label="Placed items">
          {shownOps.map((op) => (
            <li
              key={op.key}
              className="flex items-center gap-1 rounded-full border bg-accent/50 py-1 pr-1 pl-3 text-xs"
            >
              <span>{op.label}</span>
              <button
                type="button"
                aria-label={`Remove ${op.label}`}
                onClick={op.remove}
                className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-background"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {slug === 'sign' ? <SignaturePad onReady={handleSignature} /> : null}
      {uploadError ? (
        <p className="text-sm text-destructive" role="alert">
          {uploadError}
        </p>
      ) : null}

      <Button onClick={run} disabled={!canRun}>
        {running ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
        Run
      </Button>
    </div>
  )
}
