import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import '../../styles/landing.css'
import '../../styles/workspace.css'
import { LandingNav } from '@/components/landing/landing-nav'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingEffects } from '@/components/landing/landing-effects'
import { ToolPage } from '@/components/tool/tool-page'
import { toolIconPath, TOOLS_LANDING, CATEGORIES, POP, type LandingTool } from '@/components/landing/data'
import { getTool } from '@/lib/pdf-tools/registry'
import toolGuides from '@/data/tool-guides.json'
import type { ToolInfo } from '@/components/tool/guide-types'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>
}): Promise<Metadata> {
  const { tool } = await searchParams
  const def = tool ? getTool(tool) : undefined
  return { title: def ? `${def.name} — Small Editor` : 'All PDF tools — Small Editor' }
}

function ToolCard({ t, i }: { t: LandingTool; i: number }) {
  return (
    <Link
      href={`/workspace?tool=${t.slug}`}
      className="t shell rv"
      style={{ ['--i' as string]: i % 3 }}
    >
      <div className="core">
        <div className="hd">
          <div className="ic">
            <svg viewBox="0 0 24 24">
              <path d={toolIconPath(t.c, t.n)} />
            </svg>
          </div>
          <h3>
            {t.n}
            {t.nw ? <span className="nw">New</span> : null}
          </h3>
        </div>
        <p>{t.d}</p>
      </div>
    </Link>
  )
}

function CategorySection({ name, tools }: { name: string; tools: LandingTool[] }) {
  return (
    <div className="sec" data-sec={name} style={{ ['--h' as string]: 20 }}>
      <h4 className="rv">{name}</h4>
      <div className="grid">
        {tools.map((t, i) => (
          <ToolCard key={t.n} t={t} i={i} />
        ))}
      </div>
    </div>
  )
}

// "All PDF tools" directory — same design as the prototype's tools.html
// directory view (no hash).
function ToolsDirectory() {
  const popular = POP.map((n) => TOOLS_LANDING.find((t) => t.n === n)).filter(
    Boolean,
  ) as LandingTool[]
  return (
    <main>
      <div className="thero">
        <div className="tbg" aria-hidden="true">
          {[10, 26, 46].map((d, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={d}
              className="ly"
              style={{ ['--d' as string]: d }}
              alt=""
              src={`/assets/toolbg-layer${i}.webp`}
            />
          ))}
        </div>
        <header className="dirh">
          <div className="wrap">
            <h1>
              All <span className="serif">PDF tools</span>
            </h1>
            <p className="lead" style={{ margin: '0 auto' }}>
              Pick a tool to see how it works and start.
            </p>
          </div>
        </header>
      </div>
      <div className="wrap" style={{ paddingBottom: 60 }}>
        <CategorySection name="Most popular" tools={popular} />
        {CATEGORIES.map((c) => (
          <CategorySection
            key={c}
            name={c}
            tools={TOOLS_LANDING.filter((t) => t.c === c)}
          />
        ))}
      </div>
    </main>
  )
}

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>
}) {
  const { tool } = await searchParams
  const def = tool ? getTool(tool) : undefined
  const info = def
    ? (toolGuides as unknown as Record<string, ToolInfo>)[def.slug]
    : undefined

  return (
    <div className="se-home">
      <LandingNav />
      {def ? (
        <main>
          <Suspense fallback={null}>
            <ToolPage tool={def} info={info} />
          </Suspense>
        </main>
      ) : tool ? (
        <main>
          <div className="dirh">
            <div className="wrap">
              <h1>
                Tool <span className="serif">not found</span>
              </h1>
              <p className="lead" style={{ margin: '0 auto' }}>
                There is no tool called “{tool}”. Pick one from the directory instead.
              </p>
              <p style={{ marginTop: 26 }}>
                <Link className="pill" href="/workspace">
                  All PDF tools<b>›</b>
                </Link>
              </p>
            </div>
          </div>
        </main>
      ) : (
        <ToolsDirectory />
      )}
      <LandingFooter />
      <LandingEffects />
    </div>
  )
}
