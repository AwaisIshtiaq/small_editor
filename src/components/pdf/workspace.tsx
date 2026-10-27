'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, Loader2, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ToolDef } from '@/lib/pdf-tools/registry'
import { PARAM_DEFAULTS, ToolOptions, type ParamBag } from './tool-options'
import { PageGrid, type Placement } from './page-grid'

type Phase = 'files' | 'ready' | 'processing' | 'done'
interface UploadedFile {
  file: File
  id?: string
}
interface TaskResult {
  note?: string
  results: { fileId?: string; name: string; size: number; url?: string }[]
}

const GRID_MODE: Partial<Record<ToolDef['slug'], 'select' | 'order' | 'place'>> = {
  'delete-pages': 'select',
  'extract-pages': 'select',
  organize: 'order',
  sign: 'place',
  'pdf-editor': 'place',
  'pdf-forms': 'place',
}

function fmtBytes(n: number): string {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

async function readError(res: Response): Promise<Error> {
  try {
    const j = await res.json()
    return new Error(j.error?.message ?? 'The request failed.')
  } catch {
    return new Error('The request failed.')
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function selToRanges(sel: Set<number>): string {
  const nums = [...sel].sort((a, b) => a - b).map((i) => i + 1)
  const parts: string[] = []
  let start = nums[0]
  let prev = nums[0]
  for (const n of nums.slice(1)) {
    if (n === prev + 1) {
      prev = n
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = prev = n
  }
  if (start !== undefined) parts.push(start === prev ? `${start}` : `${start}-${prev}`)
  return parts.join(',')
}

export function Workspace({ tool, onBack }: { tool: ToolDef; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('files')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [data, setData] = useState<ArrayBuffer | null>(null)
  const [params, setParams] = useState<ParamBag>({ ...(PARAM_DEFAULTS[tool.slug] as ParamBag ?? {}) })
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TaskResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [order, setOrder] = useState<number[]>([])
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [signatureReady, setSignatureReady] = useState(false)
  const [opCount, setOpCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const gridMode = GRID_MODE[tool.slug]
  const busy = phase === 'processing'
  const noFileNeeded = tool.slug === 'html-to-pdf' && params.source !== 'file'

  // html-to-pdf from URL or pasted code needs no file at all
  useEffect(() => {
    if (tool.slug === 'html-to-pdf' && params.source !== 'file' && phase === 'files') setPhase('ready')
    if (tool.slug === 'html-to-pdf' && params.source === 'file' && phase === 'ready' && files.length === 0) setPhase('files')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.slug, params.source])

  useEffect(() => {
    if (phase !== 'ready' || !gridMode || files.length !== 1) return
    let cancelled = false
    files[0].file.arrayBuffer().then((buf) => !cancelled && setData(buf))
    return () => {
      cancelled = true
    }
  }, [phase, gridMode, files])

  function reset() {
    setPhase('files')
    setFiles([])
    setData(null)
    setParams({ ...(PARAM_DEFAULTS[tool.slug] as ParamBag ?? {}) })
    setError(null)
    setResult(null)
    setSelected(new Set())
    setOrder([])
    setPlacement(null)
    setSignatureReady(false)
    setOpCount(0)
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const picked = Array.from(list)
    const total = files.length + picked.length
    if (total > tool.maxFiles) {
      setError(`${tool.name} accepts at most ${tool.maxFiles} file(s).`)
      return
    }
    setError(null)
    const next = [...files, ...picked.map((file) => ({ file }))]
    setFiles(next)
    if (next.length >= tool.minFiles) setPhase('ready')
  }

  function removeFile(i: number) {
    const next = files.filter((_, idx) => idx !== i)
    setFiles(next)
    if (next.length < tool.minFiles) setPhase('files')
  }

  async function uploadImage(blob: Blob | null) {
    if (!blob) return
    const form = new FormData()
    form.append('file', blob, 'image.png')
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    if (!res.ok) {
      setError((await readError(res)).message)
      return
    }
    const j = await res.json()
    if (tool.slug === 'pdf-editor') setParams((p) => ({ ...p, editorImageId: j.fileId }))
    else setParams((p) => ({ ...p, imageDataId: j.fileId }))
    setSignatureReady(true)
  }

  function blockedReason(): string | null {
    if (!noFileNeeded && files.length < tool.minFiles) return `Choose at least ${tool.minFiles} file(s)`
    switch (tool.slug) {
      case 'split':
        return params.mode === 'ranges' && !String(params.ranges ?? '').trim() ? 'Enter page ranges' : null
      case 'delete-pages':
      case 'extract-pages':
        return selected.size > 0 ? null : 'Select at least one page'
      case 'split-text':
        return String(params.startsWith ?? '').trim() ? null : 'Enter the starting text to split on'
      case 'watermark':
        return String(params.text ?? '').trim() || params.imageDataId ? null : 'Enter watermark text or upload an image'
      case 'header-footer':
        return String(params.pattern ?? '').trim() && Array.isArray(params.positions) && params.positions.length > 0 ? null : 'Enter a text pattern and pick at least one position'
      case 'protect':
        return String(params.userPassword ?? '').length > 0 ? null : 'Enter a password'
      case 'sign':
        if (!signatureReady) return 'Draw a signature first'
        return placement ? null : 'Click where the signature goes'
      case 'pdf-editor':
        return opCount > 0 ? null : 'Place at least one element on the page'
      case 'pdf-forms':
        return opCount > 0 ? null : 'Place at least one text field'
      case 'remove-annotations':
        return Array.isArray(params.annotationTypes) && params.annotationTypes.length > 0 ? null : 'Select annotation types'
      case 'edit-bookmarks':
        return Array.isArray(params.entries) && params.entries.length > 0 ? null : 'Add at least one bookmark'
      case 'bates-numbering':
        return String(params.text ?? '').trim() ? null : 'Enter the Bates prefix'
      case 'rename':
        return String(params.renamePattern ?? '').trim() ? null : 'Enter a filename pattern'
      case 'html-to-pdf':
        return params.source === 'url' ? (String(params.url ?? '').trim() ? null : 'Enter the URL') : params.source === 'code' ? (String(params.htmlCode ?? '').trim() ? null : 'Paste some HTML') : null
      case 'workflows':
        return Array.isArray(params.steps) && params.steps.length > 0 ? null : 'Add at least one step'
      default:
        return null
    }
  }

  function handlePlace(pl: Placement) {
    setPlacement(pl)
    if (tool.slug === 'sign') {
      setParams((p) => ({ ...p, pageNumber: pl.pageNumber, x: pl.x, y: pl.y }))
      return
    }
    if (tool.slug === 'pdf-editor') {
      const kind = String(params.editorKind ?? 'text')
      const op =
        kind === 'text'
          ? { kind, page: pl.pageNumber, x: pl.x, y: pl.y, text: String(params.editorText ?? 'Text'), fontSize: Number(params.editorFontSize ?? 14), color: String(params.editorColor ?? '#111111') }
          : kind === 'rect'
            ? { kind, page: pl.pageNumber, x: pl.x, y: Math.max(0, pl.y - Number(params.editorRectHeight ?? 40)), width: Number(params.editorRectWidth ?? 200), height: Number(params.editorRectHeight ?? 40), color: String(params.editorColor ?? '#FFFFFF') }
            : { kind, page: pl.pageNumber, x: pl.x, y: pl.y, width: 150, imageDataId: String(params.editorImageId ?? '') }
      if (kind === 'image' && !params.editorImageId) {
        setError('Upload an image first in the options below.')
        return
      }
      setParams((p) => ({ ...p, ops: [...(Array.isArray(p.ops) ? (p.ops as unknown[]) : []), op] }))
      setOpCount((c) => c + 1)
      return
    }
    if (tool.slug === 'pdf-forms') {
      const namesSoFar = (Array.isArray(params.ops) ? (params.ops as { name?: string }[]) : []).map((o) => o.name).filter(Boolean)
      const wanted = String(params.fieldName ?? '').trim()
      const name = wanted && !namesSoFar.includes(wanted) ? wanted : `${wanted || 'Field'} ${namesSoFar.length + 1}`
      const op = { kind: 'textfield', page: pl.pageNumber, x: pl.x, y: pl.y, width: Number(params.fieldWidth ?? 160), name }
      setParams((p) => ({ ...p, ops: [...(Array.isArray(p.ops) ? (p.ops as unknown[]) : []), op] }))
      setOpCount((c) => c + 1)
    }
  }

  async function process() {
    setError(null)
    setPhase('processing')
    try {
      const ids: string[] = []
      if (!noFileNeeded) {
        for (const f of files) {
          const check = await fetch('/api/upload-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: f.file.name, size: f.file.size, mime: f.file.type, tool: tool.slug }),
          })
          if (!check.ok) throw await readError(check)
          const form = new FormData()
          form.append('file', f.file)
          const up = await fetch('/api/upload', { method: 'POST', body: form })
          if (!up.ok) throw await readError(up)
          const j = await up.json()
          f.id = j.fileId
          ids.push(j.fileId)
        }
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tool.slug, fileIds: ids, params }),
      })
      if (!res.ok) throw await readError(res)
      const task = await res.json()
      setResult({ note: task.note, results: task.results })
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed.')
      setPhase(noFileNeeded || files.length >= tool.minFiles ? 'ready' : 'files')
    }
  }

  const reason = blockedReason()

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
      <button type="button" onClick={onBack} className="mt-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All tools
      </button>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{tool.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>

      {phase === 'files' && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              addFiles(e.dataTransfer.files)
            }}
            className="flex w-full flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            <UploadCloud className="h-10 w-10 text-primary" aria-hidden />
            <span className="font-medium">Click to choose {tool.multiple ? 'files' : 'a file'}, or drop {tool.multiple ? 'them' : 'it'} here</span>
            <span className="text-xs text-muted-foreground">Accepts {tool.accept.replaceAll(',', ', ')}</span>
          </button>
          <input ref={inputRef} type="file" accept={tool.accept} multiple={tool.multiple} className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </div>
      )}

      {phase !== 'files' && files.length > 0 && (
        <ul className="mt-6 space-y-2" aria-label="Chosen files">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md border bg-card p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{f.file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtBytes(f.file.size)}</span>
              {!busy && phase !== 'done' && (
                <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.file.name}`} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {phase === 'ready' && (
        <div className="mt-6 space-y-6">
          {gridMode && data && (
            <PageGrid
              data={data}
              mode={gridMode}
              selected={gridMode === 'select' ? selected : undefined}
              onToggle={(i) =>
                setSelected((s) => {
                  const next = new Set(s)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  setParams((p) => ({ ...p, pages: selToRanges(next) }))
                  return next
                })
              }
              order={order}
              onOrderChange={(next) => {
                setOrder(next)
                setParams((p) => ({ ...p, order: next }))
              }}
              placement={placement}
              onPlace={handlePlace}
            />
          )}
          <ToolOptions tool={tool} params={params} onChange={(patch) => setParams((p) => ({ ...p, ...patch }))} onSignatureBlob={uploadImage} signatureReady={signatureReady} />
          {tool.slug === 'sign' && <p className="text-xs text-muted-foreground">Position: {placement ? `page ${placement.pageNumber}, ${placement.x}, ${placement.y} pt` : 'not set yet'}</p>}
          {(tool.slug === 'pdf-editor' || tool.slug === 'pdf-forms') && (
            <Button type="button" variant="outline" size="sm" onClick={() => { setParams((p) => ({ ...p, ops: [] })); setOpCount(0); setPlacement(null) }}>
              Clear placed elements
            </Button>
          )}
          {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="button" onClick={process} disabled={!!reason} className="min-w-40">
              {reason ? reason : `Process ${noFileNeeded ? 'input' : `${files.length} file${files.length === 1 ? '' : 's'}`}`}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Start over
            </Button>
          </div>
        </div>
      )}

      {phase === 'processing' && (
        <div className="mt-10 flex items-center justify-center gap-3 rounded-lg border bg-card p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Processing…
        </div>
      )}

      {phase === 'done' && result && (
        <div className="mt-6 space-y-4 rounded-lg border bg-card p-6">
          {result.note && <p className="text-sm text-muted-foreground">{result.note}</p>}
          <ul className="space-y-2">
            {result.results.map((r, i) => (
              <li key={i} className="flex items-center gap-3 rounded-md border p-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtBytes(r.size)}</span>
                <Button asChild size="sm">
                  <a href={r.url ?? `/api/files/${r.fileId}`} download={r.name}>
                    <Download className="mr-1 h-4 w-4" /> Download
                  </a>
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Result files are temporary and automatically deleted after 2 hours.</p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={reset}>
              Run again
            </Button>
            <Button type="button" variant="ghost" onClick={onBack}>
              Back to all tools
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
