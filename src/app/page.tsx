import Link from 'next/link'
import { CATEGORY_LABELS, TOOLS, type ToolCategory } from '@/lib/pdf-tools/registry'
import { SiteHeader } from '@/components/site-header'
import { ToolIcon } from '@/components/tool-icon'
import { Card, CardContent } from '@/components/ui/card'

const CATEGORY_ORDER: ToolCategory[] = [
  'compress',
  'edit-sign',
  'split',
  'merge',
  'security',
  'convert-from',
  'convert-to',
  'other',
  'scans',
  'automate',
]

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="sr-only">Small Editor — free online PDF tools</h1>
        {CATEGORY_ORDER.map((category) => {
          const tools = TOOLS.filter((t) => t.category === category)
          if (tools.length === 0) return null
          return (
            <section key={category} className="mb-10">
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/workspace?tool=${tool.slug}`}
                    className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Card className="h-full gap-3 py-4 transition-colors group-hover:border-emerald-500/50 group-hover:shadow-sm group-focus-visible:border-emerald-500/50">
                      <CardContent className="px-4">
                        <ToolIcon slug={tool.slug} className="mb-2 size-6 text-emerald-600" />
                        <div className="font-medium">{tool.name}</div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </>
  )
}
