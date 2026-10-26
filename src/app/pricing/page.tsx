import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — Small Editor',
  description:
    'Free, Desktop and API plans for Small Editor. Every tool is free to use in the browser.',
}

const PLANS = [
  {
    name: 'Web',
    price: 'Free',
    per: '',
    highlight: true,
    features: [
      'All 45 PDF tools',
      'No account required',
      'Files auto-deleted after 2 hours',
      'Works in any modern browser',
      'Batch processing & tool chains (Workflows)',
    ],
    cta: { label: 'Start now — it’s free', href: '/#tools' },
  },
  {
    name: 'Desktop',
    price: 'Free',
    per: 'during beta',
    highlight: false,
    features: [
      'Everything in Web',
      '100% offline — files never leave your machine',
      'No file size or page limits beyond your disk',
      'Windows, macOS and Linux installers',
    ],
    cta: { label: 'Get the desktop app', href: '/desktop' },
  },
  {
    name: 'API',
    price: 'Free',
    per: 'while limits are open',
    highlight: false,
    features: [
      'REST endpoints: upload → task → poll → download',
      'Same 45 tools programmatically',
      'HTML to PDF endpoint for URL → PDF',
      'Rate limiting switchable per environment',
    ],
    cta: { label: 'Read the API docs', href: '/api-docs' },
  },
]

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-14">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to all tools
      </Link>

      <h1 className="mt-6 text-4xl font-bold tracking-tight">
        Simple <span className="text-primary">pricing</span>
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
        Every tool is free to use. Paid tiers are planned for heavy
        automation and priority processing — nothing here is gated today.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col rounded-2xl border bg-card p-6 ${
              p.highlight ? 'border-primary/60 shadow-[0_0_40px_rgba(255,90,9,.12)]' : ''
            }`}
          >
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {p.name}
            </h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{p.price}</span>
              {p.per ? (
                <span className="text-sm text-muted-foreground">{p.per}</span>
              ) : null}
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
              {p.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <Link
              href={p.cta.href}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[.98]"
            >
              {p.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </main>
  )
}
