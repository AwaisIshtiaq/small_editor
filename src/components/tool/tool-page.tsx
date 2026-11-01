'use client'

// Tool page — port of the reference prototype's tools.html view, wired to
// this app's REAL server pipeline (upload-check -> /api/upload -> /api/tasks).
// Flow mirrors the prototype: upload zone -> options -> progress -> result,
// with the how-to guides, offline band and CTA band underneath.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { zipSync } from 'fflate'
import { ToolOptions } from '@/components/tool-options'
import { PageGrid } from '@/components/page-grid'
import { EditorCanvas } from '@/components/editor-canvas'
import { WorkflowBuilder } from '@/components/workflow-builder'
import { DownloadPanel, fmtSize, type OutputItem } from '@/components/download-panel'
import { pageCount, renderPageJpeg } from '@/lib/pdfjs-client'
import type { ToolDef } from '@/lib/pdf-tools/registry'
import { GuideView } from './guide-view'
import type { ToolInfo } from './guide-types'

type UploadedFile = { id: string; name: string; size: number; pages: number; mime: string }
type Phase = 'zone' | 'opt' | 'prog' | 'done'

// These tools edit the PDF itself and need the raw bytes in the browser.
const NEEDS_PDF_BYTES = new Set(['sign', 'pdf-editor', 'pdf-forms', 'organize'])

const BG_LAYERS = [
  { src: '/assets/toolbg-layer0.webp', depth: 10 },
  { src: '/assets/toolbg-layer1.webp', depth: 26 },
  { src: '/assets/toolbg-layer2.webp', depth: 46 },
]

// Upload-button label per accepted input, like the prototype.
function uploadLabel(tool: ToolDef): string {
  const a = `${tool.accept}`
  if (/jpeg|png|image/.test(a)) return 'Upload JPG images'
  if (/docx?/.test(a)) return 'Upload Word files'
  if (/html/.test(a)) return 'Upload HTML files'
  return 'Upload PDF files'
}

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

export function ToolPage({ tool, info }: { tool: ToolDef; info?: ToolInfo }) {
  const [phase, setPhase] = useState<Phase>('zone')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [outputs, setOutputs] = useState<OutputItem[]>([])
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [order, setOrder] = useState<number[] | null>(null)
  const [direct, setDirect] = useState<{ name: string; url: string; size: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [ddm, setDdm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const moreRef = useRef<HTMLInputElement>(null)
  const theroRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((m: string) => {
    setToast(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  // Mouse parallax on the hero layers (same contract as the prototype).
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !theroRef.current) return
    const r = theroRef.current.getBoundingClientRect()
    theroRef.current.style.setProperty('--mx', String(((e.clientX - r.left) / r.width - 0.5) * 2))
    theroRef.current.style.setProperty('--my', String(((e.clientY - r.top) / r.height - 0.5) * 2))
  }
  const onLeave = () => {
    theroRef.current?.style.setProperty('--mx', '0')
    theroRef.current?.style.setProperty('--my', '0')
  }

  const pick = useCallback(
    async (list: File[]) => {
      list = [...list]
      if (!list.length) return
      const room = tool.multiple ? tool.maxFiles - files.length : 1
      if (room <= 0) {
        showToast(`${tool.name} accepts at most ${tool.maxFiles} file(s).`)
        return
      }
      const good = list.slice(0, room)
      const totalSize =
        good.reduce((n, f) => n + f.size, 0) + files.reduce((n, f) => n + f.size, 0)
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
        for (const f of good) fd.append('files', f)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!up.ok) throw new Error(await apiError(up))
        const data = (await up.json()) as { files: UploadedFile[] }

        const merged = tool.multiple
          ? [...files, ...data.files]
          : data.files.slice(0, 1)
        setFiles(merged)
        if (tool.multiple || merged.length >= tool.minFiles) setPhase('opt')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Upload failed.')
      } finally {
        setBusy(false)
      }
    },
    [files, showToast, tool.maxFiles, tool.minFiles, tool.multiple, tool.name, tool.slug],
  )

  // Load raw PDF bytes for the tools that edit in the browser.
  useEffect(() => {
    if (phase !== 'opt' || files.length === 0) return
    if (!NEEDS_PDF_BYTES.has(tool.slug) || pdfBytes) return
    let stopped = false
    void (async () => {
      try {
        const res = await fetch(`/api/files/${files[0].id}`)
        if (!res.ok) throw new Error(await apiError(res))
        const bytes = new Uint8Array(await res.arrayBuffer())
        if (!stopped) setPdfBytes(bytes)
      } catch (e) {
        if (!stopped) {
          showToast(e instanceof Error ? e.message : 'Could not load the PDF for editing.')
          setPhase('zone')
        }
      }
    })()
    return () => {
      stopped = true
    }
  }, [phase, files, pdfBytes, showToast, tool.slug])

  const startTask = useCallback(
    async (params: Record<string, unknown>) => {
      if (files.length < tool.minFiles) {
        showToast(`Add at least ${tool.minFiles} files to continue`)
        return
      }
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
        setPhase('prog')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not start the task.')
      } finally {
        setBusy(false)
      }
    },
    [files, showToast, tool.minFiles, tool.slug],
  )

  // Poll task status while processing.
  useEffect(() => {
    if (phase !== 'prog' || !taskId) return
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
        setProgress(
          typeof data.progress === 'number' ? Math.min(100, Math.round(data.progress)) : 0,
        )
        if (data.status === 'done') {
          setOutputs(data.outputs ?? [])
          setPhase('done')
          return
        }
        if (data.status === 'failed') {
          showToast(data.error?.message ?? 'Couldn’t process this file — it may be damaged or locked.')
          setPhase('opt')
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
  }, [phase, taskId, showToast])

  // pdf-to-jpg client flow: render pages in the browser, zip with fflate.
  const runClientJpg = async (params: Record<string, unknown>) => {
    const p = params as { pages: string; resolution: number; imageFormat: string; grayscale: boolean }
    if (p.imageFormat === 'tiff') {
      await startTask(params)
      return
    }
    setProgress(0)
    setPhase('prog')
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
        entries[`page-${String(pages[i]).padStart(3, '0')}.${ext}`] = new Uint8Array(
          await blob.arrayBuffer(),
        )
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
      showToast(e instanceof Error ? e.message : 'Rendering failed.')
      setPhase('opt')
    }
  }

  const reset = () => {
    if (direct) URL.revokeObjectURL(direct.url)
    setFiles([])
    setOutputs([])
    setTaskId(null)
    setProgress(0)
    setPdfBytes(null)
    setOrder(null)
    setDirect(null)
    setPhase('zone')
  }

  // ------------------------------------------------------------- header
  const title = info?.title ?? tool.name
  const words = title.split(/(PDF)/)
  const pi = words.findIndex((w) => /^PDF$/i.test(w))
  const si = pi >= 0 ? pi : words.length - 1
  const h1 = words.map((w, i) =>
    /^PDF$/i.test(w) || (pi < 0 && i === si) ? (
      <span key={i} className="serif">
        {w}
      </span>
    ) : (
      <span key={i}>{w}</span>
    ),
  )

  const guides = info?.guides ?? []
  const lastCta = guides[guides.length - 1]?.cta || `Ready to use ${tool.name}?`
  const beforeBytes = files.reduce((n, f) => n + f.size, 0)
  const afterBytes = direct
    ? direct.size
    : outputs.reduce((n, o) => n + o.size, 0)
  const savedPct =
    beforeBytes > 0 && afterBytes > 0 && afterBytes < beforeBytes
      ? Math.round((1 - afterBytes / beforeBytes) * 100)
      : 0

  return (
    <>
      {/* ------------------------- hero + upload ------------------------- */}
      <div className="thero" id="thero" ref={theroRef} onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="tbg" aria-hidden="true">
          {BG_LAYERS.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l.src} className="ly" style={{ ['--d' as string]: l.depth }} alt="" src={l.src} />
          ))}
        </div>
        <header className="ch">
          <div className="wrap">
            <h1>
              {h1}
              {info?.badge ? <span className="bdg">{info.badge.toUpperCase()}</span> : null}
            </h1>
            <p>{info?.sub ?? tool.description}</p>
          </div>
        </header>

        <section className={`zone${dragOver ? ' drag' : ''}`} id="zone">
          <div className="wrap">
            {phase === 'zone' ? (
              <div>
                <div className="upw">
                  <div className="upb">
                    <label htmlFor="fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 3h8l5 5v13H6zM14 3v5h5" />
                        <path d="M9 15h6M9 18h4" />
                      </svg>
                      {uploadLabel(tool)}
                    </label>
                    <button
                      className="cv"
                      aria-label="More upload sources"
                      aria-expanded={ddm}
                      onClick={(e) => {
                        e.preventDefault()
                        setDdm((v) => !v)
                      }}
                    >
                      <ChevronDown size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                  {ddm ? (
                    <div className="ddm on">
                      <label htmlFor="fi">From this device</label>
                      <button type="button" onClick={() => showToast('Dropbox import is coming soon')}>
                        Dropbox
                      </button>
                      <button type="button" onClick={() => showToast('Google Drive import is coming soon')}>
                        Google Drive
                      </button>
                      <button type="button" onClick={() => showToast('URL import is coming soon')}>
                        Web address (URL)
                      </button>
                    </div>
                  ) : null}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  id="fi"
                  accept={tool.accept}
                  multiple={tool.multiple}
                  hidden
                  onChange={(e) => {
                    void pick(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />
                <p className="fine">
                  {busy ? 'Uploading… ' : 'Select files to continue — drag & drop works too.'}
                  <br />
                  {info?.free ?? 'Free to use — files are deleted automatically after 2 hours.'}
                  <small>
                    <a href="#" onClick={(e) => e.preventDefault()}>Terms of Use</a> and{' '}
                    <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
                  </small>
                </p>
              </div>
            ) : null}

            {/* ------------------------- options ------------------------- */}
            {phase === 'opt' ? (
              <div className="opt" id="s1">
                {tool.multiple ? (
                  <>
                    <div className="flist">
                      {files.map((f, i) => (
                        <div key={f.id}>
                          <span>{f.name}</span>
                          <small>{fmtSize(f.size)}</small>
                          {files.length > 1 ? (
                            <>
                              <button
                                type="button"
                                aria-label="Move up"
                                onClick={() => {
                                  if (i === 0) return
                                  const next = [...files]
                                  ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                                  setFiles(next)
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                onClick={() => {
                                  if (i === files.length - 1) return
                                  const next = [...files]
                                  ;[next[i + 1], next[i]] = [next[i], next[i + 1]]
                                  setFiles(next)
                                }}
                              >
                                ↓
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Remove ${f.name}`}
                            onClick={() => {
                              const next = files.filter((x) => x.id !== f.id)
                              setFiles(next)
                              if (!next.length) {
                                setPdfBytes(null)
                                setPhase('zone')
                              }
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="sel">
                      <label className="sbtn" htmlFor="fi2" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        + Add more files
                      </label>
                      <input
                        ref={moreRef}
                        type="file"
                        id="fi2"
                        accept={tool.accept}
                        multiple
                        hidden
                        onChange={(e) => {
                          void pick(Array.from(e.target.files ?? []))
                          e.target.value = ''
                        }}
                      />
                    </p>
                  </>
                ) : (
                  <p className="sel">
                    Selected: <b>{files[0]?.name}</b>
                    {files[0] ? ` (${fmtSize(files[0].size)}${files[0].pages ? ` · ${files[0].pages} pages` : ''})` : ''}
                  </p>
                )}

                {tool.slug === 'sign' || tool.slug === 'pdf-editor' || tool.slug === 'pdf-forms' ? (
                  pdfBytes ? (
                    <EditorCanvas
                      slug={tool.slug}
                      bytes={pdfBytes}
                      running={busy}
                      onRun={(params) => void startTask(params)}
                    />
                  ) : (
                    <p className="sel">Loading the document…</p>
                  )
                ) : tool.slug === 'organize' ? (
                  pdfBytes ? (
                    <>
                      <PageGrid bytes={pdfBytes} mode="order" onChange={setOrder} />
                      <div className="acts">
                        <button className="pbtn" disabled={!order || busy} onClick={() => order && void startTask({ order })}>
                          Apply order
                        </button>
                        <button className="sbtn" onClick={reset}>
                          Start over
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="sel">Loading the document…</p>
                  )
                ) : tool.slug === 'workflows' ? (
                  <>
                    <WorkflowBuilder running={busy} onRun={(steps) => void startTask({ steps })} />
                    <div className="acts">
                      <button className="sbtn" onClick={reset}>
                        Start over
                      </button>
                    </div>
                  </>
                ) : (
                  <ToolOptions
                    slug={tool.slug}
                    running={busy}
                    onRun={(params) =>
                      tool.slug === 'pdf-to-jpg' ? void runClientJpg(params) : void startTask(params)
                    }
                  />
                )}

                {tool.slug !== 'workflows' && tool.slug !== 'organize' ? (
                  <div className="acts">
                    <button className="sbtn" onClick={reset}>
                      Start over
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ------------------------ progress ------------------------- */}
            {phase === 'prog' ? (
              <div className="prog" role="status">
                <div className="bar">
                  <i style={{ width: `${Math.max(6, progress)}%` }} />
                </div>
                <p>{progress > 0 ? `Working… ${progress}%` : 'Working…'}</p>
              </div>
            ) : null}

            {/* -------------------------- result ------------------------- */}
            {phase === 'done' ? (
              <div className="done">
                <div className="big">
                  <s>{fmtSize(beforeBytes)}</s>
                  <span>→</span>
                  <em>{fmtSize(afterBytes)}</em>
                </div>
                <div className="sv">{savedPct > 0 ? `Saved ${savedPct}%` : 'Done'}</div>
                {direct ? (
                  <>
                    <p>{direct.name}</p>
                    <div className="acts">
                      <a className="pbtn" href={direct.url} download={direct.name}>
                        Download
                      </a>
                      <button className="sbtn" onClick={reset}>
                        Start over
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <DownloadPanel outputs={outputs} />
                    <p>Processed securely — files are deleted automatically after two hours.</p>
                    <div className="acts">
                      <button className="sbtn" onClick={reset}>
                        Start over
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <div className="off wrap">
          <Link href="/desktop">
            <b>OFFLINE</b>Rather work offline? Try Small Editor Desktop <span>›</span>
          </Link>
        </div>
      </div>

      {/* ---------------------------- guides ----------------------------- */}
      {guides.map((g, i) => (
        <div key={i}>
          {i ? <div className="gsep" /> : null}
          <GuideView guide={g} slug={tool.slug} />
        </div>
      ))}

      {/* ---------------------------- CTA band --------------------------- */}
      <div className="cta2">
        <div className="wrap">
          <h3>{lastCta}</h3>
          <a
            className="upb"
            style={{ display: 'inline-flex' }}
            href="#thero"
            onClick={(e) => {
              e.preventDefault()
              theroRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 26px' }}>
              {tool.name} online <span style={{ fontSize: 28, lineHeight: 1 }}>›</span>
            </span>
          </a>
        </div>
      </div>

      <div className={`toast2${toast ? ' on' : ''}`} role="status">
        {toast}
      </div>
    </>
  )
}
