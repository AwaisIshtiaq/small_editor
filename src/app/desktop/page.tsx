import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Small Editor for Desktop — works offline',
  description:
    'Same 45 PDF tools as the web app, running 100% offline. Files never leave your computer. Windows, macOS and Linux.',
}

const PLATFORMS = [
  { os: 'Windows', target: 'NSIS installer (.exe)', note: 'Windows 10/11, 64-bit' },
  { os: 'macOS', target: 'Disk image (.dmg)', note: 'macOS 12+, Intel & Apple Silicon' },
  { os: 'Linux', target: 'AppImage & .deb', note: 'glibc-based distributions' },
]

export default function DesktopPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to all tools
      </Link>

      <h1 className="mt-6 text-4xl font-bold tracking-tight">
        Small Editor <span className="text-primary">Desktop</span>
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
        The full 45-tool engine bundled into a native desktop application.
        Everything runs on <strong>127.0.0.1</strong> — your own machine — so
        the app works with <strong>no internet connection</strong> and your
        files never leave your computer.
      </p>

      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li>• Identical tools and options as the online service</li>
        <li>• 100% offline processing — no uploads, ever</li>
        <li>• No account, no telemetry, no size limits beyond your disk</li>
      </ul>

      <h2 className="mt-12 text-xl font-semibold">Download &amp; build</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        The desktop shell ships as an Electron wrapper around the standalone
        Next.js build. Installers are produced with electron-builder — one
        command on any machine with Node.js 18+:
      </p>

      <div className="mt-6 space-y-4">
        {PLATFORMS.map((p) => (
          <div key={p.os} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{p.os}</h3>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {p.target}
              </span>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary p-3 text-sm">
              <code>cd desktop{'\n'}npm install{'\n'}npm run dist</code>
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">{p.note}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold">Run without building</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Want to try the shell immediately during development? Start the web
        app, then launch Electron against it:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary p-3 text-sm">
        <code>npm run build{'\n'}cd desktop &amp;&amp; npm install &amp;&amp; npm start</code>
      </pre>

      <div className="mt-12 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        Prebuilt binaries are intentionally not committed to the repository —
        build them fresh per platform with the command above. The wrapper
        spawns the bundled server on port <code>3847</code> and opens a native
        window pointed at it.
      </div>

      <p className="mt-10 text-sm">
        <Link className="font-semibold text-primary" href="/#tools">
          Or keep using the web version →
        </Link>
      </p>
    </main>
  )
}
