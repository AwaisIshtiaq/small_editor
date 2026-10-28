// Editor state model: the client records a chronological HISTORY of user
// actions (place / move / delete / insert page / rotate page). Undo pops the
// last entry; rendering derives current state by replaying; saving resolves
// slot references into final page ordinals. This keeps undo trivially
// correct even when insert-page shifts every later page number.

import type { EditorOp } from '@/lib/pdf-tools/registry'
import { mapPoint, type Pt, type Rot } from '@/lib/pdf-tools/editor-geometry'

export type Slot = {
  id: string
  src: number | null // 1-based source page index; null = inserted blank page
  userRot: number // user-applied extra rotation in degrees (multiple of 90)
  w0?: number // unrotated page width (pt) — basis for coordinate transforms
  h0?: number // unrotated page height (pt)
}

// Overlay op in DISPLAY space (top-left origin, page points) + placement
// rotation. `slotId` pins it to a page; `page` is resolved at save time.
export type OverlayOp =
  | { kind: 'text'; x: number; y: number; text: string; fontSize: number; color: string; rotate: Rot }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; color: string; opacity?: number; rotate: Rot }
  | { kind: 'ellipse'; x: number; y: number; width: number; height: number; color: string; opacity?: number; filled: boolean; rotate: Rot }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; thickness: number; rotate: Rot }
  | { kind: 'image'; x: number; y: number; width: number; height?: number; imageDataId: string; rotate: Rot }
  | { kind: 'link'; x: number; y: number; width: number; height: number; url: string; rotate: Rot }
  | { kind: 'form-text'; x: number; y: number; width: number; height: number; name: string; rotate: Rot }
  | { kind: 'form-check'; x: number; y: number; size: number; name: string; rotate: Rot }

export type PlacedOp = { id: string; slotId: string; op: OverlayOp }

export type History =
  | { kind: 'op'; id: string; slotId: string; op: OverlayOp }
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'remove'; id: string }
  | { kind: 'insert'; slotId: string; afterSlotId: string; w0: number; h0: number }
  | { kind: 'rotate'; slotId: string; delta: 90 | -90 | 180 }

export const START = 'START'

export function normRot(deg: number): Rot {
  return (((Math.round(deg) % 360) + 360) % 360) as Rot
}

// Inverse of mapPoint: user space → display space for rotation r.
function invMapPoint(xu: number, yu: number, r: Rot, W: number, H: number): Pt {
  switch (r) {
    case 90:
      return { x: yu, y: xu }
    case 180:
      return { x: W - xu, y: yu }
    case 270:
      return { x: H - yu, y: W - xu }
    default:
      return { x: xu, y: H - yu }
  }
}

// Re-express an overlay op from one display rotation to another (page was
// turned after placement): coords are glued to the page CONTENT, so go
// display(fromRot) → user → display(toRot).
export function transformOpDisplay(op: OverlayOp, fromRot: Rot, toRot: Rot, W: number, H: number): OverlayOp {
  if (fromRot === toRot) return op
  const pts = (xs: number[], ys: number[]): Pt[] => {
    const user = xs.map((x, i) => mapPoint(x, ys[i], fromRot, W, H))
    return user.map((p) => invMapPoint(p.x, p.y, toRot, W, H))
  }
  if (op.kind === 'line') {
    const [a, b] = pts([op.x1, op.x2], [op.y1, op.y2])
    return { ...op, x1: a.x, y1: a.y, x2: b.x, y2: b.y, rotate: toRot }
  }
  if (op.kind === 'text') {
    const [a] = pts([op.x], [op.y])
    return { ...op, x: a.x, y: a.y, rotate: toRot }
  }
  if (op.kind === 'form-check') {
    // square checkbox: width === height === size
    const [tl, br] = pts([op.x, op.x + op.size], [op.y, op.y + op.size])
    return {
      ...op,
      x: Math.min(tl.x, br.x),
      y: Math.min(tl.y, br.y),
      size: Math.abs(br.x - tl.x),
      rotate: toRot,
    }
  }
  // Remaining bbox kinds: rect | ellipse | link | form-text | image.
  // Images may not know their display height (aspect lives in the file) —
  // fall back to a square so the transform still lands on the right anchor.
  const boxH = op.kind === 'image' ? (op.height ?? op.width) : op.height
  const [tl, br] = pts([op.x, op.x + op.width], [op.y, op.y + boxH])
  return {
    ...op,
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    width: Math.abs(br.x - tl.x),
    height: Math.abs(br.y - tl.y),
    rotate: toRot,
  }
}

function translateOp(op: OverlayOp, dx: number, dy: number): void {
  if (op.kind === 'line') {
    op.x1 += dx
    op.y1 += dy
    op.x2 += dx
    op.y2 += dy
  } else {
    op.x += dx
    op.y += dy
  }
}

// Derive the current page model + placed ops from the history.
export function replay(history: History[], initialSlots: Slot[]): { slots: Slot[]; ops: PlacedOp[] } {
  const slots = initialSlots.map((s) => ({ ...s }))
  const ops = new Map<string, PlacedOp>()
  for (const item of history) {
    if (item.kind === 'op') {
      ops.set(item.id, { id: item.id, slotId: item.slotId, op: { ...item.op } })
    } else if (item.kind === 'move') {
      const p = ops.get(item.id)
      if (p) translateOp(p.op, item.dx, item.dy)
    } else if (item.kind === 'remove') {
      ops.delete(item.id)
    } else if (item.kind === 'insert') {
      const at = item.afterSlotId === START ? -1 : slots.findIndex((s) => s.id === item.afterSlotId)
      slots.splice(at + 1, 0, { id: item.slotId, src: null, userRot: 0, w0: item.w0, h0: item.h0 })
    } else if (item.kind === 'rotate') {
      const slot = slots.find((s) => s.id === item.slotId)
      if (slot) {
        const from = normRot(slot.userRot)
        slot.userRot = (((slot.userRot + item.delta) % 360) + 360) % 360
        const to = normRot(slot.userRot)
        const W = slot.w0 ?? 595.28
        const H = slot.h0 ?? 841.89
        for (const p of ops.values()) {
          if (p.slotId === item.slotId) p.op = transformOpDisplay(p.op, from, to, W, H)
        }
      }
    }
  }
  return { slots, ops: [...ops.values()] }
}

// Resolve the history into the final op list sent to /api/tasks. Overlay ops
// get their `page` from the slot's position AT THAT MOMENT in the document,
// so ops recorded after an insert-page land on the right page server-side.
export function resolveOps(history: History[], initialSlots: Slot[]): EditorOp[] {
  const slots = initialSlots.map((s) => ({ ...s }))
  const emitted = new Map<string, EditorOp>()
  const out: EditorOp[] = []
  for (const item of history) {
    if (item.kind === 'insert') {
      const at = item.afterSlotId === START ? -1 : slots.findIndex((s) => s.id === item.afterSlotId)
      slots.splice(at + 1, 0, { id: item.slotId, src: null, userRot: 0, w0: item.w0, h0: item.h0 })
      // MUST reach the server: without it the blank page disappears on save
      // and every op placed on it fails page validation (hard save error).
      out.push({ kind: 'insert-page', afterPage: at + 1 })
    } else if (item.kind === 'rotate') {
      const slot = slots.find((s) => s.id === item.slotId)
      if (slot) slot.userRot = (((slot.userRot + item.delta) % 360) + 360) % 360
      const page = slots.findIndex((s) => s.id === item.slotId) + 1
      out.push({ kind: 'rotate-page', page, delta: item.delta })
    } else if (item.kind === 'op') {
      const page = slots.findIndex((s) => s.id === item.slotId) + 1
      const full = { ...item.op, page } as unknown as EditorOp
      emitted.set(item.id, full)
      out.push(full)
    } else if (item.kind === 'move') {
      const target = emitted.get(item.id)
      if (target) translateOp(target as unknown as OverlayOp, item.dx, item.dy)
    } else if (item.kind === 'remove') {
      const idx = out.indexOf(emitted.get(item.id) as EditorOp)
      if (idx >= 0) out.splice(idx, 1)
      emitted.delete(item.id)
    }
  }
  return out
}
