// Page-range parsing shared by handlers and validation.
// Grammar: "1-3,5,8-" (open-ended), "odd", "even", "all", "2"
// Returns 0-based page indices, deduplicated and sorted ascending.

export function parsePageSelection(sel: string, pageCount: number): number[] {
  const s = (sel ?? '').trim().toLowerCase()
  if (!s || s === 'all') return Array.from({ length: pageCount }, (_, i) => i)
  if (s === 'odd') return Array.from({ length: pageCount }, (_, i) => i).filter((i) => i % 2 === 0)
  if (s === 'even') return Array.from({ length: pageCount }, (_, i) => i).filter((i) => i % 2 === 1)

  const out = new Set<number>()
  for (const part of s.split(',')) {
    const p = part.trim()
    if (!p) continue
    const m = /^(\d+)(?:-(\d+)?)?$/.exec(p)
    if (!m) throw new Error(`Invalid page range: "${p}"`)
    const from = parseInt(m[1], 10)
    const to = m[2] === undefined ? from : m[2] === '' ? pageCount : parseInt(m[2], 10)
    if (from < 1 || from > pageCount) throw new Error(`Page ${from} is outside this document (1-${pageCount})`)
    const hi = Math.min(to, pageCount)
    if (hi < from) throw new Error(`Invalid range "${p}": end before start`)
    for (let i = from; i <= hi; i++) out.add(i - 1)
  }
  return [...out].sort((a, b) => a - b)
}

// Parse the page count out of raw PDF bytes without a full parser:
// count /Type /Page objects (not /Pages) in the file body. Encrypted streams
// can hide objects, but the trailer usually keeps the page tree visible.
export function parsePageCount(bytes: Uint8Array): number {
  const latin = Buffer.from(bytes).toString('latin1')
  // Prefer the most common authoritative marker: /Type /Page (not /Pages)
  const pageObjs = latin.match(/\/Type\s*\/Page[^s]/g)
  if (pageObjs && pageObjs.length > 0) return pageObjs.length
  // Fallback: /Count N inside the page tree root
  const counts = [...latin.matchAll(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/g)]
  if (counts.length > 0) return Math.max(...counts.map((c) => parseInt(c[1], 10)))
  return 0
}
