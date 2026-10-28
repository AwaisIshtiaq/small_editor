// Temporary TTL store: uploads + task outputs live on disk under a work dir,
// indexed in memory. Everything expires after ~2h (Sejda's "files deleted
// automatically" promise); a janitor sweeps on an interval. Sidecar meta
// files carry name/mime/pages so a process restart can rebuild the index.

import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'

export const TTL_MS = 2 * 60 * 60 * 1000

function workRoot(): string {
  return process.env.STORE_DIR || '/tmp/small-editor-store'
}

export type StoredMeta = {
  id: string
  name: string
  mime: string
  size: number
  pages: number
  createdAt: number
  expiresAt: number
}

const index = new Map<string, StoredMeta>()
let janitor: NodeJS.Timeout | null = null

function ensureJanitor() {
  if (janitor) return
  janitor = setInterval(() => {
    try {
      sweepExpired()
    } catch {
      /* sweep failure must never take the server down */
    }
  }, 60_000)
  janitor.unref?.()
}

async function sweepExpired() {
  const now = Date.now()
  for (const [id, meta] of index) {
    if (meta.expiresAt <= now) {
      const { rm } = await import('fs/promises')
      await rm(pathFor(id), { force: true }).catch(() => {})
      index.delete(id)
    }
  }
}

function pathFor(id: string): string {
  // ids are uuids produced here — no traversal risk
  return `${workRoot()}/${id}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Rebuild one index entry from its sidecar meta file after a process restart
// or dev-server hot reload (the in-memory Map is per-process). Only
// uuid-shaped ids ever reach the filesystem.
function hydrate(id: string): StoredMeta | undefined {
  if (!UUID_RE.test(id)) return undefined
  try {
    const meta = JSON.parse(readFileSync(`${pathFor(id)}.meta.json`, 'utf8')) as StoredMeta
    if (!meta || meta.id !== id || meta.expiresAt <= Date.now()) return undefined
    index.set(id, meta)
    ensureJanitor()
    return meta
  } catch {
    return undefined
  }
}

async function ensureRoot(): Promise<void> {
  const { mkdir } = await import('fs/promises')
  await mkdir(workRoot(), { recursive: true })
}

export async function putFile(buf: Buffer, name: string, mime: string, pages = 0): Promise<StoredMeta> {
  await ensureRoot()
  const id = randomUUID()
  const now = Date.now()
  const meta: StoredMeta = { id, name, mime, size: buf.length, pages, createdAt: now, expiresAt: now + TTL_MS }
  const { writeFile } = await import('fs/promises')
  await writeFile(pathFor(id), buf)
  await writeFile(`${pathFor(id)}.meta.json`, JSON.stringify(meta))
  index.set(id, meta)
  ensureJanitor()
  return meta
}

export function getMeta(id: string): StoredMeta | undefined {
  return index.get(id) ?? hydrate(id)
}

export async function readFileBuf(id: string): Promise<Buffer | null> {
  const meta = getMeta(id)
  if (!meta || meta.expiresAt <= Date.now()) return null
  const { readFile } = await import('fs/promises')
  try {
    return await readFile(pathFor(id))
  } catch {
    return null
  }
}

// Register an existing on-disk artifact (e.g. produced by a subprocess in the
// work dir) into the store: reads it, indexes it under a fresh id.
export async function adoptFile(absPath: string, name: string, mime: string, pages = 0): Promise<StoredMeta> {
  const { readFile } = await import('fs/promises')
  const buf = await readFile(absPath)
  return putFile(buf, name, mime, pages)
}

export function listExpired(): StoredMeta[] {
  const now = Date.now()
  return [...index.values()].filter((m) => m.expiresAt <= now)
}
