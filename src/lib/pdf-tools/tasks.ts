// Task validation: type known, file count/mime per registry, params shaped
// per ToolParams, Sejda-style limits when LIMITS_ENFORCED=true. Handlers get
// validated inputs and can do defense-in-depth checks (page counts etc.).

import { getTool } from './registry'
import { TaskError } from './errors'
import { LIMITS, LIMITS_ENFORCED } from './ratelimit'
import type { StoredMeta } from './store'

type Dict = Record<string, unknown>

function bad(msg: string): never {
  throw new TaskError('INVALID_PARAMS', msg)
}

function isObj(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function req(p: Dict, key: string, type: 'string' | 'number' | 'boolean' | 'array' | 'object'): unknown {
  const v = p[key]
  const ok =
    type === 'string' ? typeof v === 'string' :
    type === 'number' ? typeof v === 'number' && Number.isFinite(v) :
    type === 'boolean' ? typeof v === 'boolean' :
    type === 'array' ? Array.isArray(v) :
    isObj(v)
  if (!ok) bad(`Missing or invalid "${key}" (expected ${type})`)
  return v
}

function opt(p: Dict, key: string, type: 'string' | 'number' | 'boolean'): unknown {
  const v = p[key]
  if (v === undefined) return undefined
  const ok =
    type === 'string' ? typeof v === 'string' :
    type === 'number' ? typeof v === 'number' && Number.isFinite(v) :
    typeof v === 'boolean'
  if (!ok) bad(`Invalid "${key}" (expected ${type})`)
  return v
}

// ---- per-slug param validators (type-level only; semantics live in handlers)
const PARAM_CHECKS: Record<string, (p: Dict) => void> = {
  merge: (p) => { req(p, 'normalizePageSizes', 'boolean'); req(p, 'blankPageIfOdd', 'boolean') },
  split: (p) => {
    const mode = req(p, 'mode', 'string')
    if (mode !== 'ranges' && mode !== 'step') bad('split.mode must be "ranges"|"step"')
    if (mode === 'ranges') req(p, 'ranges', 'string')
    else req(p, 'step', 'number')
  },
  'split-bookmarks': (p) => { req(p, 'level', 'number'); opt(p, 'expression', 'string'); req(p, 'includePageAfter', 'boolean') },
  'split-middle': (p) => {
    req(p, 'ratio', 'number')
    const m = req(p, 'mode', 'string')
    if (m !== 'horizontal' && m !== 'vertical') bad('split-middle.mode must be "horizontal"|"vertical"')
    req(p, 'repagination', 'boolean'); req(p, 'rightToLeft', 'boolean')
  },
  'split-size': (p) => {
    req(p, 'size', 'number')
    const u = req(p, 'sizeUnit', 'string')
    if (u !== 'MB' && u !== 'KB') bad('split-size.sizeUnit must be "MB"|"KB"')
  },
  'split-text': (p) => { req(p, 'areaY', 'number'); req(p, 'areaHeight', 'number'); req(p, 'startsWith', 'string') },
  'extract-pages': (p) => req(p, 'pages', 'string'),
  'delete-pages': (p) => req(p, 'pages', 'string'),
  'alternate-mix': (p) => { req(p, 'step', 'number'); req(p, 'reverse', 'boolean'); req(p, 'repeat', 'boolean') },
  organize: (p) => { const o = req(p, 'order', 'array') as unknown[]; if (!o.every((n) => typeof n === 'number')) bad('organize.order must be numbers') },
  rotate: (p) => {
    const a = req(p, 'angle', 'number')
    if (a !== 90 && a !== 180 && a !== 270) bad('rotate.angle must be 90|180|270')
    opt(p, 'pages', 'string')
  },
  'jpg-to-pdf': (p) => {
    const ps = req(p, 'pageSize', 'string')
    if (!['fit', 'a4', 'letter'].includes(ps as string)) bad('jpg-to-pdf.pageSize must be fit|a4|letter')
    const or = req(p, 'orientation', 'string')
    if (!['auto', 'portrait', 'landscape'].includes(or as string)) bad('jpg-to-pdf.orientation must be auto|portrait|landscape')
    req(p, 'margin', 'number'); req(p, 'mergeOutputs', 'boolean')
  },
  'pdf-to-jpg': (p) => {
    opt(p, 'pages', 'string')
    req(p, 'resolution', 'number')
    const f = req(p, 'imageFormat', 'string')
    if (!['jpg', 'png', 'tiff'].includes(f as string)) bad('pdf-to-jpg.imageFormat must be jpg|png|tiff')
    req(p, 'grayscale', 'boolean')
  },
  'pdf-to-text': () => {},
  'pdf-to-word': () => {},
  'pdf-to-ppt': (p) => req(p, 'resolution', 'number'),
  'pdf-to-excel': (p) => {
    const f = req(p, 'exportFormat', 'string')
    if (f !== 'xlsx' && f !== 'csv') bad('pdf-to-excel.exportFormat must be xlsx|csv')
    req(p, 'singleSheet', 'boolean')
  },
  'word-to-pdf': () => {},
  'html-to-pdf': (p) => {
    const src = req(p, 'source', 'string')
    if (!['url', 'file', 'code'].includes(src as string)) bad('html-to-pdf.source must be url|file|code')
    opt(p, 'url', 'string'); opt(p, 'htmlCode', 'string')
    if (src === 'url' && typeof p.url !== 'string') bad('html-to-pdf.url required for source=url')
    if (src === 'code' && typeof p.htmlCode !== 'string') bad('html-to-pdf.htmlCode required for source=code')
    opt(p, 'pageSize', 'string'); opt(p, 'orientation', 'string')
    opt(p, 'viewportWidth', 'number'); opt(p, 'margin', 'number'); opt(p, 'delay', 'number'); opt(p, 'usePrintMedia', 'boolean')
  },
  sign: (p) => {
    req(p, 'pageNumber', 'number'); req(p, 'x', 'number'); req(p, 'y', 'number'); req(p, 'width', 'number')
    req(p, 'imageDataId', 'string')
  },
  'pdf-editor': (p) => {
    const ops = req(p, 'ops', 'array') as unknown[]
    for (const op of ops) {
      if (!isObj(op)) bad('pdf-editor.ops entries must be objects')
      const k = op.kind
      if (k === 'text') { req(op, 'page', 'number'); req(op, 'x', 'number'); req(op, 'y', 'number'); req(op, 'text', 'string'); req(op, 'fontSize', 'number'); req(op, 'color', 'string') }
      else if (k === 'rect') { req(op, 'page', 'number'); req(op, 'x', 'number'); req(op, 'y', 'number'); req(op, 'width', 'number'); req(op, 'height', 'number'); req(op, 'color', 'string') }
      else if (k === 'ellipse') { req(op, 'page', 'number'); req(op, 'x', 'number'); req(op, 'y', 'number'); req(op, 'width', 'number'); req(op, 'height', 'number'); req(op, 'color', 'string'); req(op, 'filled', 'boolean') }
      else if (k === 'line') { req(op, 'page', 'number'); req(op, 'x1', 'number'); req(op, 'y1', 'number'); req(op, 'x2', 'number'); req(op, 'y2', 'number'); req(op, 'color', 'string'); req(op, 'thickness', 'number') }
      else if (k === 'image') { req(op, 'page', 'number'); req(op, 'x', 'number'); req(op, 'y', 'number'); req(op, 'width', 'number'); req(op, 'imageDataId', 'string') }
      else if (k === 'link') { req(op, 'page', 'number'); req(op, 'x', 'number'); req(op, 'y', 'number'); req(op, 'width', 'number'); req(op, 'height', 'number'); req(op, 'url', 'string') }
      else if (k === 'form-text') { req(op, 'page', 'number'); req(op, 'x', 'number'); req(op, 'y', 'number'); req(op, 'width', 'number'); req(op, 'height', 'number'); req(op, 'name', 'string') }
      else if (k === 'form-check') { req(op, 'page', 'number'); req(op, 'x', 'number'); req(op, 'y', 'number'); req(op, 'size', 'number'); req(op, 'name', 'string') }
      else if (k === 'rotate-page') { req(op, 'page', 'number'); req(op, 'delta', 'number'); if (![90, -90, 180].includes(op.delta as number)) bad('rotate-page.delta must be 90|-90|180') }
      else if (k === 'insert-page') { req(op, 'afterPage', 'number') }
      else bad('pdf-editor.op.kind must be text|rect|ellipse|line|image|link|form-text|form-check|rotate-page|insert-page')
    }
  },
  'pdf-forms': (p) => {
    const ops = req(p, 'ops', 'array') as unknown[]
    for (const op of ops) {
      if (!isObj(op) || op.kind !== 'textfield') bad('pdf-forms.op.kind must be textfield')
      req(op, 'page', 'number'); req(op, 'x', 'number'); req(op, 'y', 'number'); req(op, 'width', 'number'); req(op, 'name', 'string')
    }
  },
  watermark: (p) => {
    const hasImage = typeof p.imageDataId === 'string'
    if (!hasImage) req(p, 'text', 'string')
    req(p, 'fontSize', 'number'); req(p, 'opacity', 'number'); req(p, 'rotation', 'number'); req(p, 'color', 'string')
    const pos = req(p, 'position', 'string')
    if (!['center', 'top', 'bottom', 'tile'].includes(pos as string)) bad('watermark.position must be center|top|bottom|tile')
    req(p, 'scale', 'number')
  },
  'page-numbers': (p) => {
    req(p, 'position', 'string'); req(p, 'startAt', 'number'); req(p, 'pattern', 'string')
    const f = req(p, 'font', 'string')
    if (!['helvetica', 'times', 'courier'].includes(f as string)) bad('font must be helvetica|times|courier')
    req(p, 'fontSize', 'number'); opt(p, 'pages', 'string'); req(p, 'margin', 'number')
  },
  'header-footer': (p) => {
    req(p, 'pattern', 'string')
    const pos = req(p, 'positions', 'array') as unknown[]
    if (!pos.every((s) => typeof s === 'string')) bad('header-footer.positions must be strings')
    const f = req(p, 'font', 'string')
    if (!['helvetica', 'times', 'courier'].includes(f as string)) bad('font must be helvetica|times|courier')
    req(p, 'fontSize', 'number'); req(p, 'color', 'string'); req(p, 'margin', 'number'); opt(p, 'pages', 'string'); req(p, 'startAt', 'number')
  },
  'bates-numbering': (p) => {
    const st = req(p, 'style', 'string')
    if (!['full-bates', 'bates-with-exhibit', 'custom'].includes(st as string)) bad('bates style invalid')
    opt(p, 'text', 'string')
    req(p, 'digits', 'number'); req(p, 'startFrom', 'number'); req(p, 'increment', 'number')
    req(p, 'pageLocation', 'string')
    const f = req(p, 'font', 'string')
    if (!['helvetica', 'times', 'courier'].includes(f as string)) bad('font must be helvetica|times|courier')
    req(p, 'fontSize', 'number'); req(p, 'color', 'string'); req(p, 'margin', 'number')
  },
  crop: (p) => req(p, 'margin', 'number'),
  resize: (p) => { req(p, 'pageSize', 'string'); req(p, 'customWidth', 'number'); req(p, 'customHeight', 'number'); req(p, 'margin', 'number'); const u = req(p, 'unit', 'string'); if (!['pt', 'mm', 'in'].includes(u as string)) bad('resize.unit must be pt|mm|in') },
  flip: (p) => { const m = req(p, 'mode', 'string'); if (m !== 'horizontal' && m !== 'vertical') bad('flip.mode must be horizontal|vertical') },
  'n-up': (p) => { req(p, 'n', 'number'); const o = req(p, 'pageOrdering', 'string'); if (o !== 'horizontal' && o !== 'vertical') bad('n-up.pageOrdering must be horizontal|vertical'); req(p, 'preservePageSize', 'boolean') },
  'extract-images': () => {},
  'edit-metadata': (p) => { opt(p, 'title', 'string'); opt(p, 'author', 'string'); opt(p, 'subject', 'string'); opt(p, 'keywords', 'string'); req(p, 'removeAll', 'boolean') },
  'edit-bookmarks': (p) => {
    const es = req(p, 'entries', 'array') as unknown[]
    for (const e of es) { if (!isObj(e)) bad('edit-bookmarks.entries must be objects'); req(e, 'title', 'string'); req(e, 'page', 'number'); req(e, 'level', 'number') }
  },
  rename: (p) => { req(p, 'renamePattern', 'string'); req(p, 'areaY', 'number'); req(p, 'areaHeight', 'number') },
  'remove-annotations': (p) => { const t = req(p, 'annotationTypes', 'array') as unknown[]; if (!t.every((s) => typeof s === 'string')) bad('annotationTypes must be strings') },
  flatten: (p) => { const m = req(p, 'mode', 'string'); if (m !== 'forms' && m !== 'rasterize') bad('flatten.mode must be forms|rasterize'); req(p, 'resolution', 'number') },
  protect: (p) => {
    req(p, 'userPassword', 'string'); opt(p, 'ownerPassword', 'string')
    for (const k of ['allowPrinting', 'allowCopying', 'allowModifying', 'allowAnnotating', 'allowFillingForms', 'allowAccessibility', 'allowAssembly']) req(p, k, 'boolean')
  },
  unlock: (p) => opt(p, 'password', 'string'),
  compress: (p) => {
    const q = req(p, 'quality', 'string')
    if (!['extremely', 'recommended', 'good', 'great', 'lossless'].includes(q as string)) bad('compress.quality invalid')
  },
  grayscale: (p) => req(p, 'compressImages', 'boolean'),
  ocr: (p) => { const l = req(p, 'lang', 'string'); if (l !== 'eng') bad('ocr.lang supports "eng" only in this build'); const f = req(p, 'outputFormat', 'string'); if (!['pdf', 'text', 'both'].includes(f as string)) bad('ocr.outputFormat must be pdf|text|both') },
  deskew: (p) => req(p, 'onlyStronglySkewed', 'boolean'),
  repair: () => {},
  workflows: (p) => {
    const steps = req(p, 'steps', 'array') as unknown[]
    for (const s of steps) { if (!isObj(s)) bad('workflows.steps must be objects'); req(s, 'type', 'string'); if (!isObj(s.params)) bad('workflows.step.params must be object') }
  },
}

export function validateParams(type: string, params: unknown): Dict {
  if (!isObj(params)) bad('params must be an object')
  const check = PARAM_CHECKS[type]
  if (!check) bad(`Unknown task type: ${type}`)
  check(params as Dict)
  return params as Dict
}

export function validateFiles(type: string, files: StoredMeta[]): void {
  const tool = getTool(type)
  if (!tool) throw new TaskError('BAD_REQUEST', `Unknown task type: ${type}`)

  if (files.length < tool.minFiles) throw new TaskError('TOO_FEW_FILES', `${tool.name} needs at least ${tool.minFiles} file(s)`)
  if (files.length > tool.maxFiles) throw new TaskError('TOO_MANY_FILES', `${tool.name} accepts at most ${tool.maxFiles} file(s)`)

  // html-to-pdf may run with zero files when source is url/code
  if (files.length === 0 && tool.slug === 'html-to-pdf') return

  const accepts = tool.accept.split(',').map((s) => s.trim()).filter(Boolean)
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const okMime = accepts.includes(f.mime)
    const okExt = accepts.some((a) => a.startsWith('.') && a.slice(1) === ext)
    if (!okMime && !okExt) throw new TaskError('UNSUPPORTED_FILE', `${f.name}: ${f.mime} not accepted here`)
  }

  if (LIMITS_ENFORCED) {
    for (const f of files) {
      if (f.size > LIMITS.maxFileBytes) throw new TaskError('FILE_TOO_LARGE', `${f.name} exceeds ${LIMITS.maxFileBytes / 1024 / 1024} MB`)
    }
    const totalPages = files.reduce((n, f) => n + f.pages, 0)
    if (totalPages > LIMITS.maxPagesPerTask) throw new TaskError('FILE_TOO_LARGE', `Task exceeds ${LIMITS.maxPagesPerTask} pages`)
  }
}
