import type { Metadata } from 'next'
import '../../styles/pricing.css'
import PricingPage from '@/components/pricing/pricing-page'

export const metadata: Metadata = {
  title: 'Pricing — Small Editor',
  description:
    'Select a plan that is right for you: Web Week Pass, Web Monthly or Desktop+Web Annual. Volume discounts for teams starting from just 2 members.',
}

export default function Pricing() {
  return <PricingPage />
}
