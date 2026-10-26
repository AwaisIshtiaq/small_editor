// Task runner: builds a TaskContext, executes the handler from the aggregate
// map, registers outputs. Shared by POST /api/tasks and the workflows handler
// (which chains handlers with synthetic contexts).

import { readFileBuf, putFile, adoptFile, type StoredMeta } from './store'
import { setProgress } from './taskstate'
import { handlers } from './handlers'
import { TaskError } from './errors'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TaskContext, TaskResult } from './types'

export async function buildContext(
  taskId: string,
  files: StoredMeta[],
  params: Record<string, unknown>,
): Promise<TaskContext> {
  let dirPromise: Promise<string> | null = null
  return {
    taskId,
    files,
    params,
    async readBuf(fileId) {
      return readFileBuf(fileId)
    },
    async workdir() {
      if (!dirPromise) dirPromise = mkdtemp(join(tmpdir(), `task-${taskId.slice(0, 8)}-`))
      return dirPromise
    },
    async putOutput(buf, name, mime) {
      return putFile(buf, name, mime)
    },
    async adoptOutput(absPath, name, mime) {
      return adoptFile(absPath, name, mime)
    },
    progress(n) {
      setProgress(taskId, n)
    },
  }
}

export async function runHandler(
  type: string,
  files: StoredMeta[],
  params: Record<string, unknown>,
  ctx: TaskContext,
): Promise<TaskResult> {
  const handler = handlers[type]
  if (!handler) throw new TaskError('BAD_REQUEST', `No handler for ${type}`)
  return handler({ ...ctx, files, params })
}

export { putFile, readFileBuf }
