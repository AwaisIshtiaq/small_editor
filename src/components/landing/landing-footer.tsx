import Link from 'next/link'
import { FOOTER_TOOLS, LANGUAGES } from './data'

export function LandingFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="fg">
          <div>
            <h5>Resources</h5>
            <Link href="/pricing">Pricing &amp; Upgrade</Link>
            <Link href="/desktop">Small Editor for Desktop</Link>
            <Link href="/#apps">Small Editor Web</Link>
            <Link href="/#guides">Guides</Link>
            <Link href="/#top">About</Link>
            <h5 className="m">API</h5>
            <Link href="/workspace?tool=html-to-pdf">HTML to PDF API</Link>
            <Link href="/api-docs">Developer Docs</Link>
            <h5 className="m">Legal</h5>
            <a href="#" title="Coming soon">Terms of Use</a>
            <a href="#" title="Coming soon">Privacy Policy</a>
            <a href="#" title="Coming soon">Cookies</a>
            <a href="#" title="Coming soon">Privacy Settings</a>
            <a href="#" title="Coming soon">Security</a>
            <a href="#" title="Coming soon">SLA</a>
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
            {FOOTER_TOOLS.map((t) => (
              <Link key={t.label} href={`/workspace?tool=${t.slug}`}>
                {t.label}
              </Link>
            ))}
          </div>
          <div>
            <h5>Languages</h5>
            {LANGUAGES.map((l) => (
              <a key={l} href="#" title="Coming soon">
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
