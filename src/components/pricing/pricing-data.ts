// Pricing page data, ported 1:1 from the user-provided design file
// (upload/Pricing — Small Editor.html, inline <script> PL data).
// Mega-menu tool data (D) is shared with the desktop page, which carries the
// same list with real registry slugs.

export { D } from '../desktop/desktop-data'

// [title-plain, title-bold, price, per, badge, features[y/n, text], image index, featured]
export type Plan = {
  t0: string
  t1: string
  price: number
  per: string
  badge: string
  ds: string
  cta: string
  feats: [boolean, string][]
  img: number
  ft: boolean
}

export const PLANS: Plan[] = [
  {
    t0: 'Web ',
    t1: 'Week Pass',
    price: 5,
    per: 'for 7 days',
    badge: 'One-time',
    ds: 'One-time payment. No auto-renewal, it downgrades to free after 7 days.',
    cta: 'Select',
    feats: [
      [true, '7 days access to Small Editor Web'],
      [false, 'No access to Small Editor Desktop'],
    ],
    img: 0,
    ft: false,
  },
  {
    t0: 'Web ',
    t1: 'Monthly',
    price: 7.5,
    per: 'per month',
    badge: 'Flexible',
    ds: 'Recurring billing. Cancel auto-renewal any time and keep access to the end of the cycle.',
    cta: 'Select',
    feats: [
      [true, 'Access to Small Editor Web'],
      [false, 'No access to Small Editor Desktop'],
    ],
    img: 1,
    ft: false,
  },
  {
    t0: 'Desktop+Web ',
    t1: 'Annual',
    price: 63,
    per: 'per year',
    badge: 'Best value',
    ds: 'Recurring billing. Everything in one plan, online and offline.',
    cta: 'Select',
    feats: [
      [true, 'Access to Small Editor Web'],
      [true, 'A year access to Small Editor Desktop'],
    ],
    img: 2,
    ft: true,
  },
]

export const FREE: Plan = {
  t0: 'Desktop+Web ',
  t1: 'Free',
  price: 0,
  per: 'No signup required',
  badge: 'Free',
  ds: 'Limited usage and features. Upgrade any time.',
  cta: 'Get started',
  feats: [
    [false, 'Page and hourly limits'],
    [false, 'Limited file uploads'],
    [false, 'Tool specific limits'],
    [true, 'No signup required'],
    [true, 'Try also Small Editor Desktop'],
  ],
  img: 3,
  ft: false,
}

export const PLAN_IMGS = ['/pricing/week.webp', '/pricing/monthly.webp', '/pricing/annual.webp']
export const PLAN_ALL_IMGS = [...PLAN_IMGS, '/pricing/free.webp']

export { FOOTER_TOOLS, LANGS } from '../desktop/desktop-data'
