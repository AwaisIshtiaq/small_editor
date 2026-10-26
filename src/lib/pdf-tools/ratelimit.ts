// Rate limiting + quota. Sejda enforces: 3 tasks/hour (free web), 50 MB file,
// 200 pages. LIMITS_ENFORCED=false (default in this build) = unlimited mode
// for testing/local; flip the env var to restore Sejda-style limits.

export const LIMITS_ENFORCED = process.env.LIMITS_ENFORCED === 'true'

export const LIMITS = {
  tasksPerHour: 3,
  maxFileBytes: 50 * 1024 * 1024,
  maxPagesPerTask: 200,
}

type Bucket = { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()

function hourWindowStart(now = Date.now()): number {
  return Math.floor(now / 3_600_000) * 3_600_000
}

export function checkTaskRate(clientKey: string): { allowed: boolean; retryAfterSec: number } {
  if (!LIMITS_ENFORCED) return { allowed: true, retryAfterSec: 0 }
  const start = hourWindowStart()
  const b = buckets.get(clientKey)
  if (!b || b.windowStart !== start) {
    buckets.set(clientKey, { count: 1, windowStart: start })
    return { allowed: true, retryAfterSec: 0 }
  }
  if (b.count >= LIMITS.tasksPerHour) {
    return { allowed: false, retryAfterSec: Math.ceil((b.windowStart + 3_600_000 - Date.now()) / 1000) }
  }
  b.count++
  return { allowed: true, retryAfterSec: 0 }
}
