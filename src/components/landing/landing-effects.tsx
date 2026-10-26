'use client'

import { useEffect } from 'react'

// Scroll-reveal observer + frame-driven guide-band backgrounds,
// ported from the reference landing page (paused off-screen, respects
// prefers-reduced-motion).
const FPS = 30

export function LandingEffects() {
  useEffect(() => {
    // --- scroll reveals ---
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.12 },
    )
    document.querySelectorAll('.rv:not(.in)').forEach((el) => io.observe(el))

    // --- animated guide bands ---
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches
    const bands = [...document.querySelectorAll<HTMLElement>('.gi.band')]
    const visible = new Set<HTMLElement>()
    let raf = 0

    const bio = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          const el = e.target as HTMLElement
          if (e.isIntersecting) visible.add(el)
          else visible.delete(el)
        }),
      { rootMargin: '160px' },
    )
    bands.forEach((b) => bio.observe(b))

    const set = (el: HTMLElement, k: string, v: string) => el.style.setProperty(k, v)

    const loop = (now: number) => {
      if (!reduce) {
        visible.forEach((b) => {
          const f = (now / 1000) * FPS
          const p = ((f + bands.indexOf(b) * 23) / 160) * Math.PI * 2
          set(b, '--bh', String(Math.round(Math.sin(p) * 24)))
          set(b, '--ba', (100 + Math.sin(p * 0.7) * 40).toFixed(1) + 'deg')
          const L = b.querySelector<HTMLElement>('.bl')
          const R = b.querySelector<HTMLElement>('.br')
          const m = (a: number) => (24 + (Math.sin(a) + 1) * 20).toFixed(0)
          if (L) {
            set(L, '--dx', (Math.cos(p * 0.8) * 16).toFixed(1) + 'px')
            set(L, '--dy', (Math.sin(p) * 26).toFixed(1) + 'px')
            set(L, '--rt', (Math.sin(p * 0.6) * 9).toFixed(1) + 'deg')
            set(L, '--r', `0 ${m(p)}px ${m(p + 2)}px 0`)
          }
          if (R) {
            set(R, '--dx', (-Math.cos(p * 0.9) * 16).toFixed(1) + 'px')
            set(R, '--dy', (Math.sin(p + 2) * 28).toFixed(1) + 'px')
            set(R, '--rt', (-Math.sin(p * 0.5) * 9).toFixed(1) + 'deg')
            set(R, '--r', `${m(p + 1)}px 0 0 ${m(p + 3)}px`)
          }
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      io.disconnect()
      bio.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
