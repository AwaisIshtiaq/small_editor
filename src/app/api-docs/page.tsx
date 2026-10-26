import type { Metadata } from 'next'
import Link from 'next/link'
import { TOOLS } from '@/lib/pdf-tools/registry'

export const metadata: Metadata = {
  title: 'Developer Docs — Small Editor API',
  description:
    'REST API for all 45 PDF tools: upload-check, upload, tasks, poll, download.',
}

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/upload-check',
    body: `{
  "type": "merge",          // tool slug
  "size": 1048576,          // bytes
  "pages": 12               // optional
}`,
    res: `{
  "ok": true,
  "reasons": []             // rejection reasons when ok=false
}`,
  },
  {
    method: 'POST',
    path: '/api/upload',
    body: `Content-Type: multipart/form-data
files: <one or more binary parts>`,
    res: `{
  "files": [
    { "id": "a1b2c3", "name": "doc.pdf",
      "size": 1048576, "pages": 12,
      "mime": "application/pdf" }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/api/tasks',
    body: `{
  "type": "merge",          // tool slug (one of 45)
  "fileIds": ["a1b2c3"],
  "params": {               // per-tool option shape
    "normalizePageSizes": false,
    "blankPageIfOdd": false
  }
}`,
    res: `{ "taskId": "t-8f4e2d" }`,
  },
  {
    method: 'GET',
    path: '/api/tasks/{taskId}',
    body: null,
    res: `{
  "status": "processing",   // processing | done | failed
  "progress": 0.4,
  "outputs": [              // when done
    { "id": "f9e8d7", "name": "merged.pdf",
      "size": 883211, "pages": 12 }
  ],
  "error": null             // {code,message} when failed
}`,
  },
  {
    method: 'GET',
    path: '/api/files/{fileId}',
    body: null,
    res: `binary bytes
Content-Disposition: attachment; filename="merged.pdf"`,
  },
]

export default function ApiDocsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to all tools
      </Link>

      <h1 className="mt-6 text-4xl font-bold tracking-tight">
        Developer <span className="text-primary">Docs</span>
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
        The web app is powered by a REST API with the same lifecycle Sejda
        uses: <em>check → upload → task → poll → download</em>. All{' '}
        {TOOLS.length} tools are available programmatically. Uploaded files
        and outputs live in temporary storage and are deleted after 2 hours.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Lifecycle</h2>
      <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
        <li>1. Validate size/pages against the tool limits (upload-check)</li>
        <li>2. Upload the files, keep the returned file ids</li>
        <li>3. Create a task with tool type, file ids and params</li>
        <li>4. Poll the task until status is done or failed</li>
        <li>5. Download each output file by id</li>
      </ol>

      <h2 className="mt-10 text-xl font-semibold">Endpoints</h2>
      <div className="mt-4 space-y-5">
        {ENDPOINTS.map((e) => (
          <div key={e.path + e.method} className="rounded-2xl border bg-card p-5">
            <h3 className="font-mono text-sm">
              <span className="mr-2 rounded-md bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                {e.method}
              </span>
              {e.path}
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {e.body ? (
                <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs leading-relaxed">
                  <code>{e.body}</code>
                </pre>
              ) : null}
              <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs leading-relaxed">
                <code>{e.res}</code>
              </pre>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Errors</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Every failure returns a JSON envelope with a proper HTTP status:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary p-3 text-sm">
        <code>{`{ "error": { "code": "TOO_LARGE", "message": "File exceeds 50 MB" } }`}</code>
      </pre>

      <h2 className="mt-10 text-xl font-semibold">Tool slugs</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <Link
            key={t.slug}
            href={`/workspace?tool=${t.slug}`}
            className="rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            {t.slug}
          </Link>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Rate limits</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        With <code>LIMITS_ENFORCED=true</code>: 3 tasks/hour, 50 MB per file,
        200 pages per document. The default development build runs unlimited
        so every tool can be exercised freely.
      </p>
    </main>
  )
}
