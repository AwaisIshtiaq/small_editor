// Editor geometry: conversion between the editor's DISPLAY space (page
// points, top-left origin, including /Rotate) and PDF user space (points,
// bottom-left origin, unrotated). Shared by the client overlays and the
// pdf-editor server handler — pure math, no runtime dependencies.
//
// Display-space point (xd, yd) on a page whose total display rotation is r:
//   r=0:   xu = xd;      yu = H - yd
//   r=90:  xu = yd;      yu = xd        (page turned 90° clockwise)
//   r=180: xu = W - xd;  yu = yd
//   r=270: xu = W - yd;  yu = H - xd
// where (W, H) are the UNROTATED page dimensions. Verified against the
// pdf.js viewport transform (page.getViewport({ rotation })).

export type Rot = 0 | 90 | 180 | 270

export type Pt = { x: number; y: number }

export function normRot(deg: number): Rot {
  return (((Math.round(deg) % 360) + 360) % 360) as Rot
}

// Map one display-space point to PDF user space. H = unrotated page height.
export function mapPoint(xd: number, yd: number, r: Rot, W: number, H: number): Pt {
  switch (r) {
    case 90:
      return { x: yd, y: xd }
    case 180:
      return { x: W - xd, y: yd }
    case 270:
      return { x: W - yd, y: H - xd }
    default:
      return { x: xd, y: H - yd }
  }
}

// Map a display-space rect to user space as an axis-aligned rect.
// Rotating an axis-aligned rect by 90° multiples keeps it axis-aligned.
export function mapRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: Rot,
  W: number,
  H: number,
): { x: number; y: number; width: number; height: number } {
  const a = mapPoint(x, y, r, W, H)
  const b = mapPoint(x + w, y + h, r, W, H)
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

// Display-space text line: (x, y) is the top-left of the line box, glyphs sit
// on a baseline ~0.8em below the top. Returns the pdf-lib drawText anchor
// (baseline start, user space) plus the rotation to pass as `rotate` so the
// text reads upright exactly as it did in the editor.
export function mapTextAnchor(
  x: number,
  y: number,
  fontSize: number,
  r: Rot,
  W: number,
  H: number,
): { x: number; y: number; rotate: number } {
  const baselineY = y + fontSize * 0.8
  const p = mapPoint(x, baselineY, r, W, H)
  // pdf-lib's `rotate` is counterclockwise-positive; display rotation is
  // clockwise, so the draw rotation is the negated display rotation.
  return { x: p.x, y: p.y, rotate: (-r + 360) % 360 }
}

// Map a display-space image for pdf-lib drawImage. pdf-lib anchors an image
// at its own bottom-left corner and rotates around that anchor, so the
// anchor must be the mapped display-space BOTTOM-LEFT corner of the image.
export function mapImageAnchor(
  x: number,
  y: number,
  dispHeight: number,
  r: Rot,
  W: number,
  H: number,
): { x: number; y: number; rotate: number } {
  const p = mapPoint(x, y + dispHeight, r, W, H)
  return { x: p.x, y: p.y, rotate: (-r + 360) % 360 }
}

// Ellipse center + semi-axes in user space for pdf-lib drawEllipse.
export function mapEllipse(
  x: number,
  y: number,
  w: number,
  h: number,
  r: Rot,
  W: number,
  H: number,
): { cx: number; cy: number; xScale: number; yScale: number } {
  const c = mapPoint(x + w / 2, y + h / 2, r, W, H)
  const swap = r === 90 || r === 270
  return {
    cx: c.x,
    cy: c.y,
    xScale: (swap ? h : w) / 2,
    yScale: (swap ? w : h) / 2,
  }
}
