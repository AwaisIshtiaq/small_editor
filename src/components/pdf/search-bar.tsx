'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { TOOLS, type ToolDef } from '@/lib/pdf-tools/registry'
import { ToolIcon } from './tool-icon'

export function SearchBar({ onPick }: { onPick: (slug: ToolDef['slug']) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const matches = query.trim()
    ? TOOLS.filter((t) =>
        `${t.name} ${t.description} ${t.keywords.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : []

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function pick(t: ToolDef) {
    onPick(t.slug)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && matches[active]) {
            pick(matches[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder="Search tools — try “merge” or “sign”"
        aria-label="Search tools"
        className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && query.trim() && (
        <ul className="absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-md" role="listbox">
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No tool matches “{query}”</li>}
          {matches.map((t, i) => (
            <li key={t.slug} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(t)}
                className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm ${i === active ? 'bg-accent' : ''}`}
              >
                <ToolIcon slug={t.slug} className="h-4 w-4 text-primary" />
                <span className="font-medium">{t.name}</span>
                <span className="truncate text-xs text-muted-foreground">{t.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
