// Upload (Sejda DNA step 2): multipart file(s) → TTL store. Page counts are
// parsed ONCE here (worklog lesson: pageCount=0 at validation broke every
// tool with a real document) and live in StoredMeta.pages afterwards.

import { NextRequest } from 'next/server'
import { okJson, errJson, readMultipart } from '@/lib/pdf-tools/http'
import { putFile, getMeta, type StoredMeta } from '@/lib/pdf-tools/store'
import { parsePageCount } from '@/lib/pdf-tools/parse'
import { LIMITS, LIMITS_ENFORCED } from '@/lib/pdf-tools/ratelimit'
import { TaskError } from '@/lib/pdf-tools/errors'

export async function POST(req: NextRequest) {
  try {
    const parts = await readMultipart(req)
    if (parts.length === 0) throw new TaskError('BAD_REQUEST', 'No file uploaded')

    const out: StoredMeta[] = []
    for (const p of parts) {
      if (LIMITS_ENFORCED && p.buf.length > LIMITS.maxFileBytes) {
        throw new TaskError('FILE_TOO_LARGE', `${p.name} exceeds ${LIMITS.maxFileBytes / 1024 / 1024} MB`)
      }
      const pages = p.mime === 'application/pdf' ? parsePageCount(p.buf) : 0
      const meta = await putFile(p.buf, p.name, p.mime, pages)
      out.push(meta)
    }
    return okJson({ files: out.map((m) => ({ id: m.id, name: m.name, size: m.size, pages: m.pages, mime: m.mime })) })
  } catch (e) {
    return errJson(e)
  }
}

// GET /api/upload?id=... — meta lookup used by the workspace to restore state
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const meta = getMeta(id)
  if (!meta) return errJson(new TaskError('NOT_FOUND', 'File not found or expired'))
  return okJson({ file: { id: meta.id, name: meta.name, size: meta.size, pages: meta.pages, mime: meta.mime } })
}
