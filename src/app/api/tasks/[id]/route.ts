// Poll (Sejda DNA step 4): GET /api/tasks/:id → status/progress/outputs

import { NextRequest } from 'next/server'
import { okJson, errJson } from '@/lib/pdf-tools/http'
import { getTask } from '@/lib/pdf-tools/taskstate'
import type { StoredMeta } from '@/lib/pdf-tools/store'
import { TaskError } from '@/lib/pdf-tools/errors'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const t = getTask(id)
    if (!t) throw new TaskError('NOT_FOUND', 'Task not found or expired')
    return okJson({
      taskId: t.id,
      type: t.type,
      status: t.status,
      progress: t.progress,
      error: t.error,
      outputs: t.status === 'done' ? t.outputs.map((o) => ({ id: o.id, name: o.name, size: o.size, mime: o.mime, pages: o.pages })) : [],
    })
  } catch (e) {
    return errJson(e)
  }
}
