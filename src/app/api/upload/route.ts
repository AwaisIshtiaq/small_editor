// Upload (Sejda DNA step 2): POST /api/upload accepts multipart/form-data
// with one or more `files` parts, stores each in the TTL store and returns
// the metadata the workspace UI needs to start a task. Page counts stay 0
// here — the task runner counts pages server-side once the task begins.
// NOTE: keep this file checked in — sandbox auto-commits have wiped it once
// already and every client (workspace, editor, canvas) POSTs here.

import type { NextRequest } from 'next/server'
import { okJson, errJson, readMultipart } from '@/lib/pdf-tools/http'
import { putFile, type StoredMeta } from '@/lib/pdf-tools/store'
import { TaskError } from '@/lib/pdf-tools/errors'
import { LIMITS, LIMITS_ENFORCED } from '@/lib/pdf-tools/ratelimit'

// mirrors the widest tool input in the registry (jpg-to-pdf: maxFiles 50)
const MAX_FILES_PER_UPLOAD = 50

export async function POST(req: NextRequest) {
  try {
    const ctype = req.headers.get('content-type') ?? ''
    if (!ctype.startsWith('multipart/form-data')) {
      throw new TaskError('BAD_REQUEST', 'Send multipart/form-data with one or more `files` parts')
    }
    const parts = await readMultipart(req)
    if (parts.length === 0) {
      throw new TaskError('BAD_REQUEST', 'No file received — attach one or more files')
    }
    if (parts.length > MAX_FILES_PER_UPLOAD) {
      throw new TaskError('TOO_MANY_FILES', `At most ${MAX_FILES_PER_UPLOAD} files per upload`)
    }

    const files: StoredMeta[] = []
    for (const p of parts) {
      if (p.buf.length === 0) {
        throw new TaskError('BAD_REQUEST', `"${p.name}" is empty`)
      }
      if (LIMITS_ENFORCED && p.buf.length > LIMITS.maxFileBytes) {
        throw new TaskError('FILE_TOO_LARGE', `"${p.name}" exceeds ${Math.round(LIMITS.maxFileBytes / 1024 / 1024)} MB`)
      }
      files.push(await putFile(p.buf, p.name, p.mime))
    }

    return okJson({
      files: files.map((f) => ({ id: f.id, name: f.name, size: f.size, pages: f.pages, mime: f.mime })),
    })
  } catch (e) {
    return errJson(e)
  }
}
