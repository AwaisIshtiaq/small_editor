'use client'

// Small Editor Desktop page, ported 1:1 from the user-provided design file
// (upload/desktop ui.html). The product page keeps a slim header — Pricing
// scrolls to the in-page plans, the full toolbar lives on the other pages.
// Interactive behavior: language popover, pricing tabs, reveal-on-scroll, toasts.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CMP, D, F3, FOOTER_TOOLS, IT, LANGS } from './desktop-data'
import { SketchHover } from './hover-motion'
import { SKETCH_ART } from './sketch-art'
import PayBadges from '../pay-badges'

const svg = (n: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={IT[n] || 'M5 6h14M5 12h14M5 18h9'} />
  </svg>
)

export default function DesktopPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [lang, setLang] = useState(false)
  const [tab, setTab] = useState<'p' | 't'>('p')
  const [os, setOs] = useState('Windows')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

  // Reveal-on-scroll, re-run when the teams tab becomes visible.
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
  }, [tab])

  // Original design detects the visitor OS for the download label.
  useEffect(() => {
    const ua = navigator.userAgent
    if (/Mac/.test(ua)) setOs('macOS')
    else if (/Linux|X11/.test(ua) && !/Android/.test(ua)) setOs('Linux')
    else setOs('Windows')
  }, [])

  // Smooth in-page scrolling for #pricing / #guide (offset under the fixed nav).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null
      if (!a) return
      const id = a.getAttribute('href')!.slice(1)
      const target = root.querySelector('#' + CSS.escape(id))
      if (!target) return
      e.preventDefault()
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  // Close the language popover on outside click or Escape.
  useEffect(() => {
    if (!lang) return
    const close = () => setLang(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [lang])

  return (
    <div className="dpg" ref={rootRef}>
      {/* brand symbol from the original design */}
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
        <span className="sp" />
        <a className="lk" href="#pricing">
          Pricing
        </a>
        <Link className="lk" href="/#tools">
          Log in
        </Link>
        <button
          className="gb"
          aria-label="Select language"
          onClick={(e) => {
            e.stopPropagation()
            setLang((v) => !v)
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3 12h18" />
          </svg>
        </button>
        <div className={'lp' + (lang ? ' on' : '')}>
          {LANGS.map((l) => (
            <a key={l} href="#" onClick={soon('More languages')}>
              {l}
            </a>
          ))}
        </div>
      </nav>

      <header className="dh" id="top">
        <div className="wrap">
          <div className="tc">
            <h1>
              Small Editor <span className="serif">Desktop</span>
            </h1>
            <p className="sb">Productive PDF software that you&rsquo;ll love to use</p>
            <a
              className="dl"
              href="#"
              onClick={soon('The installer')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5.5L10.5 4.4v7H3zM11.5 4.3L21 3v8.4h-9.5zM3 12.6h7.5v7L3 18.5zM11.5 12.6H21V21l-9.5-1.3z" />
              </svg>
              <span>
                <b>Free Download</b>
                <small>
                  Small Editor Desktop 1.0.0 for <strong>{os}</strong>
                </small>
              </span>
            </a>
            <div className="av">
              Available for{' '}
              <a href="#" className="dd" onClick={soon('Mac Intel build')}>
                Mac Intel
              </a>{' '}
              <a href="#" className="dd" onClick={soon('Mac Silicon build')}>
                Mac Silicon
              </a>
              <br />
              <a href="#" className="dd" onClick={soon('Windows 64bit build')}>
                Windows 64bit
              </a>{' '}
              <a href="#" className="dd" onClick={soon('Portable Windows build')}>
                Windows 64bit (portable)
              </a>
              <br />
              <a href="#" className="dd" onClick={soon('Linux .deb build')}>
                Linux (.deb)
              </a>{' '}
              <a href="#" className="dd" onClick={soon('Linux .rpm build')}>
                Linux (.rpm)
              </a>
            </div>
            <p className="av" style={{ marginTop: 12 }}>
              <a href="#guide">Chromebook installation guide</a>
            </p>
            <p className="lg">
              By downloading you agree to the
              <br />
              <a href="#" onClick={soon('The EULA')}>
                <u>EULA</u>
              </a>
              ,{' '}
              <a href="#" onClick={soon('The terms of use')}>
                <u>Terms of use</u>
              </a>{' '}
              &amp;{' '}
              <a href="#" onClick={soon('The privacy policy')}>
                <u>Privacy Policy</u>
              </a>
              <br />
              <br />
              <a href="#" onClick={soon('The credits page')}>
                <u>Credits</u>
              </a>
              &nbsp;{' '}
              <a href="#" onClick={soon('The release notes')}>
                <u>Release Notes</u>
              </a>
            </p>
          </div>
          <img className="ill2" alt="Illustration of the Small Editor desktop app on a monitor" src="/desktop-hero.webp" />
        </div>
      </header>

      <section style={{ paddingTop: 70 }}>
        <div className="wrap sech rv">
          <h2>
            Small Editor Desktop is <span className="serif">free</span> to use with daily limits.
          </h2>
          <p className="lead" style={{ margin: '0 auto' }}>
            Upgrade for PRO features and unlimited use.
          </p>
          <div className="cmp">
            <div className="f h">FREE</div>
            <div className="p h">PRO</div>
            {CMP.map((r, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <div className="f">{r[0]}</div>
                <div className="p">{r[1]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="sech rv">
            <h2>
              We help with your <span className="serif">PDF tasks</span>
            </h2>
          </div>
          <div className="f3">
            {F3.map((f, i) => {
              const Art = SKETCH_ART[f[2]]
              return (
                <div className="fc rv" style={{ ['--i' as string]: String(i % 3) }} key={f[0]}>
                  {Art ? (
                    <SketchHover art={<Art />} label={f[0]} />
                  ) : (
                    <div className="bz">{svg(f[2])}</div>
                  )}
                  <h3>{f[0]}</h3>
                  <p>{f[1]}</p>
                </div>
              )
            })}
          </div>
          <p className="rv" style={{ textAlign: 'center', marginTop: 70, color: 'var(--mu)' }}>
            Can&rsquo;t find the feature you were looking for?
            <br />
            <Link className="cta" style={{ marginTop: 12 }} href="/#tools">
              See all 44 tools <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <div className="ent rv">
        <div className="wrap">
          <div className="bz2">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="M14 34a8 8 0 010-16 10 10 0 0119-2 8 8 0 011 18z" />
              <circle cx="24" cy="26" r="4" />
              <path d="M18 40c1-4 3-6 6-6s5 2 6 6" />
            </svg>
          </div>
          <div>
            <h2>
              Easy to adopt and deploy <span className="serif">in the enterprise</span>
            </h2>
            <ul className="ck">
              <li>Pre-activated deployments with a volume license key</li>
              <li>Citrix™ and Terminal Services™ compatible</li>
              <li>Save costs, volume discounts start from 2 licenses (up to 60% off)</li>
            </ul>
            <a
              className="pill"
              href="#pricing"
              id="entb"
              onClick={(e) => {
                e.preventDefault()
                setTab('t')
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              View enterprise pricing
              <b>↗</b>
            </a>
          </div>
        </div>
      </div>

      <Pricing tab={tab} setTab={setTab} soon={soon} />
      <Faq soon={soon} />
      <WindowMock />
      <Guide />
      <Footer soon={soon} />

      <div className={'toast2' + (toast ? ' on' : '')} role="status">
        {toast}
      </div>
    </div>
  )
}

type Soon = (what: string) => (e: { preventDefault: () => void }) => void

function Pricing({ tab, setTab, soon }: { tab: 'p' | 't'; setTab: (t: 'p' | 't') => void; soon: Soon }) {
  return (
    <section id="pricing">
      <div className="wrap">
        <div className="sech rv">
          <h2>
            Find the perfect <span className="serif">version for you</span>
          </h2>
          <p className="lead" style={{ margin: '0 auto' }}>
            Small Editor Desktop is free to use with daily limits. Upgrade for PRO features and unlimited use.
          </p>
        </div>
        <div className="ptabs" role="tablist">
          <button className={tab === 'p' ? 'on' : ''} role="tab" aria-selected={tab === 'p'} onClick={() => setTab('p')}>
            Personal
          </button>
          <button className={tab === 't' ? 'on' : ''} role="tab" aria-selected={tab === 't'} onClick={() => setTab('t')}>
            Teams &amp; Volume discounts
          </button>
        </div>
        <div className="pg" id="pp" hidden={tab !== 'p'}>
          <div className="shell pc rv">
            <div className="core">
              <h3>
                Desktop <b>Week Pass</b>
              </h3>
              <div className="pr">
                <sup>$</sup>7<small>.95</small>
              </div>
              <ul>
                <li>Latest features</li>
                <li>7 days access to Small Editor Desktop</li>
                <li>7 days access to Small Editor Web</li>
              </ul>
              <a className="pill" href="#" onClick={soon('Checkout')}>
                Get Week Pass
                <b>↗</b>
              </a>
            </div>
          </div>
          <div className="shell pc ft rv" style={{ ['--i' as string]: '1' }}>
            <div className="core">
              <h3>
                Desktop+Web <b>Annual</b>
              </h3>
              <div className="pr">
                <sup>$</sup>63
              </div>
              <ul>
                <li>Latest features</li>
                <li>A year access to Small Editor Desktop</li>
                <li>A year access to Small Editor Web</li>
              </ul>
              <a className="pill" href="#" onClick={soon('Checkout')}>
                Get Annual
                <b>↗</b>
              </a>
            </div>
          </div>
        </div>
        <div className="pg three" id="pt" hidden={tab !== 't'}>
          <div className="shell pc rv">
            <div className="core">
              <h3>
                Team <b>2–9 licenses</b>
              </h3>
              <div className="pr" style={{ fontSize: 34, padding: '11px 0' }}>
                Volume discount
              </div>
              <ul>
                <li>Everything in Annual</li>
                <li>Central license management</li>
                <li>Priority email support</li>
              </ul>
              <a className="pill" href="mailto:hi@smalleditor.app?subject=Team%20license%20quote">
                Get a quote
                <b>↗</b>
              </a>
            </div>
          </div>
          <div className="shell pc ft rv" style={{ ['--i' as string]: '1' }}>
            <div className="core">
              <h3>
                Business <b>10–49 licenses</b>
              </h3>
              <div className="pr" style={{ fontSize: 34, padding: '11px 0' }}>
                Bigger discount
              </div>
              <ul>
                <li>Pre-activated deployment</li>
                <li>Volume license key</li>
                <li>Citrix™ and Terminal Services™</li>
              </ul>
              <a className="pill" href="mailto:hi@smalleditor.app?subject=Business%20license%20quote">
                Get a quote
                <b>↗</b>
              </a>
            </div>
          </div>
          <div className="shell pc rv" style={{ ['--i' as string]: '2' }}>
            <div className="core">
              <h3>
                Enterprise <b>50+ licenses</b>
              </h3>
              <div className="pr" style={{ fontSize: 34, padding: '11px 0' }}>
                Up to 60% off
              </div>
              <ul>
                <li>Custom invoicing</li>
                <li>Dedicated onboarding</li>
                <li>Deployment help</li>
              </ul>
              <a className="pill" href="mailto:hi@smalleditor.app?subject=Enterprise%20license">
                Contact sales
                <b>↗</b>
              </a>
            </div>
          </div>
        </div>
        <p className="note">Prices in USD</p>
        <div className="pay">
          <PayBadges />
        </div>
      </div>
    </section>
  )
}

function Faq({ soon }: { soon: Soon }) {
  return (
    <section style={{ paddingTop: 20 }}>
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
              <h4>Will my subscription be automatically renewed?</h4>
              <p>The Week Pass plan is a one-time charge, not a recurring subscription. It does not automatically renew and downgrades to free after 7 days.</p>
              <p>Desktop Annual is a recurring subscription and will continue until you cancel.</p>
              <p>Subscriptions auto-renew at the end of each term and you will be charged for the subsequent term.</p>
            </div>
          </div>
          <div>
            <div>
              <h4>What is the difference between Small Editor Desktop and Small Editor Web?</h4>
              <p>Small Editor Web is the online, browser-based service, where files are uploaded and processed on our servers.</p>
              <p>Small Editor Desktop is an application that you can install on your computer and files are processed locally, on your computer.</p>
            </div>
            <div style={{ marginTop: 44 }}>
              <h4>Does Small Editor Desktop process files locally?</h4>
              <p>Yes, with Small Editor Desktop files are processed on your computer, not uploaded to our servers.</p>
            </div>
            <div style={{ marginTop: 44 }}>
              <h4>Can I use Small Editor Desktop on both my laptop and my desktop?</h4>
              <p>Yes, you can use one license of Small Editor Desktop on both your laptop and your desktop, given you are the only one using it on these computers.</p>
            </div>
            <div style={{ marginTop: 44 }}>
              <h4>Do you offer a perpetual license?</h4>
              <p>No, we don&rsquo;t offer perpetual licenses anymore.</p>
            </div>
          </div>
        </div>
        <p style={{ textAlign: 'center', marginTop: 70, color: 'var(--mu)' }}>
          More questions?
          <br />
          <a className="cta" style={{ marginTop: 10 }} href="mailto:hi@smalleditor.app">
            hi@smalleditor.app <span aria-hidden="true">→</span>
          </a>
        </p>
      </div>
    </section>
  )
}

function WindowMock() {
  return (
    <section style={{ paddingTop: 20, background: 'var(--g)', borderTop: '1px solid var(--hair)' }}>
      <div className="wrap">
        <div className="sech rv" style={{ marginBottom: 50 }}>
          <span className="eyebrow">How Desktop looks</span>
          <h2>
            Your editor, <span className="serif">right on your computer</span>
          </h2>
        </div>
        <div className="win rv">
          <div className="wt">
            <i />
            <i />
            <i />
            <span>Small Editor Desktop</span>
          </div>
          <div className="wd">
            Edit &amp; Sign PDF files, Fill PDF forms
            <br />
            Add text, links, images and shapes. Edit existing PDF text and links. Annotate PDF.
          </div>
          <div className="wb">
            <span className="on">Aa&nbsp; Text</span>
            <span>Links</span>
            <span>Forms ▾</span>
            <span>Images ▾</span>
            <span>Sign ▾</span>
            <span>Whiteout</span>
            <span>Annotate ▾</span>
            <span>Shapes ▾</span>
            <span>Undo</span>
            <span>More ▾</span>
          </div>
          <div className="ins">
            <span>Insert page here</span>
          </div>
          <div className="sheet">
            <div className="bg">
              <div className="lgx">
                <i />
                Logo
                <br />
                Name
              </div>
              <h5>INVOICE</h5>
              <div className="cols">
                <div>
                  <b>DATE</b>12/13/2026
                </div>
                <div>
                  <b>INVOICE NO</b>123456
                </div>
              </div>
              <div className="cols" style={{ marginTop: 38 }}>
                <div>
                  <b style={{ fontSize: 14 }}>INVOICE TO</b>Street Address
                  <br />
                  City, ST ZIP Code
                  <br />
                  Phone
                  <br />
                  Fax
                  <br />
                  Email
                </div>
              </div>
              <div className="co">
                <span className="sel">YOUR COMPANY</span>
                <br />
                Street Address
                <br />
                Phone
                <br />
                Fax
                <br />
                Email
              </div>
              <div className="fb">
                <span>
                  <b>B</b>
                </span>
                <span>
                  <i>I</i>
                </span>
                <span>TT ▾</span>
                <span>Font ▾</span>
                <span>Color ▾</span>
                <span aria-hidden="true">🗑</span>
              </div>
            </div>
            <div className="pn">1</div>
            <div className="pn" aria-hidden="true">
              🗑
            </div>
          </div>
          <div className="sv">
            <span>Save ›</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Guide() {
  return (
    <section id="guide">
      <div className="wrap">
        <div className="gd2 rv">
          <h2>
            Ubuntu Linux Chromebook <span className="serif">PDF Editor</span>
          </h2>
          <p className="sb2">How to Edit PDF on Ubuntu Linux or Chromebook</p>
          <ol>
            <li>
              Open a file in the <b>Linux version of Small Editor Desktop</b> or use the <Link href="/workspace?tool=pdf-editor">Online PDF editor</Link>
            </li>
            <li>Click on the Text tool in the top menu</li>
            <li>Change text by clicking on existing text to start editing. Add text on the PDF page.</li>
            <li>Add images to the page. Click and drag to move, resize or rotate the image</li>
            <li>Fill out PDF forms and add signatures. Draw, type or upload an image of your signature</li>
            <li>Annotate PDF pages, highlight text and mark changes with strikethrough</li>
            <li>Add new links to web URLs or pages in the document. Easily edit existing hyperlinks in the PDF</li>
            <li>Easily find and replace all occurrences of words in a PDF. Whiteout parts of the page. Add shapes</li>
            <li>Click Apply changes and save the edited document</li>
          </ol>
        </div>
      </div>
    </section>
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
