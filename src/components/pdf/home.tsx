'use client'

import { CATEGORY_LABELS, TOOLS, type ToolCategory, type ToolDef } from '@/lib/pdf-tools/registry'
import { ToolIcon } from './tool-icon'

const ORDER: ToolCategory[] = ['compress', 'edit-sign', 'split', 'merge', 'security', 'convert-from', 'convert-to', 'other', 'scans', 'automate']

const CATEGORY_BLURB: Record<ToolCategory, string> = {
  compress: 'Shrink file sizes with quality presets',
  'edit-sign': 'Change content, fill forms, sign documents',
  split: 'Break documents apart by pages, size or text',
  merge: 'Combine documents and reorder pages',
  security: 'Passwords, permissions, watermarks and flattening',
  'convert-from': 'Turn PDFs into images, text, Word, Excel and slides',
  'convert-to': 'Build PDFs from images, web pages and documents',
  other: 'Numbering, metadata, repairs and print layouts',
  scans: 'OCR and straighten scanned documents',
  automate: 'Chain tools together and run them in order',
}

export function Home({ onPick }: { onPick: (slug: ToolDef['slug']) => void }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
      <section className="py-12 text-center md:py-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Every PDF tool you need</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground md:text-lg">
          {TOOLS.length} free tools that just work. Files are processed on the server and automatically deleted after 2 hours — nothing is kept.
        </p>
      </section>

      {ORDER.map((cat) => (
        <section key={cat} className="mt-10" aria-labelledby={`cat-${cat}`}>
          <h2 id={`cat-${cat}`} className="text-lg font-semibold">
            {CATEGORY_LABELS[cat]}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{CATEGORY_BLURB[cat]}</span>
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.filter((t) => t.category === cat).map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => onPick(t.slug)}
                className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:shadow-sm"
              >
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <ToolIcon slug={t.slug} className="h-5 w-5" />
                </span>
                <span className="font-medium">{t.name}</span>
                <span className="text-sm text-muted-foreground">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
