// Download (Sejda DNA step 5): GET /api/files/:id streams bytes from the TTL
// store with a content-disposition filename.

import { NextRequest } from 'next/server'
import { errJson } from '@/lib/pdf-tools/http'
import { getMeta, readFileBuf } from '@/lib/pdf-tools/store'
import { TaskError } from '@/lib/pdf-tools/errors'

// Content-Disposition hardening: the filename is client-supplied, so strip
// control chars (incl. CR/LF — response header injection), quotes,
// backslashes and HTML/attribute specials; keep an ASCII fallback for the
// legacy filename param and add an RFC 5987 filename* so unicode names
// survive the round-trip.
function downloadName(name: string): { ascii: string; utf8: string } {
  const clean = name.replace(/[\r\n\x00-\x1f\x7f"\\<>;]/g, '').trim().slice(0, 180)
  return { ascii: clean.replace(/[^\x20-\x7e]/g, '_') || 'download', utf8: clean || 'download' }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const meta = getMeta(id)
    const buf = await readFileBuf(id)
    if (!meta || !buf) throw new TaskError('NOT_FOUND', 'File not found or expired')
    const dl = downloadName(meta.name)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': meta.mime,
        'Content-Length': String(buf.length),
        'Content-Disposition': `attachment; filename="${dl.ascii}"; filename*=UTF-8''${encodeURIComponent(dl.utf8)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return errJson(e)
  }
}
