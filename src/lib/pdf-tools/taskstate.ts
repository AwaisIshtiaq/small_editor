// Task registry for the async lifecycle:
// POST /api/tasks → { taskId } → poll GET /api/tasks/:id → download files.
//
// State lives on disk (sidecar JSON per task) with an in-memory cache:
// dev hot reloads and multi-worker deployments each get their own module
// instance, so memory-only state silently 404s polls. Files themselves stay
// in the TTL store; task records expire after 6h (files expire at 2h).

import type { StoredMeta } from './store'
import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import path from 'path'

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
let rootReady = false

// poll entries older than 6h are unreachable anyway (files expired at 2h)
const TASK_TTL_MS = 6 * 60 * 60 * 1000

function taskDir(): string {
  const dir = path.join(process.env.STORE_DIR || '/tmp/small-editor-store', 'tasks')
  if (!rootReady) {
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      /* exist_ok */
    }
    rootReady = true
  }
  return dir
}

function fileFor(id: string): string {
  return path.join(taskDir(), `${id}.json`)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function persist(t: TaskRecord) {
  try {
    writeFileSync(fileFor(t.id), JSON.stringify(t))
  } catch {
    /* disk hiccups must not kill the task */
  }
}

function loadTask(id: string): TaskRecord | undefined {
  if (!UUID_RE.test(id)) return undefined
  try {
    const t = JSON.parse(readFileSync(fileFor(id), 'utf8')) as TaskRecord
    if (!t || t.id !== id || t.createdAt < Date.now() - TASK_TTL_MS) return undefined
    tasks.set(id, t)
    return t
  } catch {
    return undefined
  }
}

function gc() {
  const cutoff = Date.now() - TASK_TTL_MS
  for (const [id, t] of tasks) {
    if (t.createdAt < cutoff) {
      tasks.delete(id)
      rmSync(fileFor(id), { force: true })
    }
  }
}

export function createTask(type: string): string {
  gc()
  const id = randomUUID()
  const t: TaskRecord = { id, type, status: 'processing', progress: 0, createdAt: Date.now(), outputs: [] }
  tasks.set(id, t)
  persist(t)
  return id
}

export function getTask(id: string): TaskRecord | undefined {
  return tasks.get(id) ?? loadTask(id)
}

export function setProgress(id: string, n: number) {
  const t = tasks.get(id)
  if (t) {
    t.progress = Math.max(0, Math.min(100, Math.round(n)))
    persist(t)
  }
}

export function completeTask(id: string, outputs: StoredMeta[]) {
  const t = tasks.get(id)
  if (t) {
    t.status = 'done'
    t.progress = 100
    t.outputs = outputs
    persist(t)
  }
}

export function failTask(id: string, code: string, message: string) {
  const t = tasks.get(id)
  if (t) {
    t.status = 'failed'
    t.error = { code, message }
    persist(t)
  }
}
