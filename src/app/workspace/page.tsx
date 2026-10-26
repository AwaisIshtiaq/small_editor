import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Loader2 } from 'lucide-react'
import { getTool } from '@/lib/pdf-tools/registry'
import { SiteHeader } from '@/components/site-header'
import { WorkspaceClient } from '@/components/workspace-client'
import { Button } from '@/components/ui/button'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>
}): Promise<Metadata> {
  const { tool } = await searchParams
  const def = tool ? getTool(tool) : undefined
  return { title: def ? `${def.name} — Small Editor` : 'Small Editor' }
}

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>
}) {
  const { tool } = await searchParams
  const def = tool ? getTool(tool) : undefined

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {!def ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <h1 className="text-lg font-semibold">Tool not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tool
                ? `There is no tool called "${tool}".`
                : 'Pick a tool from the overview to get started.'}
            </p>
            <Button asChild className="mt-4">
              <Link href="/">All tools</Link>
            </Button>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex justify-center py-20" role="status">
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Loading workspace</span>
              </div>
            }
          >
            <WorkspaceClient key={def.slug} tool={def} />
          </Suspense>
        )}
      </main>
    </>
  )
}
