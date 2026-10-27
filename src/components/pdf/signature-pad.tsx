'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function SignaturePad({ onChange }: { onChange: (png: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasInk, setHasInk] = useState(false)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width, y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = pos(e)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current!.x, last.current!.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!hasInk) setHasInk(true)
  }

  function end() {
    drawing.current = false
    last.current = null
    if (hasInk) exportPng()
  }

  function exportPng() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((b) => onChange(b), 'image/png')
  }

  function clear() {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={520}
        height={160}
        className="h-32 w-full touch-none rounded-md border border-dashed bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={() => drawing.current && end()}
        aria-label="Signature drawing area"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{hasInk ? 'Signature captured' : 'Draw your signature above'}</p>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
