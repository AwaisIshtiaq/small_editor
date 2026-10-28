// Shared link-URI gate. PDF link annotations carry URI actions that viewers
// execute on click — Acrobat runs URI JavaScript, and file:/data: URIs have
// their own abuse paths. Allowing arbitrary schemes would turn any shared
// output PDF into an attack payload, so the scheme is allow-listed (Sejda
// behaves the same). Lives in its own module so both the task validator
// (rejects 400 before a task exists) and the edit handler can use it
// without an import cycle through tasks.ts.

const LINK_SCHEME_RE = /^https?:\/\/|^mailto:/i

export function safeLinkUrl(raw: string): string {
  const u = String(raw ?? '').trim()
  if (!u || u.length > 2048) throw new Error('Link URL must be 1-2048 characters')
  if (!LINK_SCHEME_RE.test(u)) throw new Error('Link URL must start with http://, https:// or mailto:')
  return u
}
