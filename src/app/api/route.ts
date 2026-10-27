import { TOOLS } from '@/lib/pdf-tools/registry'
import { LIMITS_ENFORCED } from '@/lib/pdf-tools/ratelimit'
import { TTL_MS } from '@/lib/pdf-tools/store'
import { MAX_FILE_MB, MAX_PAGES } from '@/lib/pdf-tools/tasks'

export function GET() {
  return Response.json({
    ok: true,
    service: 'small-editor',
    tools: TOOLS.length,
    ttlHours: TTL_MS / 3600000,
    limitsEnforced: LIMITS_ENFORCED,
    limits: { maxFileMb: MAX_FILE_MB, maxPages: MAX_PAGES },
  })
}
