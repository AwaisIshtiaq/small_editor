'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type OutputItem = {
  id: string
  name: string
  size: number
  mime: string
  pages?: number
}

export function fmtSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DownloadPanel({ outputs }: { outputs: OutputItem[] }) {
  const downloadAll = () => {
    outputs.forEach((o, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = `/api/files/${o.id}`
        a.download = o.name
        document.body.appendChild(a)
        a.click()
        a.remove()
      }, i * 300)
    })
  }

  return (
    <div className="space-y-3">
      <ul className="slim-scroll max-h-96 space-y-2 overflow-y-auto pr-1" aria-label="Result files">
        {outputs.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{o.name}</p>
              <p className="text-xs text-muted-foreground">
                {fmtSize(o.size)}
                {o.pages && o.pages > 0 ? ` · ${o.pages} pages` : ''}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/files/${o.id}`} download>
                <Download className="size-4" aria-hidden="true" />
                Download
              </a>
            </Button>
          </li>
        ))}
      </ul>
      {outputs.length > 1 ? (
        <Button onClick={downloadAll}>
          <Download className="size-4" aria-hidden="true" />
          Download all ({outputs.length})
        </Button>
      ) : null}
    </div>
  )
}
