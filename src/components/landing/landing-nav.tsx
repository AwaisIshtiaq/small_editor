'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CATEGORIES, LANGUAGES, TOOLS_LANDING } from './data'

function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="mgd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ec7f37" />
          <stop offset=".55" stopColor="#FF5A09" />
          <stop offset="1" stopColor="#be4f0c" />
        </linearGradient>
      </defs>
      <use href="#mk" />
    </svg>
  )
}

const QUICK = [
  { label: 'Compress', slug: 'compress' },
  { label: 'Edit', slug: 'pdf-editor' },
  { label: 'Fill & Sign', slug: 'sign', hm: true },
  { label: 'Merge', slug: 'merge' },
  { label: 'Delete Pages', slug: 'delete-pages', hm: true },
  { label: 'Crop', slug: 'crop', hm: true },
]

export function LandingNav() {
  const [mega, setMega] = useState(false)
  const [lang, setLang] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  // Close menus on any outside click (same behaviour as the reference page)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMega(false)
        setLang(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return TOOLS_LANDING.filter(
      (t) =>
        t.n.toLowerCase().includes(q) ||
        t.c.toLowerCase().includes(q) ||
        t.d.toLowerCase().includes(q),
    )
  }, [query])

  const closeAll = () => {
    setMega(false)
    setLang(false)
    setMobile(false)
    setQuery('')
  }

  return (
    <div ref={rootRef}>
      {/* SVG symbol shared by logo instances */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="mgd-nav" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ec7f37" />
            <stop offset=".55" stopColor="#FF5A09" />
            <stop offset="1" stopColor="#be4f0c" />
          </linearGradient>
          <symbol id="mk" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="10" fill="url(#mgd-nav)" />
            <path d="M22 0l10 10V8a8 8 0 00-8-8z" fill="rgba(255,255,255,.25)" />
            <path
              d="M21.6 11.4c-1.2-1.7-3-2.6-5.4-2.6-3 0-5 1.5-5 3.7 0 2.3 1.8 3.1 5 3.9 3.3.8 5.1 1.7 5.1 4 0 2.3-2.2 3.8-5.3 3.8-2.4 0-4.4-.9-5.7-2.6"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </symbol>
        </defs>
      </svg>

      <nav className="se-nav">
        <Link className="logo" href="/#top">
          <svg viewBox="0 0 32 32">
            <use href="#mk" />
          </svg>
          Small Editor
        </Link>

        <button
          className={`at${mega ? ' on' : ''}`}
          aria-label="All tools"
          aria-expanded={mega}
          onClick={(e) => {
            e.stopPropagation()
            setLang(false)
            setMega((v) => !v)
          }}
        >
          All Tools{' '}
          <svg viewBox="0 0 16 16" width="13" height="13">
            <path
              d="M3 6l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {QUICK.map((q) => (
          <Link
            key={q.label}
            className={`lk${q.hm ? ' hm' : ''}`}
            href={`/workspace?tool=${q.slug}`}
            onClick={closeAll}
          >
            {q.label}
          </Link>
        ))}

        <span className="sp" />
        <Link className="lk" href="/pricing" onClick={closeAll}>
          Pricing
        </Link>
        <Link className="lk" href="/desktop" onClick={closeAll}>
          Desktop
        </Link>
        <Link className="lk" href="/#tools" onClick={closeAll}>
          Log in
        </Link>

        <button
          className="gb"
          aria-label="Select language"
          aria-expanded={lang}
          onClick={(e) => {
            e.stopPropagation()
            setMega(false)
            setLang((v) => !v)
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          >
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3 12h18" />
          </svg>
        </button>

        <button
          className={`bm${mobile ? ' x' : ''}`}
          aria-label="Menu"
          onClick={() => {
            setMobile((v) => !v)
            setMega(false)
          }}
        >
          <span />
          <span />
        </button>

        <div className={`lp${lang ? ' on' : ''}`}>
          {LANGUAGES.map((l, i) => (
            <a
              key={l}
              href="#"
              style={i === 0 ? { color: 'var(--tx)' } : undefined}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setLang(false)
              }}
              title={i === 0 ? 'Active' : 'Coming soon'}
            >
              {l}
            </a>
          ))}
        </div>
      </nav>

      {/* All-tools mega menu */}
      <div className={`mega shell${mega ? ' on' : ''}`}>
        <div className="core">
          <div style={{ gridColumn: '1 / -1' }}>
            <input
              className="mg-search"
              placeholder="Search 45 tools…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Search tools"
            />
          </div>
          {filtered ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="mg">
                {filtered.length === 0 && (
                  <a href="#" onClick={(e) => e.preventDefault()} style={{ opacity: 0.6 }}>
                    No tools match “{query}”
                  </a>
                )}
                {filtered.map((t) => (
                  <Link key={t.n} href={`/workspace?tool=${t.slug}`} onClick={closeAll}>
                    {t.n}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            CATEGORIES.map((c) => (
              <div className="mg" key={c}>
                <h6>{c}</h6>
                {TOOLS_LANDING.filter((t) => t.c === c).map((t) => (
                  <Link key={t.n} href={`/workspace?tool=${t.slug}`} onClick={closeAll}>
                    {t.n}
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      <div className={`ov${mobile ? ' on' : ''}`} onClick={closeAll}>
        <Link href="/#tools">All tools</Link>
        <Link href="/workspace?tool=pdf-editor">Edit & Sign</Link>
        <Link href="/workspace?tool=merge">Merge</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/#tools">Log in</Link>
      </div>
    </div>
  )
}
