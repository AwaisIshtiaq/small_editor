// In-memory task registry for the async lifecycle:
// POST /api/tasks → { taskId } → poll GET /api/tasks/:id → download files.
// Sidecar persistence not needed: tasks are short-lived (unlike stored files,
// which survive restarts via meta sidecars).

import type { StoredMeta } from './store'
import { randomUUID } from 'crypto'

export type TaskStatus = 'processing' | 'done' | 'failed'

export type TaskRecord = {
  id: string
  type: string
  status: TaskStatus
  progress: number
  createdAt: number
  outputs: StoredMeta[]
  error?: { code: string; message: string }
}

const tasks = new Map<string, TaskRecord>()

// poll entries older than 6h are unreachable anyway (files expired at 2h)
const TASK_TTL_MS = 6 * 60 * 60 * 1000

function gc() {
  const cutoff = Date.now() - TASK_TTL_MS
  for (const [id, t] of tasks) if (t.createdAt < cutoff) tasks.delete(id)
}

export function createTask(type: string): string {
  gc()
  const id = randomUUID()
  tasks.set(id, { id, type, status: 'processing', progress: 0, createdAt: Date.now(), outputs: [] })
  return id
}

export function getTask(id: string): TaskRecord | undefined {
  return tasks.get(id)
}

export function setProgress(id: string, n: number) {
  const t = tasks.get(id)
  if (t) t.progress = Math.max(0, Math.min(100, Math.round(n)))
}

export function completeTask(id: string, outputs: StoredMeta[]) {
  const t = tasks.get(id)
  if (t) {
    t.status = 'done'
    t.progress = 100
    t.outputs = outputs
  }
}

export function failTask(id: string, code: string, message: string) {
  const t = tasks.get(id)
  if (t) {
    t.status = 'failed'
    t.error = { code, message }
  }
}
