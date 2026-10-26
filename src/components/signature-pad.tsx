'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'

const W = 500
const H = 160

/** Canvas signature drawing pad. onReady fires (debounced) after each stroke with a PNG blob, or null after Clear. */
export function SignaturePad({ onReady }: { onReady: (blob: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  })
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const emit = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      canvasRef.current?.toBlob((blob) => onReadyRef.current(blob), 'image/png')
    }, 300)
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    }
  }

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
    }
    setHasInk(false)
    if (timer.current) clearTimeout(timer.current)
    onReadyRef.current(null)
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        aria-label="Signature drawing area. Draw with mouse, pen or finger."
        className="w-full touch-none rounded-md border bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          const ctx = e.currentTarget.getContext('2d')
          if (!ctx) return
          const p = point(e)
          drawing.current = true
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = e.currentTarget.getContext('2d')
          if (!ctx) return
          const p = point(e)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          setHasInk(true)
          emit()
        }}
        onPointerCancel={() => {
          drawing.current = false
        }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Draw your signature above</p>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Eraser className="size-4" aria-hidden="true" />
          Clear
        </Button>
      </div>
      {hasInk ? null : <p className="sr-only">No signature drawn yet</p>}
    </div>
  )
}
