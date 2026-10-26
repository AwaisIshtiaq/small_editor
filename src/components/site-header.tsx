'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { CATEGORY_LABELS, TOOLS } from '@/lib/pdf-tools/registry'
import { Input } from '@/components/ui/input'

export function SiteHeader() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        CATEGORY_LABELS[t.category].toLowerCase().includes(q) ||
        t.keywords.some((k) => k.includes(q)),
    ).slice(0, 8)
  }, [query])

  const go = useCallback(
    (slug: string) => {
      setOpen(false)
      setQuery('')
      router.push(`/workspace?tool=${slug}`)
    },
    [router],
  )

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      const hit = results[active]
      if (open && hit) go(hit.slug)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-lg tracking-tight">Small Editor</span>
        </Link>

        <div className="flex flex-1 justify-center">
          <div ref={boxRef} className="relative w-full max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              placeholder="Search 44 tools…"
              aria-label="Search tools"
              aria-expanded={open && results.length > 0}
              aria-controls="tool-search-results"
              role="combobox"
              className="pl-9"
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
                setOpen(e.target.value.trim().length > 0)
              }}
              onKeyDown={onKeyDown}
              onFocus={() => setOpen(query.trim().length > 0)}
            />
            {open && results.length > 0 ? (
              <ul
                id="tool-search-results"
                role="listbox"
                className="slim-scroll absolute top-full left-0 z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              >
                {results.map((t, i) => (
                  <li key={t.slug} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      className={`w-full rounded-sm px-3 py-2 text-left ${
                        i === active ? 'bg-accent text-accent-foreground' : ''
                      }`}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => {
                        // Navigate before the input's blur closes the dropdown.
                        e.preventDefault()
                        go(t.slug)
                      }}
                    >
                      <span className="block text-sm font-medium">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {CATEGORY_LABELS[t.category]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <Link
          href="/"
          className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          All tools
        </Link>
      </div>
    </header>
  )
}
