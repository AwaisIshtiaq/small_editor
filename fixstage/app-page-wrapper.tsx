import type { Metadata } from 'next'
import '../../styles/desktop.css'
import DesktopPage from '@/components/desktop/desktop-page'

export const metadata: Metadata = {
  title: 'Small Editor Desktop — Productive PDF software',
  description:
    'The full PDF toolset as a native desktop application for Windows, macOS and Linux. Works 100% offline, files never leave your computer.',
}

export default function Desktop() {
  return <DesktopPage />
}
