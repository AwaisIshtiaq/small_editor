// HTTP helpers shared by the API routes: uniform JSON envelopes, error
// mapping, and multipart parsing without a form-data dependency.

import { NextResponse } from 'next/server'
import { TaskError, httpStatus } from './errors'

export function okJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function errJson(e: unknown) {
  if (e instanceof TaskError) {
    return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: httpStatus(e.code) })
  }
  const message = e instanceof Error ? e.message : 'Unexpected error'
  return NextResponse.json({ error: { code: 'FAILED', message } }, { status: 500 })
}

export type UploadedPart = { name: string; mime: string; buf: Buffer }

// Parse multipart/form-data from a Request using the web standard API
// (Next.js runtime supports request.formData()).
export async function readMultipart(req: Request): Promise<UploadedPart[]> {
  const form = await req.formData()
  const parts: UploadedPart[] = []
  for (const [, v] of form.entries()) {
    if (typeof v === 'string') continue
    const f = v as File
    const buf = Buffer.from(await f.arrayBuffer())
    parts.push({ name: f.name || 'file', mime: f.type || 'application/octet-stream', buf })
  }
  return parts
}

export function clientKeyOf(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  return fwd.split(',')[0].trim() || 'local'
}
