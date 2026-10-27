'use client'

// Small Editor Pricing page, ported 1:1 from the user's design file
// (upload/Pricing — Small Editor.html); behavior mirrors its inline script
// (tabs, team modal, tilt cards, moveable illustration, popovers, toasts).

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { D, FOOTER_TOOLS, FREE, LANGS, PLANS, PLAN_ALL_IMGS, PLAN_IMGS, type Plan } from './pricing-data'
import PayBadges from '../pay-badges'

const money = (v: number) =>
  '$' +
  (Math.round(v * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: Math.round(v * 100) % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })

function disc(n: number): number {
  if (n >= 50) return 0.6
  if (n >= 25) return 0.4
  if (n >= 5) return 0.2
  if (n >= 2) return 0.1
  return 0
}

export default function PricingPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const mvbRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [mega, setMega] = useState(false)
  const [lang, setLang] = useState(false)
  const [burger, setBurger] = useState(false)
  const [tab, setTab] = useState<'p' | 't'>('p')
  const [teamN, setTeamN] = useState(0)
  const [teamInput, setTeamInput] = useState('10')
  const [modal, setModal] = useState(false)
  const [toast, setToast] = useState('')

  const say = useCallback((m: string) => {
    setToast(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])

  const soon = useCallback(
    (what: string) => (e: { preventDefault: () => void }) => {
      e.preventDefault()
      say(what + ' is coming soon')
    },
    [say],
  )

  const demoCheckout = useCallback(
    (e: { preventDefault: () => void }) => {
      e.preventDefault()
      say('Checkout isn\u2019t connected yet (demo page)')
    },
    [say],
  )

  const openM = useCallback(() => {
    setMega(false)
    setLang(false)
    setBurger(false)
    setModal(true)
    setTeamInput(String(teamN || 10))
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 120)
  }, [teamN])

  const closeM = useCallback(() => setModal(false), [])

  const showT = useCallback(() => {
    const n = Math.floor(Number(teamInput))
    if (!(n >= 2)) {
      say('Team pricing starts from 2 licenses')
      return
    }
    setTeamN(n)
    setModal(false)
    setTab('t')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [say, teamInput])

  const clickTab = useCallback(
    (t: 'p' | 't') => {
      if (t === 't' && !teamN) {
        openM()
        return
      }
      setTab(t)
    },
    [openM, teamN],
  )

  // Reveal-on-scroll, re-run when the tab / team grid changes.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.1 },
    )
    root.querySelectorAll('.rv:not(.in)').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [tab, teamN])

  // Original design: #teams hash opens the team pricing dialog (once).
  // Deferred so the mount effect doesn't set state synchronously.
  const hashSeen = useRef(false)
  useEffect(() => {
    if (hashSeen.current || location.hash !== '#teams') return
    hashSeen.current = true
    const t = setTimeout(openM, 0)
    return () => clearTimeout(t)
  }, [openM])

  // Escape closes the modal and any open nav popover (same as the desktop page).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(false)
        setMega(false)
        setLang(false)
        setBurger(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!mega && !lang && !burger) return
    const close = () => {
      setMega(false)
      setLang(false)
      setBurger(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [mega, lang, burger])

  // Cursor aura + 3D tilt on plan cards (pointer handlers on each grid).
  const gridMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const g = e.currentTarget
    const gr = g.getBoundingClientRect()
    const c = (e.target as HTMLElement).closest('.pc3') as HTMLElement | null
    g.style.setProperty('--mx', e.clientX - gr.left + 'px')
    g.style.setProperty('--my', e.clientY - gr.top + 'px')
    g.classList.toggle('hov', !!c)
    g.querySelectorAll<HTMLElement>('.pc3').forEach((x) => {
      if (x !== c) {
        x.classList.remove('act')
        x.style.removeProperty('--rx')
        x.style.removeProperty('--ry')
      }
    })
    if (c) {
      const r = c.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      c.classList.add('act')
      c.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg')
      c.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg')
      c.style.setProperty('--cx', px * 100 + '%')
      c.style.setProperty('--cy', py * 100 + '%')
    }
  }, [])

  const gridLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const g = e.currentTarget
    g.classList.remove('hov')
    g.querySelectorAll<HTMLElement>('.pc3').forEach((x) => {
      x.classList.remove('act')
      x.style.removeProperty('--rx')
      x.style.removeProperty('--ry')
    })
  }, [])

  // Moveable illustration: parts spread on hover, parallax follows the
  // cursor, spring back on leave (original .mvb behavior).
  const mvOpen = useRef(false)
  const mvPlace = useCallback((mx: number, my: number) => {
    const mb = mvbRef.current
    if (!mb) return
    mb.querySelectorAll<SVGGElement>('.mv').forEach((p) => {
      const d = Number(p.dataset.d)
      const k = mvOpen.current ? 1 : 0
      p.style.setProperty('--tx', Number(p.dataset.x) * k + mx * 18 * d + 'px')
      p.style.setProperty('--ty', Number(p.dataset.y) * k + my * 14 * d + 'px')
      p.style.setProperty('--tr', Number(p.dataset.r) * k + 'deg')
    })
  }, [])

  const cats = [...new Set(D.map((t) => t.c))]
  const d = disc(teamN)
  const pc = Math.round(d * 100)

  return (
    <div className="ppg" ref={rootRef}>
      {/* brand symbol shared with the other pages */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="mgd" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ec7f37" />
            <stop offset=".55" stopColor="#FF5A09" />
            <stop offset="1" stopColor="#be4f0c" />
          </linearGradient>
        </defs>
        <symbol id="mk" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="10" fill="url(#mgd)" />
          <path d="M22 0l10 10V8a8 8 0 00-8-8z" fill="rgba(255,255,255,.25)" />
          <path
            d="M21.6 11.4c-1.2-1.7-3-2.6-5.4-2.6-3 0-5 1.5-5 3.7 0 2.3 1.8 3.1 5 3.9 3.3.8 5.1 1.7 5.1 4 0 2.3-2.2 3.8-5.3 3.8-2.4 0-4.4-.9-5.7-2.6"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </symbol>
      </svg>

      <nav>
        <Link className="logo" href="/">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <use href="#mk" />
          </svg>
          Small Editor
        </Link>
        <button
          className={'at' + (mega ? ' on' : '')}
          aria-expanded={mega}
          onClick={(e) => {
            e.stopPropagation()
            setLang(false)
            setMega((v) => !v)
          }}
        >
          All Tools{' '}
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Link className="lk" href="/#tools">
          Compress
        </Link>
        <Link className="lk" href="/#tools">
          Edit
        </Link>
        <Link className="lk hm" href="/#tools">
          Fill &amp; Sign
        </Link>
        <Link className="lk" href="/#tools">
          Merge
        </Link>
        <Link className="lk hm" href="/#tools">
          Delete Pages
        </Link>
        <Link className="lk hm" href="/#tools">
          Crop
        </Link>
        <span className="sp" />
        <Link className="lk on" href="/pricing" aria-current="page">
          Pricing
        </Link>
        <Link className="lk" href="/desktop">
          Desktop
        </Link>
        <Link className="lk" href="/#tools">
          Log in
        </Link>
        <button
          className="gb"
          aria-label="Select language"
          onClick={(e) => {
            e.stopPropagation()
            setMega(false)
            setLang((v) => !v)
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3 12h18" />
          </svg>
        </button>
        <button className="bm" aria-label="Menu" aria-expanded={burger} onClick={() => setBurger((v) => !v)}>
          <span />
          <span />
        </button>
        <div className={'lp' + (lang ? ' on' : '')}>
          {LANGS.map((l) => (
            <a key={l} href="#" onClick={soon('More languages')}>
              {l}
            </a>
          ))}
        </div>
      </nav>

      <div className={'mega shell' + (mega ? ' on' : '')}>
        <div className="core">
          {cats.map((c) => (
            <div className="mg" key={c}>
              <h6>{c}</h6>
              {D.filter((t) => t.c === c).map((t) => (
                <Link key={t.n} href={'/workspace?tool=' + t.slug} onClick={() => setMega(false)}>
                  {t.n}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={'ov' + (burger ? ' on' : '')} onClick={() => setBurger(false)}>
        <Link href="/#tools">All tools</Link>
        <Link href="/#tools">Edit &amp; Sign</Link>
        <Link href="/#tools">Merge</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/#tools">Log in</Link>
      </div>

      <header className="ph">
        <div className="wrap">
          <h1 className="rv">
            Select a plan that&rsquo;s <span className="serif">right for you</span>
          </h1>
          <div className="ptabs rv" role="tablist">
            <button className={tab === 'p' ? 'on' : ''} role="tab" aria-selected={tab === 'p'} onClick={() => clickTab('p')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
              </svg>
              Personal
            </button>
            <button className={tab === 't' ? 'on' : ''} role="tab" aria-selected={tab === 't'} onClick={() => clickTab('t')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="8" cy="9" r="3" />
                <circle cx="17" cy="9" r="3" />
                <path d="M2 20c.5-3 3-5 6-5M22 20c-.5-3-3-5-6-5M8 20c.5-3 2-5 4-5s3.5 2 4 5" />
              </svg>
              Teams &amp; Volume discounts
            </button>
          </div>
        </div>
      </header>

      <section style={{ padding: 0 }}>
        <div className="wrap">
          <div className="pgrid" id="gp" onPointerMove={gridMove} onPointerLeave={gridLeave}>
            {PLANS.map((p) => (
              <PlanCard key={p.t1} p={p} img={PLAN_IMGS[p.img]} price={staticPrice(p.price)} per={p.per} ds={p.ds} onSelect={demoCheckout} />
            ))}
            <div className="aura" />
          </div>
          {tab === 't' && teamN > 0 && (
            <>
              <p className="note" id="tsum">
                Team of <b>{teamN}</b> &nbsp;·&nbsp; {pc}% volume discount &nbsp;·&nbsp;{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    openM()
                  }}
                >
                  Change team size
                </a>
              </p>
              <div className="pgrid" id="gt" onPointerMove={gridMove} onPointerLeave={gridLeave}>
                {PLANS.map((p) => (
                  <PlanCard
                    key={p.t1}
                    p={p}
                    img={PLAN_IMGS[p.img]}
                    price={money(p.price * teamN * (1 - d))}
                    per={p.per + ' · ' + teamN + ' licenses'}
                    ds={pc + '% volume discount applied · ' + money(p.price * (1 - d)) + ' per license'}
                    onSelect={demoCheckout}
                  />
                ))}
                <div className="aura" />
              </div>
            </>
          )}
          <p className="note" id="n1" hidden={tab !== 'p'}>
            Prices in USD &nbsp;·&nbsp; <Link href="/desktop#pricing">Desktop Week Pass available here</Link>
          </p>
          <div className="pay">
            <PayBadges />
          </div>
        </div>
      </section>

      <div className="band">
        <div className="wrap sech rv">
          <h2>
            Included with <span className="serif">all paid plans</span>
          </h2>
          <ul className="inc" style={{ textAlign: 'left' }}>
            <li>Browser based access to all PDF tools</li>
            <li>
              Unlimited documents, no page or hourly limits
              <small>OCR documents up to 100 pages</small>
            </li>
            <li>Processing multiple files at once</li>
            <li>More processing time per task, up to 21 minutes</li>
            <li>Large file uploads, up to 500MB per file</li>
            <li>Email support</li>
          </ul>
        </div>
      </div>

      <section>
        <div className="wrap sech">
          <div className="rv">
            <h2>
              Forever <span className="serif">free to use</span>
            </h2>
            <p className="lead" style={{ margin: '0 auto' }}>
              No signup required. Limited usage and features
            </p>
          </div>
          <div className="pgrid one rv" id="gf" style={{ marginTop: 50 }} onPointerMove={gridMove} onPointerLeave={gridLeave}>
            <PlanCard p={FREE} img={PLAN_ALL_IMGS[FREE.img]} price={staticPrice(0)} per={FREE.per} ds={FREE.ds} onSelect={demoCheckout} />
            <div className="aura" />
          </div>
        </div>
      </section>

      <div className="band" style={{ marginTop: 20 }} id="teams">
        <div className="wrap tw">
          <div
            className="mvb rv"
            ref={mvbRef}
            onPointerEnter={() => {
              mvOpen.current = true
              mvPlace(0, 0)
            }}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              mvOpen.current = true
              mvPlace((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5)
            }}
            onPointerLeave={() => {
              mvOpen.current = false
              mvPlace(0, 0)
            }}
            onPointerUp={(e) => {
              if (e.pointerType !== 'mouse') {
                mvOpen.current = !mvOpen.current
                mvPlace(0, 0)
              }
            }}
          >
            <MvbArt />
          </div>
          <div className="rv" style={{ ['--i' as string]: '1' }}>
            <h2>
              Powering teams <span className="serif">around the world</span>
            </h2>
            <ul className="ck">
              <li>Volume discount starting from just 2 members.</li>
              <li>Easy setup and management</li>
            </ul>
            <a
              className="pill"
              href="#"
              onClick={(e) => {
                e.preventDefault()
                openM()
              }}
            >
              View team pricing<b>↗</b>
            </a>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sech rv">
            <h2>
              Common <span className="serif">questions</span>
            </h2>
          </div>
          <div className="faq rv">
            <div>
              <div>
                <h4>How can I cancel my subscription?</h4>
                <p>
                  To cancel a recurring subscription just click &lsquo;Stop auto-renewal&rsquo; from{' '}
                  <a href="mailto:hi@smalleditor.app?subject=Stop%20auto-renewal">your account page</a>. You can also email
                  hi@smalleditor.app.
                </p>
                <p>The Week Pass plan is a one-time charge, not a recurring subscription. It does not automatically renew and downgrades to free after 7 days.</p>
              </div>
              <div style={{ marginTop: 44 }}>
                <h4>Can I cancel at any time?</h4>
                <p>You can cancel auto-renewal of your subscription at any time. The subscription will no longer auto-renew and it will cancel at the end of the current billing cycle.</p>
              </div>
              <div style={{ marginTop: 44 }}>
                <h4>Can I subscribe only one month / year?</h4>
                <p>Yes. Simply cancel auto-renewal immediately after signing up and you&rsquo;ll only be charged for the current billing cycle.</p>
              </div>
            </div>
            <div>
              <div>
                <h4>Will my subscription be automatically renewed?</h4>
                <p>The Week Pass is a one-time charge, not a recurring subscription. It does not automatically renew and downgrades to free after 7 days.</p>
                <p>The Monthly and Annual plans are recurring subscriptions and will continue until you cancel.</p>
                <p>Subscriptions auto-renew at the end of each term and you will be charged for the subsequent term.</p>
              </div>
              <div style={{ marginTop: 44 }}>
                <h4>What is Small Editor Web?</h4>
                <p>Small Editor Web are the online browser-based tools, where you upload your documents and process them on our servers.</p>
              </div>
              <div style={{ marginTop: 44 }}>
                <h4>What is Small Editor Desktop?</h4>
                <p>
                  <Link href="/desktop">Small Editor Desktop</Link> is an application that you download and install on your computer. It
                  processes documents on your local computer, without uploading them to our servers.
                </p>
              </div>
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: 70, color: 'var(--mu)' }}>
            More questions?
            <br />
            <a className="cta" style={{ marginTop: 10, color: 'var(--v)', fontWeight: 700 }} href="mailto:hi@smalleditor.app">
              hi@smalleditor.app →
            </a>
          </p>
        </div>
      </section>

      <Footer soon={soon} />

      <div
        className={'md2' + (modal ? ' on' : '')}
        role="dialog"
        aria-modal="true"
        aria-label="Team pricing and volume discounts"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeM()
        }}
      >
        <div className="mp">
          <div className="mh">
            <span>Team pricing &amp; volume discounts</span>
            <button aria-label="Close" onClick={closeM}>
              ✕
            </button>
          </div>
          <div className="mbd">
            <b>What is your team size?</b>
            <div className="mr">
              <input
                ref={inputRef}
                type="number"
                min={2}
                value={teamInput}
                inputMode="numeric"
                aria-label="Team size"
                onChange={(e) => setTeamInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') showT()
                }}
              />
              <button className="pill" onClick={showT}>
                Show team pricing<b>→</b>
              </button>
            </div>
          </div>
          <div className="mtb">
            <h3>
              Volume <span className="serif">Discounts</span>
            </h3>
            <table>
              <tbody>
                <tr>
                  <th>Quantity</th>
                  <th>Discount</th>
                </tr>
                <tr>
                  <td>2-4</td>
                  <td>10%</td>
                </tr>
                <tr>
                  <td>5-24</td>
                  <td>20%</td>
                </tr>
                <tr>
                  <td>25-49</td>
                  <td>40%</td>
                </tr>
                <tr>
                  <td>50+</td>
                  <td>60%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={'toast2' + (toast ? ' on' : '')} role="status">
        {toast}
      </div>
    </div>
  )
}

type Soon = (what: string) => (e: { preventDefault: () => void }) => void

// $5 / $7<small>.50</small> / $0 — static card price markup from the design
function staticPrice(v: number): React.ReactNode {
  const whole = Math.floor(v)
  const frac = Math.round((v - whole) * 100)
  return (
    <>
      <sup>$</sup>
      {whole}
      {frac ? <small>.{String(frac).padStart(2, '0')}</small> : null}
    </>
  )
}

function PlanCard({
  p,
  img,
  price,
  per,
  ds,
  onSelect,
}: {
  p: Plan
  img: string
  price: React.ReactNode
  per: string
  ds: string
  onSelect: (e: { preventDefault: () => void }) => void
}) {
  return (
    <article className={'pc3' + (p.ft ? ' ft' : '')} tabIndex={0}>
      <div className="md">
        <img alt="" src={img} />
      </div>
      <div className="sh" />
      <span className={'bd' + (p.ft ? ' hot' : '')}>{p.badge}</span>
      <div className="pn3">
        <div className="pt3">
          <div>
            <h3>
              {p.t0}
              <b>{p.t1}</b>
            </h3>
            <p className="sb3">{per}</p>
          </div>
          <span className="pr3">{price}</span>
        </div>
        <p className="ds3">{ds}</p>
        <ul className="ul3">
          {p.feats.map(([ok, f]) => (
            <li key={f} className={ok ? 'y' : 'n'}>
              {f}
            </li>
          ))}
        </ul>
        <a className="cta3" href="#" onClick={onSelect}>
          {p.cta}
        </a>
      </div>
    </article>
  )
}

// Pencil-sketch redraw: ink via theme vars, yellow accents, hatch shading.
// Same .mv groups and data attributes as before, so the parallax is unchanged.
function MvbArt() {
  const INK = 'var(--tx)'
  const MUT = 'var(--mu)'
  const AMB = '#f0b429'
  const AMB_SOFT = 'rgba(240,180,41,.28)'
  // wobbly hand-drawn rectangle path
  const wr = (x: number, y: number, w: number, h: number, r = 3) =>
    `M${x + r} ${y} q${w * 0.3} -1.5 ${w - r} 0 q1.5 ${h * 0.3} 0 ${h - r} q-${w * 0.3} 1.5 -${w - r} 0 q-1.5 -${h * 0.3} 0 -${h - r} z`
  // puzzle piece profile, reused for both colors
  const pz = 'M0 0h14v-5a6 6 0 1112 0v5h14v14h5a6 6 0 110 12h-5v14H0z'
  return (
    <svg viewBox="0 0 400 300" fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-label="Interactive illustration: hover to move the parts">
      <defs>
        <pattern id="ht" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0v5" stroke={MUT} strokeWidth="1" />
        </pattern>
        <pattern id="ht2" width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <path d="M0 0v4.2" stroke={MUT} strokeWidth="0.9" />
        </pattern>
      </defs>
      {/* big sketch loop, hand-drawn double pass */}
      <g className="mv" data-x="4" data-y="2" data-r="5" data-d=".3">
        <circle cx="185" cy="152" r="80" strokeWidth={1.6} />
        <circle cx="186.5" cy="150.5" r="78.5" strokeWidth={1} opacity={0.3} />
      </g>
      {/* lightbulb, glowing */}
      <g className="mv" data-x="-30" data-y="-22" data-r="-10" data-d="1">
        <g transform="translate(75 62)">
          <path d="M-13 18C-22 11-26 3-26-6a26 26 0 0152 0C26 3 22 11 13 18z" fill={AMB_SOFT} />
          <path d="M-11.5 16.5C-20 10-24.5 2.5-24.5-6a24.5 24.5 0 0149 0C24.5 2.5 20 10 11.5 16.5z" strokeWidth={1.1} opacity={0.5} />
          <path d="M-12 24h24M-10 30h20M-6 36h12" />
          <path d="M-5 -2l5 10 5-10" stroke={AMB} strokeWidth={1.5} />
          <path d="M0 -42v-9M-30 -30l-6-6M30 -30l6-6M-38 -6h-8M38 -6h8" stroke={AMB} opacity={0.9} />
        </g>
      </g>
      {/* pie chart riding the loop */}
      <g className="mv" data-x="30" data-y="-26" data-r="26" data-d=".9">
        <g transform="translate(228 80)">
          <circle r="16" fill="var(--card)" />
          <path d="M0 0V-16A16 16 0 0115.3-4z" fill={AMB} stroke={INK} strokeWidth={1.2} />
        </g>
      </g>
      {/* puzzle, hatched */}
      <g className="mv" data-x="-20" data-y="-12" data-r="-12" data-d="1.1">
        <g transform="translate(152 118)">
          <path d={pz} fill="url(#ht)" />
          <path d={pz} strokeWidth={1.3} opacity={0.85} />
        </g>
      </g>
      {/* puzzle, yellow */}
      <g className="mv" data-x="20" data-y="14" data-r="14" data-d="1.2">
        <g transform="translate(196 162)">
          <path d={pz} fill={AMB} />
          <path d={pz} stroke={INK} strokeWidth={1.3} />
        </g>
      </g>
      {/* small squares in the loop */}
      <g className="mv" data-x="12" data-y="10" data-r="-18" data-d="1.5">
        <rect x="228" y="182" width="12" height="12" fill="url(#ht2)" strokeWidth={1.2} />
        <rect x="242" y="186" width="8" height="8" fill="var(--card)" strokeWidth={1.1} />
      </g>
      {/* hand reaching down over the loop */}
      <g className="mv" data-x="-6" data-y="-26" data-r="8" data-d="1.2">
        <g transform="translate(190 46)">
          <path d="M-5 8v18a6 6 0 0012 0V8" fill="var(--card)" strokeWidth={1.4} />
          <rect x="-16" y="-18" width="32" height="28" rx="10" fill="var(--card)" strokeWidth={1.4} />
          <path d={wr(-13, -30, 26, 12, 4)} fill="url(#ht)" strokeWidth={1.2} />
          <path d="M-8 -6h6M4 -6h6" strokeWidth={1} opacity={0.5} />
        </g>
      </g>
      {/* finger up, yellow tip */}
      <g className="mv" data-x="-30" data-y="16" data-r="-6" data-d=".9">
        <g transform="translate(56 178)">
          <path d="M-5 -14v-40a5 5 0 0110 0v40" fill="var(--card)" strokeWidth={1.4} />
          <rect x="-18" y="-18" width="36" height="26" rx="12" fill="var(--card)" strokeWidth={1.4} />
          <path d={wr(-20, 8, 40, 40, 4)} fill="url(#ht)" strokeWidth={1.3} />
          <circle cx="0" cy="-56" r="4.5" fill={AMB} stroke="none" />
          <path d="M-9 -4h5M6 -4h5" strokeWidth={1} opacity={0.5} />
        </g>
      </g>
      {/* finger up beside the rising arrow */}
      <g className="mv" data-x="30" data-y="18" data-r="6" data-d=".9">
        <g transform="translate(282 182)">
          <path d="M-5 -14v-40a5 5 0 0110 0v40" fill="var(--card)" strokeWidth={1.4} />
          <rect x="-18" y="-18" width="36" height="26" rx="12" fill="var(--card)" strokeWidth={1.4} />
          <path d={wr(-20, 8, 40, 40, 4)} fill="url(#ht2)" strokeWidth={1.3} />
          <path d="M26 22v-40M20 -10l6-8 6 8" stroke={AMB} strokeWidth={2.2} />
        </g>
      </g>
      {/* arrow pushing toward the loop */}
      <g className="mv" data-x="-18" data-y="6" data-r="0" data-d="1.2">
        <path d="M92 150h34M118 143l9 7-9 7" stroke={AMB} strokeWidth={1.9} />
      </g>
      {/* gear */}
      <g className="mv" data-x="-14" data-y="26" data-r="70" data-d="1.4">
        <g transform="translate(148 240)">
          <circle r="17" strokeWidth="7.5" strokeDasharray="4.6 4.9" opacity={0.9} />
          <circle r="17" strokeWidth="7.5" strokeDasharray="4.6 4.9" opacity={0.3} transform="rotate(9)" />
          <circle r="9" />
          <circle r="2.8" fill={INK} stroke="none" />
        </g>
      </g>
      {/* tiny bars */}
      <g className="mv" data-x="-10" data-y="30" data-r="0" data-d="1.1">
        <path d="M96 262v-11M107 262v-19M118 262v-27" strokeWidth="5.5" opacity={0.32} />
      </g>
      {/* trophy */}
      <g className="mv" data-x="34" data-y="-22" data-r="9" data-d=".7">
        <g transform="translate(352 100)">
          <path d="M-21 -18h42v12a21 21 0 01-42 0z" fill={AMB} strokeWidth={1.4} />
          <path d="M-21 -12h-9a9 9 0 009 13M21 -12h9a9 9 0 01-9 13" strokeWidth={1.3} />
          <path d="M0 15v11M-13 26h26v9h-26z" strokeWidth={1.4} />
          <rect x="-13" y="26" width="26" height="9" fill="url(#ht)" strokeWidth={1.2} opacity={0.9} />
        </g>
      </g>
      {/* accents */}
      <g className="mv" data-x="10" data-y="-12" data-r="24" data-d="1.6">
        <path d="M318 34v10M313 39h10" stroke={MUT} />
        <path d="M330 140l7 7M337 140l-7 7" stroke={MUT} opacity={0.7} />
        <circle cx="118" cy="34" r="3.5" fill={AMB} stroke="none" />
        <circle cx="300" cy="216" r="3" fill={INK} stroke="none" opacity={0.5} />
        <path d="M262 30l5 5M267 30l-5 5" stroke={MUT} opacity={0.7} />
      </g>
      {/* sketchy ground */}
      <g stroke={MUT} strokeWidth={1} opacity={0.75}>
        <path d="M96 276l9-6M114 276l9-6M132 276l9-6M150 276l9-6M168 276l9-6M186 276l9-6M204 276l9-6M222 276l9-6M240 276l9-6M258 276l9-6" />
        <path d="M126 283l8-5M142 283l8-5M158 283l8-5M174 283l8-5M190 283l8-5M206 283l8-5M222 283l8-5" opacity={0.55} />
      </g>
    </svg>
  )
}

function Footer({ soon }: { soon: Soon }) {
  return (
    <footer>
      <div className="wrap">
        <div className="fg">
          <div>
            <h5>Resources</h5>
            <Link href="/pricing">Pricing &amp; Upgrade</Link>
            <Link href="/desktop">Small Editor for Desktop</Link>
            <a href="#" onClick={soon('Small Editor for G Suite')}>
              Small Editor for G Suite
            </a>
            <a href="#" onClick={soon('Small Editor for Education')}>
              Small Editor for Education
            </a>
            <a href="#" onClick={soon('The About page')}>
              About
            </a>
            <a href="#" onClick={soon('The blog')}>
              Blog
            </a>
            <h5 className="m">API</h5>
            <Link href="/workspace?tool=html-to-pdf">HTML to PDF API</Link>
            <Link href="/api-docs">Developer Docs</Link>
            <h5 className="m">Legal</h5>
            <a href="#" onClick={soon('The terms of use')}>
              Terms of Use
            </a>
            <a href="#" onClick={soon('The privacy policy')}>
              Privacy Policy
            </a>
            <a href="#" onClick={soon('The cookies policy')}>
              Cookies
            </a>
            <a href="#" onClick={soon('Privacy settings')}>
              Privacy Settings
            </a>
            <a href="#" onClick={soon('The security page')}>
              Security
            </a>
            <a href="#" onClick={soon('The SLA')}>
              SLA
            </a>
            <p className="cp">
              Made with care
              <br />
              © Small Editor 2026–present.
              <br />
              <br />
              Thank you for your time.
            </p>
          </div>
          <div>
            <h5>Tools</h5>
            {FOOTER_TOOLS.map(([name, slug]) => (
              <Link key={name} href={'/workspace?tool=' + slug}>
                {name}
              </Link>
            ))}
          </div>
          <div>
            <h5>Languages</h5>
            {LANGS.map((l) => (
              <a key={l} href="#" onClick={soon('More languages')}>
                {l}
              </a>
            ))}
            <h5 className="m">Contact</h5>
            <a href="mailto:hi@smalleditor.app">hi@smalleditor.app</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
