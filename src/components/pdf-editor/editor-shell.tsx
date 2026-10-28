'use client'

// Sejda-style Edit PDF canvas: two-row toolbar (Text / Links / Forms / Images
// / Sign / Whiteout / Annotate / Shapes / Undo + delete, zoom, rotate, insert
// page), pdf.js page rendering with per-page rotation, draggable overlays,
// thumbnail rail and a chronological action history for undo + save.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check as CheckIcon,
  ChevronLeft,
  ChevronRight,
  Circle,
  FilePlus2,
  Highlighter,
  ImagePlus,
  LayoutGrid,
  Link2,
  Loader2,
  Minus,
  PenLine,
  RotateCcw,
  RotateCw,
  Square,
  Strikethrough,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SignaturePad } from '@/components/signature-pad'
import { loadPdf, renderEditorPage, renderThumb } from '@/lib/pdfjs-client'
import { normRot, replay, resolveOps, START, type History, type OverlayOp, type PlacedOp, type Slot } from './editor-state'
import { cn } from '@/lib/utils'
import type { Rot } from '@/lib/pdf-tools/editor-geometry'

type ToolId =
  | 'select' | 'text' | 'link' | 'form-text' | 'form-check' | 'image' | 'sign'
  | 'whiteout' | 'highlight' | 'underline' | 'strikeout' | 'rect' | 'ellipse' | 'line'

const DRAG_TOOLS = new Set<ToolId>(['link', 'whiteout', 'highlight', 'underline', 'strikeout', 'rect', 'ellipse', 'line'])

const INK_COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a']
const FONT_SIZES = [10, 12, 14, 16, 18, 22, 28, 36]

const uid = () => `o${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`

type Preview = { dataUrl: string; dispW: number; dispH: number }
type PendingImage = { imageDataId: string; url: string }

export function EditorShell({
  bytes,
  busy,
  onRun,
}: {
  bytes: Uint8Array
  busy: boolean
  onRun: (params: Record<string, unknown>) => void
}) {
  const [slots0, setSlots0] = useState<Slot[] | null>(null)
  const [origRots, setOrigRots] = useState<Record<number, Rot>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  const [history, setHistory] = useState<History[]>([])
  const [tool, setTool] = useState<ToolId>('text')
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1.1)
  const [selected, setSelected] = useState<string | null>(null)
  const [inkColor, setInkColor] = useState(INK_COLORS[0])
  const [fontSize, setFontSize] = useState(14)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [rendering, setRendering] = useState(false)
  const [pending, setPending] = useState<PendingImage | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [sigOpen, setSigOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [draft, setDraft] = useState<{ x: number; y: number; value: string } | null>(null)
  const [showThumbs, setShowThumbs] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [moveLive, setMoveLive] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [linePreview, setLinePreview] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  const dragRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const moveRef = useRef<{ id: string; startX: number; startY: number; dx: number; dy: number; moved: boolean } | null>(null)
  const downPtRef = useRef<{ x: number; y: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  const { slots, ops } = useMemo(() => replay(history, slots0 ?? []), [history, slots0])

  const pageSafe = Math.min(Math.max(1, pageNumber), Math.max(1, slots.length))
  const curSlot: Slot | undefined = slots[pageSafe - 1]

  // Blank inserted pages have no pdf.js page — fall back to their stored dims.
  const dispW = curSlot ? (curSlot.src != null ? preview?.dispW ?? 0 : curSlot.w0 ?? 595.28) : 0
  const dispH = curSlot ? (curSlot.src != null ? preview?.dispH ?? 0 : curSlot.h0 ?? 841.89) : 0

  const curRot = useCallback((): Rot => {
    if (!curSlot) return 0
    return normRot((curSlot.src != null ? origRots[curSlot.src] ?? 0 : 0) + curSlot.userRot)
  }, [curSlot, origRots])

  // ---- document load: build the initial page model -------------------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const doc = await loadPdf(bytes)
        if (cancelled) return
        const rots: Record<number, Rot> = {}
        const init: Slot[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          if (cancelled) return
          const base = page.getViewport({ scale: 1, rotation: 0 })
          rots[i] = normRot(page.rotate)
          init.push({ id: `src-${i}`, src: i, userRot: 0, w0: base.width, h0: base.height })
          page.cleanup()
        }
        setOrigRots(rots)
        setSlots0(init)
      } catch (e) {
        console.error('[editor] loadPdf failed:', e)
        if (!cancelled) setLoadError(e instanceof Error ? `Could not open this PDF for editing — ${e.message}` : 'Could not open this PDF for editing.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bytes])

  // ---- main page rendering -------------------------------------------------
  useEffect(() => {
    if (!curSlot || curSlot.src == null) {
      setPreview(null)
      return
    }
    let cancelled = false
    setRendering(true)
    ;(async () => {
      try {
        const rot = normRot((origRots[curSlot.src as number] ?? 0) + curSlot.userRot)
        const t = await renderEditorPage(bytes, curSlot.src as number, zoom, rot)
        if (!cancelled) setPreview({ dataUrl: t.dataUrl, dispW: t.dispW, dispH: t.dispH })
      } catch {
        if (!cancelled) setLoadError('Could not render this page.')
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bytes, curSlot?.id, curSlot?.src, curSlot?.userRot, zoom, origRots]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- thumbnails ----------------------------------------------------------
  useEffect(() => {
    if (!showThumbs || !slots0) return
    let cancelled = false
    ;(async () => {
      for (const slot of slots) {
        if (cancelled) return
        const key = `${slot.id}@${slot.userRot}`
        if (thumbs[key]) continue
        if (slot.src == null) {
          setThumbs((prev) => ({ ...prev, [key]: '' })) // blank page placeholder
          continue
        }
        const rot = normRot((origRots[slot.src] ?? 0) + slot.userRot)
        try {
          const t = await renderThumb(bytes, slot.src, 110)
          if (cancelled) return
          setThumbs((prev) => ({ ...prev, [key]: rot ? t.dataUrl : t.dataUrl }))
        } catch {
          // ignore thumbnail failures
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showThumbs, slots, slots0, origRots, bytes, thumbs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- history helpers -----------------------------------------------------
  const push = useCallback((item: History) => setHistory((h) => [...h, item]), [])

  const commitOp = useCallback(
    (op: OverlayOp) => {
      if (!curSlot) return
      const id = uid()
      push({ kind: 'op', id, slotId: curSlot.id, op })
      setSelected(id)
    },
    [curSlot, push],
  )

  const undo = useCallback(() => {
    setHistory((h) => h.slice(0, -1))
    setSelected(null)
  }, [])

  const trashSelected = useCallback(() => {
    if (!selected) return
    push({ kind: 'remove', id: selected })
    setSelected(null)
  }, [selected, push])

  const rotatePage = useCallback(
    (delta: 90 | -90) => {
      if (!curSlot) return
      push({ kind: 'rotate', slotId: curSlot.id, delta })
    },
    [curSlot, push],
  )

  const insertPageHere = useCallback(() => {
    if (!curSlot) return
    const w0 = curSlot.src != null ? origRots[curSlot.src] === undefined ? 595.28 : (curSlot.w0 ?? 595.28) : curSlot.w0 ?? 595.28
    push({ kind: 'insert', slotId: uid(), afterSlotId: curSlot.id, w0, h0: curSlot.h0 ?? 841.89 })
    setPageNumber((p) => p + 1)
    setSelected(null)
  }, [curSlot, origRots, push])

  // ---- keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected) {
          e.preventDefault()
          trashSelected()
        }
      } else if (e.key === 'Escape') {
        setSelected(null)
        setPending(null)
        setDraft(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, trashSelected, selected])

  // ---- pointer plumbing ----------------------------------------------------
  const ptOf = (e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }
  }

  const commitDraft = () => {
    if (draft && draft.value.trim() && curSlot) {
      commitOp({
        kind: 'text',
        x: draft.x,
        y: draft.y,
        text: draft.value.replace(/\s+/g, ' ').trim(),
        fontSize,
        color: inkColor,
        rotate: curRot(),
      })
    }
    setDraft(null)
  }

  const placeClickTool = (p: { x: number; y: number }) => {
    const rot = curRot()
    if (tool === 'text') {
      setDraft({ x: p.x, y: p.y, value: '' })
    } else if (tool === 'form-text') {
      seq.current += 1
      commitOp({ kind: 'form-text', x: p.x, y: p.y, width: 160, height: 24, name: `text_${seq.current}`, rotate: rot })
    } else if (tool === 'form-check') {
      seq.current += 1
      commitOp({ kind: 'form-check', x: p.x, y: p.y, size: 18, name: `check_${seq.current}`, rotate: rot })
    } else if ((tool === 'image' || tool === 'sign') && pending) {
      commitOp({ kind: 'image', x: p.x, y: p.y, width: 140, imageDataId: pending.imageDataId, rotate: rot })
      setPending(null)
      setTool('select')
    }
  }

  const finalizeDrag = () => {
    const d = dragRef.current
    dragRef.current = null
    setDragPreview(null)
    setLinePreview(null)
    if (!d || !curSlot) return
    const dx = d.x1 - d.x0
    const dy = d.y1 - d.y0
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
    const rot = curRot()
    const rect = { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), width: Math.abs(dx), height: Math.abs(dy) }
    if (tool === 'whiteout') {
      commitOp({ kind: 'rect', ...rect, color: '#ffffff', opacity: 1, rotate: rot })
    } else if (tool === 'highlight') {
      commitOp({ kind: 'rect', ...rect, color: '#fde047', opacity: 0.45, rotate: rot })
    } else if (tool === 'rect') {
      commitOp({ kind: 'rect', ...rect, color: inkColor, opacity: 1, rotate: rot })
    } else if (tool === 'ellipse') {
      commitOp({ kind: 'ellipse', ...rect, color: inkColor, filled: false, rotate: rot })
    } else if (tool === 'line') {
      commitOp({ kind: 'line', x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1, color: inkColor, thickness: 2, rotate: rot })
    } else if (tool === 'underline' || tool === 'strikeout') {
      commitOp({
        kind: 'line',
        x1: Math.min(d.x0, d.x1),
        y1: d.y1,
        x2: Math.max(d.x0, d.x1),
        y2: d.y1,
        color: inkColor,
        thickness: 1.5,
        rotate: rot,
      })
    } else if (tool === 'link') {
      setLinkUrl('https://')
      setLinkDraft(rect)
    }
  }

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !curSlot) return
    const p = ptOf(e)
    if (DRAG_TOOLS.has(tool)) {
      dragRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragPreview({ x: p.x, y: p.y, width: 0, height: 0 })
      setLinePreview({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
    } else {
      downPtRef.current = p
      if (draft) commitDraft()
      setSelected(null)
    }
  }

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const p = ptOf(e)
      dragRef.current.x1 = p.x
      dragRef.current.y1 = p.y
      const d = dragRef.current
      setDragPreview({
        x: Math.min(d.x0, d.x1),
        y: Math.min(d.y0, d.y1),
        width: Math.abs(d.x1 - d.x0),
        height: Math.abs(d.y1 - d.y0),
      })
      setLinePreview({ x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1 })
    } else if (moveRef.current) {
      const m = moveRef.current
      const dx = (e.clientX - m.startX) / zoom
      const dy = (e.clientY - m.startY) / zoom
      if (Math.abs(e.clientX - m.startX) > 2 || Math.abs(e.clientY - m.startY) > 2) m.moved = true
      m.dx = dx
      m.dy = dy
      setMoveLive({ id: m.id, dx, dy })
    }
  }

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      finalizeDrag()
      return
    }
    if (moveRef.current) {
      const m = moveRef.current
      moveRef.current = null
      setMoveLive(null)
      if (m.moved && (Math.abs(m.dx) > 0.01 || Math.abs(m.dy) > 0.01)) {
        push({ kind: 'move', id: m.id, dx: m.dx, dy: m.dy })
      }
      return
    }
    const p = ptOf(e)
    const start = downPtRef.current
    downPtRef.current = null
    // treat as a click only when the pointer barely moved
    if (start && (Math.abs(p.x - start.x) > 2 || Math.abs(p.y - start.y) > 2)) return
    if (!DRAG_TOOLS.has(tool)) placeClickTool(p)
  }

  const startMove = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    moveRef.current = { id, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false }
    setSelected(id)
  }

  // ---- uploads (images & signatures) ---------------------------------------
  const uploadBlob = useCallback(async (blob: Blob, name: string): Promise<string | null> => {
    try {
      const fd = new FormData()
      fd.append('files', new File([blob], name, { type: blob.type || 'image/png' }))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? 'Upload failed')
      const id = json.files[0].id as string
      setPreviewUrls((prev) => ({ ...prev, [id]: URL.createObjectURL(blob) }))
      return id
    } catch {
      return null
    }
  }, [])

  const onPickImage = async (f: File | undefined) => {
    if (!f) return
    const id = await uploadBlob(f, f.name)
    if (id) {
      setPending({ imageDataId: id, url: URL.createObjectURL(f) })
      setTool('image')
    }
  }

  const hint = pending
    ? 'Click on the page to place it (Esc to cancel)'
    : draft
      ? 'Type, then press Enter'
      : DRAG_TOOLS.has(tool)
        ? tool === 'link'
          ? 'Drag a box, then enter the link URL'
          : 'Drag on the page'
        : tool === 'text'
          ? 'Click where you want to add text'
          : tool === 'form-text' || tool === 'form-check'
            ? 'Click on the page to place the field'
            : 'Choose a tool above, then click or drag on the page'

  const canApply = slots0 != null && history.length > 0 && !busy

  const apply = () => {
    if (!canApply || !slots0) return
    onRun({ ops: resolveOps(history, slots0) })
  }

  const toolBtn = (id: ToolId, label: string, icon: React.ReactNode) => (
    <Button
      type="button"
      size="sm"
      variant={tool === id ? 'default' : 'outline'}
      aria-pressed={tool === id}
      onClick={() => {
        setTool(id)
        setDraft(null)
      }}
      className="gap-1.5"
    >
      {icon}
      {label}
    </Button>
  )

  const iconBtn = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled = false,
    active = false,
  ) => (
    <Button
      type="button"
      size="icon"
      variant={active ? 'default' : 'ghost'}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="size-8"
    >
      {icon}
    </Button>
  )

  const z = zoom
  const dragMoving = DRAG_TOOLS.has(tool)

  const renderOverlay = (p: PlacedOp) => {
    const o = moveLive && moveLive.id === p.id ? translateLive(p.op, moveLive.dx, moveLive.dy) : p.op
    const isSel = selected === p.id
    const sel = isSel ? ' outline outline-2 outline-primary outline-offset-1' : ''
    const common = {
      onPointerDown: (e: React.PointerEvent<Element>) => startMove(e as React.PointerEvent<HTMLDivElement>, p.id),
      className: cn('absolute cursor-move', sel),
      'aria-label': `${o.kind} item`,
    }
    switch (o.kind) {
      case 'text':
        return (
          <div
            key={p.id}
            {...common}
            style={{ left: o.x * z, top: o.y * z, fontSize: o.fontSize * z, color: o.color, lineHeight: 1.25 }}
          >
            {o.text}
          </div>
        )
      case 'rect': {
        // Whiteout (solid white rect) is invisible on a white page while
        // editing — show the editing treatment (hatch + dashed border) so
        // users can see, select and move it. Saved output stays solid white.
        const isWhiteout = o.color.toLowerCase() === '#ffffff' && (o.opacity ?? 1) === 1
        return (
          <div
            key={p.id}
            {...common}
            style={{
              left: o.x * z,
              top: o.y * z,
              width: o.width * z,
              height: o.height * z,
              backgroundColor: isWhiteout ? 'rgba(148,163,184,0.16)' : o.color,
              opacity: o.opacity ?? 1,
              ...(isWhiteout
                ? {
                    border: '1.5px dashed #94a3b8',
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(148,163,184,0.35) 0 5px, transparent 5px 10px)',
                  }
                : null),
            }}
          />
        )
      }
      case 'ellipse':
        return (
          <div
            key={p.id}
            {...common}
            style={{
              left: o.x * z,
              top: o.y * z,
              width: o.width * z,
              height: o.height * z,
              borderRadius: '50%',
              border: o.filled ? undefined : `${Math.max(1, 1.5 * z)}px solid ${o.color}`,
              backgroundColor: o.filled ? o.color : 'transparent',
              opacity: o.opacity ?? 1,
            }}
          />
        )
      case 'line': {
        const left = Math.min(o.x1, o.x2) * z
        const top = Math.min(o.y1, o.y2) * z
        const w = Math.max(1, Math.abs(o.x2 - o.x1) * z)
        const h = Math.max(1, Math.abs(o.y2 - o.y1) * z)
        return (
          <svg key={p.id} {...(common as unknown as React.SVGProps<SVGSVGElement>)} style={{ left, top }} width={w} height={h} aria-hidden="true">
            <line
              x1={o.x1 <= o.x2 ? 0 : w}
              y1={o.y1 <= o.y2 ? 0 : h}
              x2={o.x1 <= o.x2 ? w : 0}
              y2={o.y1 <= o.y2 ? h : 0}
              stroke={o.color}
              strokeWidth={Math.max(1, o.thickness * z)}
            />
          </svg>
        )
      }
      case 'image':
        return (
          <img
            key={p.id}
            {...common}
            src={previewUrls[o.imageDataId] ?? ''}
            alt="Placed image"
            style={{ left: o.x * z, top: o.y * z, width: o.width * z }}
            draggable={false}
          />
        )
      case 'link':
        return (
          <div
            key={p.id}
            {...common}
            style={{ left: o.x * z, top: o.y * z, width: o.width * z, height: o.height * z }}
            className={cn('absolute flex items-center justify-center rounded-sm border border-dashed border-blue-500/70 bg-blue-100/40 text-blue-700', sel)}
          >
            <Link2 className="size-4" aria-hidden="true" />
          </div>
        )
      case 'form-text':
        return (
          <div
            key={p.id}
            {...common}
            style={{ left: o.x * z, top: o.y * z, width: o.width * z, height: o.height * z }}
            className={cn('absolute rounded-sm border-2 border-dashed border-slate-400 bg-white/85 px-1 text-[10px] leading-none text-slate-500', sel)}
          >
            <span className="opacity-70">Text field</span>
          </div>
        )
      case 'form-check':
        return (
          <div
            key={p.id}
            {...common}
            style={{ left: o.x * z, top: o.y * z, width: o.size * z, height: o.size * z }}
            className={cn('absolute rounded-[3px] border-2 border-dashed border-slate-400 bg-white/85', sel)}
          />
        )
    }
  }

  const thumbsList = slots.map((slot, i) => {
    const key = `${slot.id}@${slot.userRot}`
    return (
      <button
        key={slot.id}
        type="button"
        onClick={() => {
          setPageNumber(i + 1)
          setSelected(null)
        }}
        className={cn(
          'group relative overflow-hidden rounded-md border-2 bg-white shadow-sm transition-colors',
          i + 1 === pageSafe ? 'border-primary' : 'border-transparent hover:border-muted-foreground/40',
        )}
        aria-label={`Go to page ${i + 1}`}
        aria-current={i + 1 === pageSafe}
      >
        {slot.src == null ? (
          <div className="flex h-24 w-[76px] items-center justify-center text-[10px] text-muted-foreground">Blank</div>
        ) : thumbs[key] ? (
          <img src={thumbs[key]} alt="" className="h-24 w-[76px] object-contain" />
        ) : (
          <div className="flex h-24 w-[76px] items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <span className="absolute bottom-0 right-0 rounded-tl bg-background/90 px-1 text-[10px] tabular-nums">
          {i + 1}
        </span>
      </button>
    )
  })

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          onPickImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {/* ---------- toolbar ---------- */}
      <div className="rounded-xl border bg-card p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Editing tools">
          {toolBtn('text', 'Text', <Type className="size-4" aria-hidden="true" />)}
          {toolBtn('link', 'Links', <Link2 className="size-4" aria-hidden="true" />)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant={tool === 'form-text' || tool === 'form-check' ? 'default' : 'outline'} className="gap-1.5">
                Forms <ChevronDown_h />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setTool('form-text')}>
                <Type className="size-4" aria-hidden="true" /> Text field
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTool('form-check')}>
                <CheckIcon className="size-4" aria-hidden="true" /> Checkbox
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant={tool === 'image' ? 'default' : 'outline'} className="gap-1.5">
                Images <ChevronDown_h />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden="true" /> Upload image…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant={tool === 'sign' ? 'default' : 'outline'} className="gap-1.5">
                Sign <ChevronDown_h />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setSigOpen(true)}>
                <PenLine className="size-4" aria-hidden="true" /> Draw signature…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {toolBtn('whiteout', 'Whiteout', <Square className="size-4 fill-current" aria-hidden="true" />)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant={['highlight', 'underline', 'strikeout'].includes(tool) ? 'default' : 'outline'} className="gap-1.5">
                Annotate <ChevronDown_h />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setTool('highlight')}>
                <Highlighter className="size-4" aria-hidden="true" /> Highlight
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTool('underline')}>
                <UnderlineIcon className="size-4" aria-hidden="true" /> Underline
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTool('strikeout')}>
                <Strikethrough className="size-4" aria-hidden="true" /> Strikeout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant={['rect', 'ellipse', 'line'].includes(tool) ? 'default' : 'outline'} className="gap-1.5">
                Shapes <ChevronDown_h />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setTool('rect')}>
                <Square className="size-4" aria-hidden="true" /> Rectangle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTool('ellipse')}>
                <Circle className="size-4" aria-hidden="true" /> Ellipse
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTool('line')}>
                <Minus className="size-4" aria-hidden="true" /> Line
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          {iconBtn('Undo last change', <Undo2 className="size-4" aria-hidden="true" />, undo, history.length === 0)}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2" role="toolbar" aria-label="Page tools">
          {iconBtn('Delete selected', <Trash2 className="size-4" aria-hidden="true" />, trashSelected, !selected)}
          {iconBtn('Zoom in', <ZoomIn className="size-4" aria-hidden="true" />, () => setZoom((v) => Math.min(3, Math.round(v * 1.25 * 100) / 100)))}
          {iconBtn('Zoom out', <ZoomOut className="size-4" aria-hidden="true" />, () => setZoom((v) => Math.max(0.4, Math.round((v / 1.25) * 100) / 100)))}
          {iconBtn('Rotate page left', <RotateCcw className="size-4" aria-hidden="true" />, () => rotatePage(-90), curSlot?.src == null)}
          {iconBtn('Rotate page right', <RotateCw className="size-4" aria-hidden="true" />, () => rotatePage(90), curSlot?.src == null)}
          {iconBtn('Insert blank page after this one', <FilePlus2 className="size-4" aria-hidden="true" />, insertPageHere)}

          <span className="mx-2 text-sm text-muted-foreground">{hint}</span>

          <div className="ml-auto flex items-center gap-1">
            {iconBtn('Previous page', <ChevronLeft className="size-4" aria-hidden="true" />, () => setPageNumber((p) => Math.max(1, p - 1)), pageSafe <= 1)}
            <span className="min-w-20 text-center text-sm tabular-nums" aria-live="polite">
              {pageSafe} / {slots.length || '…'}
            </span>
            {iconBtn('Next page', <ChevronRight className="size-4" aria-hidden="true" />, () => setPageNumber((p) => Math.min(slots.length, p + 1)), pageSafe >= slots.length)}
            {iconBtn('Toggle page thumbnails', <LayoutGrid className="size-4" aria-hidden="true" />, () => setShowThumbs((v) => !v), false, showThumbs)}
          </div>
        </div>

        {/* ink options — always mounted with reserved height so switching
            tools NEVER shifts the page under the user's cursor (a live jump
            here made whiteout/link drags land off-target) */}
        <div
          className={cn(
            'mt-2 flex min-h-[41px] flex-wrap items-center gap-3 border-t pt-2',
            !(tool === 'text' || tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'underline' || tool === 'strikeout') && 'invisible',
          )}
          aria-hidden={!(tool === 'text' || tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'underline' || tool === 'strikeout')}
        >
            {tool === 'text' ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Size
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                  aria-label="Font size"
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}pt
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color">
              {INK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={inkColor === c}
                  aria-label={`Color ${c}`}
                  onClick={() => setInkColor(c)}
                  className={cn('size-6 rounded-full border-2 transition-transform', inkColor === c ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
        </div>
      </div>

      {/* ---------- canvas + rail ---------- */}
      {loadError ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : (
        <div className="flex gap-3">
          <div className="slim-scroll max-h-[72vh] flex-1 overflow-auto rounded-xl border bg-muted/40 p-4">
            <div className="mx-auto w-fit">
              <div
                className="relative bg-white shadow-lg ring-1 ring-black/5 select-none"
                style={{
                  width: dispW * z || 200,
                  height: dispH * z || 260,
                  cursor: dragMoving ? 'crosshair' : tool === 'select' ? 'default' : 'copy',
                }}
                role="application"
                aria-label={`Page ${pageSafe} canvas`}
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
              >
                {curSlot?.src != null && preview ? (
                  <img
                    src={preview.dataUrl}
                    alt={`Page ${pageSafe}`}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    draggable={false}
                  />
                ) : null}
                {rendering && curSlot?.src != null ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                  </div>
                ) : null}

                {slots
                  ? ops.filter((p) => p.slotId === curSlot?.id).map((p) => renderOverlay(p))
                  : null}

                {/* drag previews */}
                {dragPreview && (tool === 'whiteout' || tool === 'highlight' || tool === 'rect' || tool === 'ellipse' || tool === 'link') ? (
                  <div
                    className="pointer-events-none absolute border border-dashed"
                    style={{
                      left: dragPreview.x * z,
                      top: dragPreview.y * z,
                      width: dragPreview.width * z,
                      height: dragPreview.height * z,
                      borderColor: tool === 'whiteout' ? '#94a3b8' : inkColor,
                      backgroundColor: tool === 'highlight' ? 'rgba(253,224,71,0.35)' : 'rgba(59,130,246,0.12)',
                    }}
                    aria-hidden="true"
                  />
                ) : null}
                {linePreview && (tool === 'line' || tool === 'underline' || tool === 'strikeout') ? (
                  <svg className="pointer-events-none absolute inset-0" width={dispW * z} height={dispH * z} aria-hidden="true">
                    <line x1={linePreview.x1 * z} y1={linePreview.y1 * z} x2={linePreview.x2 * z} y2={linePreview.y2 * z} stroke={inkColor} strokeWidth={Math.max(1, 1.5 * z)} />
                  </svg>
                ) : null}

                {/* inline text editor */}
                {draft ? (
                  <textarea
                    autoFocus
                    value={draft.value}
                    aria-label="Text to place on the page"
                    placeholder="Type text…"
                    rows={1}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        commitDraft()
                      }
                      if (e.key === 'Escape') setDraft(null)
                    }}
                    onBlur={commitDraft}
                    className="absolute min-w-32 resize-none rounded-sm border border-primary bg-white/95 px-1 py-0.5 text-foreground shadow-sm outline-none"
                    style={{ left: draft.x * z, top: draft.y * z, fontSize: fontSize * z, color: inkColor, lineHeight: 1.25 }}
                  />
                ) : null}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Page {pageSafe} of {slots.length || '…'} · {Math.round(zoom * 100)}%
              </p>
            </div>
          </div>

          {showThumbs ? (
            <aside className="slim-scroll max-h-[72vh] w-[104px] shrink-0 overflow-y-auto rounded-xl border bg-card p-2" aria-label="Page thumbnails">
              <div className="flex flex-col gap-2">{thumbsList}</div>
            </aside>
          ) : null}
        </div>
      )}

      {/* ---------- footer ---------- */}
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {history.length === 0 ? 'Edits apply when you save.' : `${history.length} change${history.length === 1 ? '' : 's'} pending.`}
        </p>
        <Button type="button" onClick={apply} disabled={!canApply} className="bg-emerald-600 text-white hover:bg-emerald-700">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckIcon className="size-4" aria-hidden="true" />}
          Apply changes
        </Button>
      </div>

      {/* ---------- dialogs ---------- */}
      <Dialog open={linkDraft != null} onOpenChange={(v) => !v && setLinkDraft(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add link</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            aria-label="Link URL"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && linkDraft) {
                commitOp({ kind: 'link', ...linkDraft, url: linkUrl, rotate: curRot() })
                setLinkDraft(null)
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!linkUrl.trim() || linkUrl === 'https://'}
              onClick={() => {
                if (!linkDraft) return
                commitOp({ kind: 'link', ...linkDraft, url: linkUrl.trim(), rotate: curRot() })
                setLinkDraft(null)
              }}
            >
              Add link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sigOpen} onOpenChange={setSigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Draw your signature</DialogTitle>
          </DialogHeader>
          <SignaturePad
            onReady={async (blob) => {
              setSigOpen(false)
              if (!blob) return
              const id = await uploadBlob(blob, 'signature.png')
              if (id) {
                setPending({ imageDataId: id, url: URL.createObjectURL(blob) })
                setTool('sign')
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Move preview helper: returns a translated copy for rendering.
function translateLive(op: OverlayOp, dx: number, dy: number): OverlayOp {
  if (op.kind === 'line') return { ...op, x1: op.x1 + dx, y1: op.y1 + dy, x2: op.x2 + dx, y2: op.y2 + dy }
  return { ...op, x: op.x + dx, y: op.y + dy }
}

function ChevronDown_h() {
  return (
    <svg className="size-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
