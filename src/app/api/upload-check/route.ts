// Pre-flight check (Sejda DNA step 1): is this type known and would these
// limits pass? Cheap, side-effect free — the UI calls it before uploading.

import { NextRequest } from 'next/server'
import { okJson, errJson } from '@/lib/pdf-tools/http'
import { getTool } from '@/lib/pdf-tools/registry'
import { LIMITS, LIMITS_ENFORCED } from '@/lib/pdf-tools/ratelimit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const type = String(body.type ?? '')
    const size = Number(body.size ?? 0)
    const pages = Number(body.pages ?? 0)
    const tool = getTool(type)
    if (!tool) return errJson(new Error(`Unknown task type: ${type}`))

    const reasons: string[] = []
    if (LIMITS_ENFORCED) {
      if (size > LIMITS.maxFileBytes) reasons.push(`File exceeds ${LIMITS.maxFileBytes / 1024 / 1024} MB`)
      if (pages > LIMITS.maxPagesPerTask) reasons.push(`Document exceeds ${LIMITS.maxPagesPerTask} pages`)
    }
    return okJson({ ok: reasons.length === 0, reasons, limitsEnforced: LIMITS_ENFORCED })
  } catch (e) {
    return errJson(e)
  }
}
