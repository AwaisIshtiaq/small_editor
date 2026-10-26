// Task errors with Sejda-style error codes. Extracted from tasks.ts to break
// a circular import (handlers throw these; tasks.ts maps them to HTTP).

export class TaskError extends Error {
  code:
    | 'BAD_REQUEST'
    | 'UNSUPPORTED_FILE'
    | 'FILE_TOO_LARGE'
    | 'TOO_MANY_FILES'
    | 'TOO_FEW_FILES'
    | 'INVALID_PARAMS'
    | 'PASSWORD_REQUIRED'
    | 'WRONG_PASSWORD'
    | 'ENCRYPTED'
    | 'RATE_LIMITED'
    | 'NOT_FOUND'
    | 'PROCESSING'
    | 'FAILED'

  constructor(code: TaskError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export function httpStatus(code: TaskError['code']): number {
  switch (code) {
    case 'BAD_REQUEST':
    case 'INVALID_PARAMS':
      return 400
    case 'UNSUPPORTED_FILE':
      return 415
    case 'FILE_TOO_LARGE':
    case 'TOO_MANY_FILES':
    case 'TOO_FEW_FILES':
      return 413
    case 'PASSWORD_REQUIRED':
      return 401
    case 'WRONG_PASSWORD':
      return 403
    case 'ENCRYPTED':
      return 422
    case 'RATE_LIMITED':
      return 429
    case 'NOT_FOUND':
      return 404
    case 'PROCESSING':
      return 202
    case 'FAILED':
      return 500
  }
}
