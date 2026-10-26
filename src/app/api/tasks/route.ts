// POST /api/tasks (Sejda DNA step 3): create task, validate, process async,
// return { taskId }. Client polls GET /api/tasks/:id, then hits /api/files/:id.

import { NextRequest } from 'next/server'
import { okJson, errJson, clientKeyOf } from '@/lib/pdf-tools/http'
import { getMeta, type StoredMeta } from '@/lib/pdf-tools/store'
import { validateParams, validateFiles } from '@/lib/pdf-tools/tasks'
import { checkTaskRate } from '@/lib/pdf-tools/ratelimit'
import { createTask, completeTask, failTask, getTask } from '@/lib/pdf-tools/taskstate'
import { buildContext } from '@/lib/pdf-tools/runner'
import { handlers } from '@/lib/pdf-tools/handlers'
import { TaskError } from '@/lib/pdf-tools/errors'
import { tasklog } from '@/lib/pdf-tools/tasklog'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const type = String(body.type ?? '')
    const fileIds: string[] = Array.isArray(body.fileIds) ? body.fileIds.map(String) : []
    const params = (body.params ?? {}) as Record<string, unknown>

    const rate = checkTaskRate(clientKeyOf(req))
    if (!rate.allowed) throw new TaskError('RATE_LIMITED', `Too many tasks. Retry in ${Math.ceil(rate.retryAfterSec / 60)} min`)

    const files: StoredMeta[] = []
    for (const id of fileIds) {
      const m = getMeta(id)
      if (!m) throw new TaskError('NOT_FOUND', `Uploaded file ${id} not found or expired`)
      files.push(m)
    }

    validateParams(type, params)
    validateFiles(type, files)

    const taskId = createTask(type)
    tasklog.created(taskId, type, files.length)
    const t0 = Date.now()

    // process asynchronously — Sejda's poll model
    void (async () => {
      try {
        const ctx = await buildContext(taskId, files, params)
        const result = await handlers[type]({ ...ctx, params })
        completeTask(taskId, result.outputs)
        tasklog.done(taskId, Date.now() - t0, result.outputs.length)
      } catch (e) {
        const code = e instanceof TaskError ? e.code : 'FAILED'
        const message = e instanceof Error ? e.message : 'Processing failed'
        failTask(taskId, code, message)
        tasklog.failed(taskId, code, message)
      }
    })()

    return okJson({ taskId })
  } catch (e) {
    return errJson(e)
  }
}

// Convenience for scripts: GET /api/tasks?id=... behaves like the poll route
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const t = getTask(id)
  if (!t) return errJson(new TaskError('NOT_FOUND', 'Task not found or expired'))
  return okJson(serializeTask(t))
}

function serializeTask(t: { id: string; type: string; status: string; progress: number; outputs: StoredMeta[]; error?: { code: string; message: string } }) {
  return {
    taskId: t.id,
    type: t.type,
    status: t.status,
    progress: t.progress,
    error: t.error,
    outputs: t.status === 'done' ? t.outputs.map((o) => ({ id: o.id, name: o.name, size: o.size, mime: o.mime, pages: o.pages })) : [],
  }
}
