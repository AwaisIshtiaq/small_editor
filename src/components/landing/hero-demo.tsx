'use client'

import { useEffect, useRef } from 'react'

// Remotion-style frame engine: 30 fps clock, interpolate(), spring(),
// scenes — ported 1:1 from the reference landing page.
const FPS = 30
const DUR = 270
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)
const interpolate = (
  f: number,
  [a, b]: [number, number],
  [x, y]: [number, number],
  e: (t: number) => number = easeOut,
) => x + (y - x) * e(clamp((f - a) / (b - a), 0, 1))
const spring = (f: number, { damping = 11, stiffness = 140 } = {}) => {
  const t = f / FPS
  const w = Math.sqrt(stiffness)
  const z = damping / (2 * Math.sqrt(stiffness))
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t)
  const wd = w * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t))
}
const seq = (f: number, from: number, len: number) => ({
  f: f - from,
  on: f >= from && f < from + len,
})

const TXT = 'Approved — Q4 contract'

export function HeroDemo() {
  const stageRef = useRef<HTMLDivElement>(null)
  const tbRef = useRef<HTMLDivElement>(null)
  const hlRef = useRef<HTMLDivElement>(null)
  const sgRef = useRef<SVGPathElement>(null)
  const cuRef = useRef<SVGSVGElement>(null)
  const tsRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const tb = tbRef.current
    const hl = hlRef.current
    const sg = sgRef.current
    const cu = cuRef.current
    const ts = tsRef.current
    const tl = [...(tlRef.current?.children ?? [])] as HTMLElement[]
    if (!stage || !tb || !hl || !sg || !cu || !ts) return

    function render(f: number) {
      const active = f < 100 ? 0 : f < 160 ? 1 : f < 230 ? 2 : -1
      tl.forEach((s, i) => s.classList.toggle('on', i === active))

      tb!.style.opacity = String(interpolate(f, [20, 34], [0, 1]))
      tb!.textContent =
        TXT.slice(0, Math.floor(interpolate(f, [34, 92], [0, TXT.length], (t) => t))) || '\u00a0'

      hl!.style.setProperty('--h', String(interpolate(f, [104, 150], [0, 1])))
      sg!.style.strokeDashoffset = String(
        420 - 420 * interpolate(f, [165, 222], [0, 1], (t) => t * t * (3 - 2 * t)),
      )

      const s = seq(f, 225, 45).on ? spring(seq(f, 225, 45).f) : 0
      ts!.style.opacity =
        f >= 228 && f < 262 ? String(clamp(s, 0, 1)) : String(interpolate(f, [262, 270], [1, 0], (t) => t) * (f >= 262 ? 1 : 0))
      ts!.style.transform = `translateY(${(1 - clamp(s, 0, 1.2)) * 18}px) scale(${0.9 + 0.1 * clamp(s, 0, 1.2)})`

      const px =
        f < 34
          ? interpolate(f, [0, 34], [230, 40])
          : f < 100
            ? 40 + (f - 34) * 3.1
            : f < 150
              ? interpolate(f, [100, 150], [60, 250])
              : interpolate(f, [160, 222], [40, 190])
      const py =
        f < 34
          ? interpolate(f, [0, 34], [40, 196])
          : f < 100
            ? 196
            : f < 150
              ? interpolate(f, [100, 150], [196, 230])
              : interpolate(f, [160, 222], [270, 300])
      cu!.style.transform = `translate(${px}px,${py}px) scale(${1 - 0.12 * Math.sin(f / 5) ** 2})`
    }

    let vis = true
    const io = new IntersectionObserver((es) => {
      vis = es[0].isIntersecting
    })
    io.observe(stage)

    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      if (reduce) {
        render(260)
        return
      }
      if (vis) render(Math.floor((now - start) / 1000 * FPS) % DUR)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [])

  return (
    <div className="shell tilt">
      <div className="core" id="stage" ref={stageRef}>
        <div className="bar">
          <i />
          <i />
          <i />
          <div className="tools" ref={tlRef}>
            <span>Text</span>
            <span>Highlight</span>
            <span>Sign</span>
          </div>
        </div>
        <div className="page">
          <h4>Service Agreement</h4>
          <div className="ln" />
          <div className="ln" style={{ width: '82%' }} />
          <div className="tb" ref={tbRef} />
          <div className="hl" ref={hlRef} style={{ marginTop: 62 }}>
            <div className="ln" />
          </div>
          <div className="ln" style={{ width: '64%' }} />
          <svg className="sig" viewBox="0 0 170 64">
            <path
              ref={sgRef}
              d="M4 44C18 8 28 8 26 30S20 56 38 34s14-26 24-8-8 26 8 14 18-24 28-8 14 18 30 4 22-16 40-6"
            />
          </svg>
          <svg className="cur" ref={cuRef} viewBox="0 0 16 16">
            <path d="M2 1l11 5-5 2-2 5z" fill="#393939" stroke="#fff" strokeWidth="1" />
          </svg>
          <div className="toast" ref={tsRef}>
            <em />
            Changes applied
          </div>
        </div>
      </div>
    </div>
  )
}
