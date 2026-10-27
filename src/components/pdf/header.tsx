'use client'

import type { ToolDef } from '@/lib/pdf-tools/registry'
import { SearchBar } from './search-bar'

export function Header({ onPick, onHome }: { onPick: (slug: ToolDef['slug']) => void; onHome: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <button type="button" onClick={onHome} className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm font-bold">S</span>
          Small Editor
        </button>
        <div className="ml-auto hidden flex-1 justify-end md:flex">
          <SearchBar onPick={onPick} />
        </div>
        <div className="md:hidden ml-auto">
          <SearchBar onPick={onPick} />
        </div>
      </div>
    </header>
  )
}
