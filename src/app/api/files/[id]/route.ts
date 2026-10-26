// Download (Sejda DNA step 5): GET /api/files/:id streams bytes from the TTL
// store with a content-disposition filename.

import { NextRequest } from 'next/server'
import { errJson } from '@/lib/pdf-tools/http'
import { getMeta, readFileBuf } from '@/lib/pdf-tools/store'
import { TaskError } from '@/lib/pdf-tools/errors'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const meta = getMeta(id)
    const buf = await readFileBuf(id)
    if (!meta || !buf) throw new TaskError('NOT_FOUND', 'File not found or expired')
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': meta.mime,
        'Content-Length': String(buf.length),
        'Content-Disposition': `attachment; filename="${meta.name.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return errJson(e)
  }
}
