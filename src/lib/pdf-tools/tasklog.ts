// Minimal structured task log — one line per task lifecycle event, tagged,
// so failures are greppable in dev.log without a logging framework.

type Level = 'info' | 'warn' | 'error'

function line(level: Level, event: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, event, ...data }
  const s = JSON.stringify(entry)
  if (level === 'error') console.error(s)
  else if (level === 'warn') console.warn(s)
  else console.log(s)
}

export const tasklog = {
  created: (id: string, type: string, files: number) => line('info', 'task.created', { id, type, files }),
  done: (id: string, ms: number, outputs: number) => line('info', 'task.done', { id, ms, outputs }),
  failed: (id: string, code: string, message: string) => line('error', 'task.failed', { id, code, message }),
  info: (event: string, data?: Record<string, unknown>) => line('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => line('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => line('error', event, data),
}
