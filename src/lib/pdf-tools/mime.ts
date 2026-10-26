// Content-type ↔ extension mapping for uploads, outputs and download names.

const EXT_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
  'image/webp': 'webp',
  'text/html': 'html',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

export function extFor(mime: string): string {
  return EXT_BY_TYPE[mime] ?? 'bin'
}

export function mimeForExt(ext: string): string {
  const e = ext.toLowerCase()
  for (const [mime, x] of Object.entries(EXT_BY_TYPE)) if (x === e) return mime
  return 'application/octet-stream'
}

// Strip the last extension; "scan.final.pdf" → "scan.final"
export function baseName(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

// e.g. "report" + "pdf" → "report.pdf"; when several outputs share a stem they
// get the Sejda-style numbered suffix applied by the handler, not here.
export function withExt(name: string, ext: string): string {
  const b = baseName(name)
  return `${b || 'output'}.${ext}`
}
