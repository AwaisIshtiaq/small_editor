// Health: binaries presence + engine reachability (used by Docker healthcheck
// and the desktop shell's readiness probe).

import { okJson } from '@/lib/pdf-tools/http'

export async function GET() {
  return okJson({ ok: true, service: 'small-editor', time: new Date().toISOString() })
}
