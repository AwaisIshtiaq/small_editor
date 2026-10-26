import Link from 'next/link'
import '../styles/landing.css'
import { LandingNav } from '@/components/landing/landing-nav'
import { HeroDemo } from '@/components/landing/hero-demo'
import { LandingEffects } from '@/components/landing/landing-effects'
import { LandingFooter } from '@/components/landing/landing-footer'
import {
  CATEGORIES,
  GUIDES,
  POP,
  TOOLS_LANDING,
  toolIconPath,
  type LandingTool,
} from '@/components/landing/data'

// Laurel wreath geometry, same maths as the reference page
function Laurel({ flip = false }: { flip?: boolean }) {
  const leaves: React.ReactNode[] = []
  for (let i = 0; i < 7; i++) {
    const t = i / 6
    const y = 84 - t * 74
    const x = 16 + 16 * Math.sin(t * 2.4)
    leaves.push(
      <ellipse
        key={`a${i}`}
        cx={x - 5}
        cy={y}
        rx="3.2"
        ry="7"
        transform={`rotate(-28 ${x - 5} ${y})`}
      />,
      <ellipse
        key={`b${i}`}
        cx={x + 4}
        cy={y - 3}
        rx="3"
        ry="6.5"
        transform={`rotate(28 ${x + 4} ${y - 3})`}
      />,
    )
  }
  return (
    <svg
      className={`lf${flip ? ' r' : ''}`}
      viewBox="0 0 44 92"
      aria-hidden="true"
    >
      {leaves}
    </svg>
  )
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

function CategorySection({
  name,
  tools,
  hue = 20,
}: {
  name: string
  tools: LandingTool[]
  hue?: number
}) {
  return (
    <div className="sec" data-sec={name} style={{ ['--h' as string]: hue }}>
      <h4 className="rv">{name}</h4>
      <div className="grid">
        {tools.map((t, i) => (
          <ToolCard key={t.n} t={t} i={i} />
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const popular = POP.map((n) => TOOLS_LANDING.find((t) => t.n === n)).filter(
    Boolean,
  ) as LandingTool[]

  return (
    <div className="se-home">
      <LandingNav />

      {/* ---------------- Hero ---------------- */}
      <header className="hero" id="top">
        <div className="wrap">
          <div>
            <span className="eyebrow">45 PDF tools · free to start</span>
            <h1>
              We help with your <span className="serif">PDF tasks</span>
            </h1>
            <p className="sub">
              An easy, pleasant and productive PDF editor. Split, merge,
              compress, sign or convert — right in your browser.
            </p>
            <div className="row">
              <Link className="pill" href="/workspace?tool=pdf-editor">
                Edit a PDF — it’s free<b>↗</b>
              </Link>
              <span className="rate">
                <b>★★★★☆</b> 4.5 · 1,874 Google reviews
              </span>
            </div>
          </div>
          <HeroDemo />
        </div>
      </header>

      {/* ---------------- Tools ---------------- */}
      <section id="tools">
        <div className="wrap">
          <div className="rv ctr">
            <h2>
              We help with your <span className="serif">PDF tasks</span>
            </h2>
            <p className="subh">Easy, pleasant and productive PDF editor</p>
            <Link className="pill big" href="/workspace?tool=pdf-editor">
              <span>
                <b className="bt">Edit a PDF document</b> – it’s free
              </span>
              <b>›</b>
            </Link>
            <a className="orl" href="#sections">
              or choose one of our 45 PDF tools{' '}
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path
                  d="M3 6l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
          <div style={{ height: 56 }} />
          <div id="sections">
            <CategorySection name="Most popular" tools={popular} />
            {CATEGORIES.map((c) => (
              <CategorySection
                key={c}
                name={c}
                tools={TOOLS_LANDING.filter((t) => t.c === c)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Rating ---------------- */}
      <section className="rate5">
        <div className="wrap rv">
          <Laurel />
          <div>
            <div className="rn">
              4.5 <span className="stars">★★★★★</span>
            </div>
            <p className="rc">1,874 Google reviews</p>
          </div>
          <Laurel flip />
        </div>
      </section>

      {/* ---------------- Web / Desktop ---------------- */}
      <section id="apps" style={{ paddingTop: 70 }}>
        <div className="wrap">
          <div className="rv ctr">
            <h2>
              Works the way <span className="serif">you work</span>
            </h2>
            <p className="lead">
              Online or offline — in the cloud or as a desktop application
            </p>
          </div>
          <div className="two">
            <div className="shell rv">
              <div className="core">
                <div className="blob">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="ill" alt="" src="/assets/web.webp" />
                </div>
                <h3>Small Editor Web</h3>
                <p>
                  Works in the browser. Our servers process the files for you.
                  Files stay secure. After processing, they are permanently
                  deleted.
                </p>
                <a className="cta" href="#tools">
                  Get started — it’s free <span>→</span>
                </a>
              </div>
            </div>
            <div className="shell rv" style={{ ['--i' as string]: 1 }}>
              <div className="core">
                <div className="blob d">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="ill" alt="" src="/assets/desktop.webp" />
                </div>
                <h3>Small Editor Desktop</h3>
                <p>
                  Works offline. Same features as the online service, and the
                  files never leave your computer. Compatible with macOS,
                  Windows and Linux.
                </p>
                <Link className="cta d" href="/desktop">
                  Download now — it’s free <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Guides ---------------- */}
      <section id="guides" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="rv ctr">
            <h2>
              How-To <span className="serif">PDF Guides</span>
            </h2>
          </div>
          <div className="gcol">
            {GUIDES.map((g, gi) => (
              <div
                key={g.title}
                className={`gi rv${g.band ? ' band bul' : ''}`}
                style={{ ['--gh' as string]: 20 }}
              >
                {g.band ? <i className="bl" /> : null}
                {g.band ? <i className="br" /> : null}
                <h3>
                  {g.title}
                  {g.sub ? (
                    <>
                      <br />
                      {g.sub}
                    </>
                  ) : null}
                </h3>
                <ol>
                  {g.steps.map((s, si) => (
                    <li key={si} dangerouslySetInnerHTML={{ __html: s }} />
                  ))}
                </ol>
                <Link
                  className="cta"
                  href={g.ctaDesktop ? '/desktop' : `/workspace?tool=${g.ctaSlug}`}
                >
                  {g.cta} <span>→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
      <LandingEffects />
    </div>
  )
}
