import { TOOLS } from '@/lib/pdf-tools/registry'
import { LIMITS, LIMITS_ENFORCED } from '@/lib/pdf-tools/ratelimit'
import { TTL_MS } from '@/lib/pdf-tools/store'

export function GET() {
  return Response.json({
    ok: true,
    service: 'small-editor',
    tools: TOOLS.length,
    ttlHours: TTL_MS / 3600000,
    limitsEnforced: LIMITS_ENFORCED,
    limits: { maxFileMb: LIMITS.maxFileBytes / 1024 / 1024, maxPages: LIMITS.maxPagesPerTask },
  })
}
