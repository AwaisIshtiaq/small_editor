// Handler contract. A task handler receives validated inputs and produces
// one or more outputs (registered in the TTL store). Handlers are pure with
// respect to HTTP: no Request/Response here, only the context below.

import type { StoredMeta } from './store'

export type TaskResult = { outputs: StoredMeta[] }

export interface TaskContext {
  /** the task id (for logging/temp dirs) */
  taskId: string
  /** validated input file metas, in upload order */
  files: StoredMeta[]
  /** read an input file (or sidecar like a signature image) by store id */
  readBuf(fileId: string): Promise<Buffer | null>
  /** validated params object (shape per registry ToolParams) */
  params: Record<string, unknown>
  /** per-task temp dir on disk — safe for subprocess outputs; cleaned up by TTL */
  workdir(): Promise<string>
  /** register an in-memory output */
  putOutput(buf: Buffer, name: string, mime: string): Promise<StoredMeta>
  /** register an on-disk output produced inside workdir() */
  adoptOutput(absPath: string, name: string, mime: string): Promise<StoredMeta>
  /** report progress 0..100 (coarse is fine) */
  progress(n: number): void
}

export type TaskHandler = (ctx: TaskContext) => Promise<TaskResult>
