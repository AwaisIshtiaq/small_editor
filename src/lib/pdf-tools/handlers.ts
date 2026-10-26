// Aggregate handler map: slug → TaskHandler. Families are split by
// dependency profile so each module stays focused (worklog structure).

import type { TaskHandler } from './types'
import { coreHandlers } from './handlers-core'
import { convertHandlers } from './handlers-convert'
import { editsecHandlers } from './handlers-editsec'

export const handlers: Record<string, TaskHandler> = {
  ...coreHandlers,
  ...convertHandlers,
  ...editsecHandlers,
}
