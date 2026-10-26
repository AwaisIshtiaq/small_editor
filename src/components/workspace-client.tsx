'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  RotateCcw,
  UploadCloud,
  X,
} from 'lucide-react'
import { zipSync } from 'fflate'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ToolIcon } from '@/components/tool-icon'
import { ToolOptions } from '@/components/tool-options'
import { PageGrid } from '@/components/page-grid'
import { EditorCanvas } from '@/components/editor-canvas'
import { WorkflowBuilder } from '@/components/workflow-builder'
import { DownloadPanel, fmtSize, type OutputItem } from '@/components/download-panel'
import { pageCount, renderPageJpeg } from '@/lib/pdfjs-client'
import type { ToolDef } from '@/lib/pdf-tools/registry'

type UploadedFile = { id: string; name: string; size: number; pages: number; mime: string }
type Phase = 'files' | 'options' | 'processing' | 'done' | 'error'

// These tools edit the PDF itself and need the raw bytes in the browser.
const NEEDS_PDF_BYTES = new Set(['sign', 'pdf-editor', 'pdf-forms', 'organize'])

async function apiError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    if (j?.error?.message) return String(j.error.message)
  } catch {
    // not JSON
  }
  return `Request failed (${res.status})`
}

// Expand "all" | "1-3, 5" into 1-based page numbers.
function parseSelection(spec: string, total: number): number[] {
  const s = spec.trim().toLowerCase()
  if (!s || s === 'all') return Array.from({ length: total }, (_, i) => i + 1)
  const out: number[] = []
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) continue
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++) {
      if (p >= 1 && p <= total) out.push(p)
    }
  }
  return [...new Set(out)].sort((x, y) => x - y)
}

export function WorkspaceClient({ tool }: { tool: ToolDef }) {
  const [phase, setPhase] = useState<Phase>('files')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [failCode, setFailCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [outputs, setOutputs] = useState<OutputItem[]>([])
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [order, setOrder] = useState<number[] | null>(null)
  const [direct, setDirect] = useState<{ name: string; url: string; size: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = async (list: File[]) => {
    setError(null)
    const room = tool.maxFiles - files.length
    if (list.length === 0) return
    if (room <= 0) {
      setError(`${tool.name} accepts at most ${tool.maxFiles} file(s).`)
      return
    }
    const picked = list.slice(0, room)
    const totalSize = picked.reduce((n, f) => n + f.size, 0) + files.reduce((n, f) => n + f.size, 0)
    setBusy(true)
    try {
      const check = await fetch('/api/upload-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tool.slug, size: totalSize, pages: 0 }),
      })
      if (!check.ok) throw new Error(await apiError(check))
      const verdict = (await check.json()) as { ok: boolean; reasons?: string[] }
      if (!verdict.ok) throw new Error((verdict.reasons ?? ['File not accepted.']).join(' '))

      const fd = new FormData()
      for (const f of picked) fd.append('files', f)
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!up.ok) throw new Error(await apiError(up))
      const data = (await up.json()) as { files: UploadedFile[] }
      setFiles((prev) => [...prev, ...data.files])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const continueToOptions = async () => {
    setError(null)
    if (NEEDS_PDF_BYTES.has(tool.slug)) {
      setBusy(true)
      try {
        const res = await fetch(`/api/files/${files[0].id}`)
        if (!res.ok) throw new Error(await apiError(res))
        setPdfBytes(new Uint8Array(await res.arrayBuffer()))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the PDF for editing.')
        setBusy(false)
        return
      }
      setBusy(false)
    }
    setPhase('options')
  }

  const startTask = async (params: Record<string, unknown>) => {
    setError(null)
    setFailCode(null)
    setBusy(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tool.slug, fileIds: files.map((f) => f.id), params }),
      })
      if (!res.ok) throw new Error(await apiError(res))
      const data = (await res.json()) as { taskId: string }
      setTaskId(data.taskId)
      setProgress(0)
      setPhase('processing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the task.')
    } finally {
      setBusy(false)
    }
  }

  // Poll task status while processing.
  useEffect(() => {
    if (phase !== 'processing' || !taskId) return
    let stopped = false
    let t: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`)
        if (!res.ok) throw new Error(await apiError(res))
        const data = (await res.json()) as {
          status: 'processing' | 'done' | 'failed'
          progress: number
          outputs?: OutputItem[]
          error?: { code: string; message: string } | null
        }
        if (stopped) return
        setProgress(typeof data.progress === 'number' ? Math.min(100, Math.round(data.progress)) : 0)
        if (data.status === 'done') {
          setOutputs(data.outputs ?? [])
          setPhase('done')
          return
        }
        if (data.status === 'failed') {
          setFailCode(data.error?.code ?? 'FAILED')
          setError(data.error?.message ?? 'Processing failed.')
          setPhase('error')
          return
        }
      } catch {
        // transient network hiccup — keep polling
      }
      if (!stopped) t = setTimeout(tick, 800)
    }
    t = setTimeout(tick, 800)
    return () => {
      stopped = true
      if (t) clearTimeout(t)
    }
  }, [phase, taskId])

  // pdf-to-jpg client flow: render pages in the browser, zip with fflate,
  // download directly — no /api/tasks involved. TIFF falls back to the server.
  const runClientJpg = async (params: Record<string, unknown>) => {
    const p = params as { pages: string; resolution: number; imageFormat: string; grayscale: boolean }
    if (p.imageFormat === 'tiff') {
      await startTask(params)
      return
    }
    setError(null)
    setFailCode(null)
    setProgress(0)
    setPhase('processing')
    try {
      const res = await fetch(`/api/files/${files[0].id}`)
      if (!res.ok) throw new Error(await apiError(res))
      const bytes = new Uint8Array(await res.arrayBuffer())
      const total = await pageCount(bytes)
      const pages = parseSelection(p.pages, total)
      if (pages.length === 0) throw new Error('No pages selected.')
      const ext = p.imageFormat === 'png' ? 'png' : 'jpg'
      const entries: Record<string, Uint8Array> = {}
      for (let i = 0; i < pages.length; i++) {
        const blob = await renderPageJpeg(bytes, pages[i], p.resolution, {
          grayscale: p.grayscale,
          format: ext === 'png' ? 'png' : 'jpg',
        })
        entries[`page-${String(pages[i]).padStart(3, '0')}.${ext}`] = new Uint8Array(await blob.arrayBuffer())
        setProgress(Math.round(((i + 1) / pages.length) * 100))
      }
      const zipped = zipSync(entries)
      const base = files[0].name.replace(/\.pdf$/i, '') || 'pages'
      const name = `${base}-pages.zip`
      const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setDirect({ name, url, size: zipped.length })
      setPhase('done')
    } catch (e) {
      setFailCode('CLIENT_RENDER')
      setError(e instanceof Error ? e.message : 'Rendering failed.')
      setPhase('error')
    }
  }

  const reset = () => {
    if (direct) URL.revokeObjectURL(direct.url)
    setFiles([])
    setOutputs([])
    setTaskId(null)
    setProgress(0)
    setError(null)
    setFailCode(null)
    setPdfBytes(null)
    setOrder(null)
    setDirect(null)
    setPhase('files')
  }

  // ---------------------------------------------------------------- render

  if (phase === 'files') {
    const enough = files.length >= tool.minFiles && files.length <= tool.maxFiles
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <ToolIcon slug={tool.slug} className="mt-0.5 size-8 shrink-0 text-emerald-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{tool.name}</h1>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label={`Upload files for ${tool.name}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void addFiles(Array.from(e.dataTransfer.files))
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            dragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:border-emerald-500/50'
          }`}
        >
          <UploadCloud className="size-10 text-emerald-600" aria-hidden="true" />
          <p className="font-medium">
            Drop {tool.multiple ? 'files' : 'a file'} here or click to browse
          </p>
          <p className="text-sm text-muted-foreground">
            {files.length > 0 ? 'Add more files or continue below · ' : ''}
            Files are deleted automatically after 2 hours.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={tool.accept}
            multiple={tool.multiple}
            className="hidden"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
        </div>

        {error ? (
          <Alert className="border-amber-500/50 text-amber-800 dark:border-amber-500/40 dark:text-amber-300 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Upload problem</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {files.length > 0 ? (
          <ul className="slim-scroll max-h-48 space-y-2 overflow-y-auto pr-1" aria-label="Uploaded files">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtSize(f.size)}
                    {f.pages > 0 ? ` · ${f.pages} pages` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center gap-3">
          <Button onClick={() => void continueToOptions()} disabled={busy || !enough}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Continue
          </Button>
          {!enough ? (
            <p className="text-sm text-muted-foreground">
              {tool.minFiles > 1 ? `Select ${tool.minFiles} or more files to continue.` : 'Select a file to continue.'}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  if (phase === 'options') {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" aria-label="Back to files" onClick={() => setPhase('files')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <ToolIcon slug={tool.slug} className="mt-0.5 size-8 shrink-0 text-emerald-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{tool.name}</h1>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        {tool.slug === 'sign' || tool.slug === 'pdf-editor' || tool.slug === 'pdf-forms' ? (
          pdfBytes ? (
            <EditorCanvas
              slug={tool.slug}
              bytes={pdfBytes}
              running={busy}
              onRun={(params) => void startTask(params)}
            />
          ) : (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          )
        ) : tool.slug === 'organize' ? (
          pdfBytes ? (
            <div className="space-y-4">
              <PageGrid bytes={pdfBytes} mode="order" onChange={setOrder} />
              <Button onClick={() => order && void startTask({ order })} disabled={!order || busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Apply order
              </Button>
            </div>
          ) : (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          )
        ) : tool.slug === 'workflows' ? (
          <WorkflowBuilder running={busy} onRun={(steps) => void startTask({ steps })} />
        ) : (
          <ToolOptions
            slug={tool.slug}
            running={busy}
            onRun={(params) => (tool.slug === 'pdf-to-jpg' ? void runClientJpg(params) : void startTask(params))}
          />
        )}

        {error ? (
          <Alert className="border-amber-500/50 text-amber-800 dark:border-amber-500/40 dark:text-amber-300 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    )
  }

  if (phase === 'processing') {
    return (
      <div className="space-y-6 py-10">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="size-5 animate-spin text-emerald-600" aria-hidden="true" />
          <h1 className="text-lg font-semibold">
            {tool.name} — {progress > 0 ? `processing… ${progress}%` : 'starting…'}
          </h1>
        </div>
        <p className="sr-only" role="status">
          Processing, {progress} percent complete
        </p>
        <Progress value={progress} aria-label="Processing progress" />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <Alert className="border-amber-500/50 text-amber-800 dark:border-amber-500/40 dark:text-amber-300 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>
            {failCode ? `Task failed (${failCode})` : 'Task failed'}
          </AlertTitle>
          <AlertDescription>{error ?? 'Processing failed.'}</AlertDescription>
        </Alert>
        <Button type="button" onClick={() => setPhase('files')}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      </div>
    )
  }

  // done
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-8 text-emerald-600" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Done!</h1>
      </div>

      {direct ? (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{direct.name}</p>
            <p className="text-xs text-muted-foreground">{fmtSize(direct.size)}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={direct.url} download={direct.name}>
              <Download className="size-4" aria-hidden="true" />
              Download
            </a>
          </Button>
        </div>
      ) : (
        <DownloadPanel outputs={outputs} />
      )}

      <Button type="button" variant="outline" onClick={reset}>
        <RotateCcw className="size-4" aria-hidden="true" />
        Process another file
      </Button>
    </div>
  )
}
