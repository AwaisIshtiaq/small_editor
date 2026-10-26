import type { LucideIcon } from 'lucide-react'
import {
  AlignLeft,
  Bookmark,
  BookmarkPlus,
  Combine,
  Columns2,
  Contrast,
  Crop,
  Eraser,
  FileArchive,
  FileCog,
  FileImage,
  FileMinus,
  FileOutput,
  FileText,
  FileType2,
  FlipHorizontal,
  Frame,
  Globe,
  Grid2x2,
  Hash,
  ImageDown,
  ImagePlus,
  Layers,
  LayoutGrid,
  ListOrdered,
  Lock,
  LockOpen,
  Maximize,
  PanelTop,
  Pencil,
  PenTool,
  Presentation,
  ReceiptText,
  RotateCw,
  Scale,
  ScanText,
  Scissors,
  SquarePen,
  Stamp,
  Shuffle,
  Table,
  TextCursorInput,
  Type,
  Workflow,
  Wrench,
} from 'lucide-react'

// One icon per tool slug — pure mapping, safe in server and client components.
export const TOOL_ICONS: Record<string, LucideIcon> = {
  // Compress
  compress: FileArchive,
  // Edit & Sign
  'pdf-editor': SquarePen,
  sign: PenTool,
  'pdf-forms': TextCursorInput,
  'delete-pages': FileMinus,
  // Split
  'extract-pages': FileOutput,
  split: Scissors,
  'split-bookmarks': BookmarkPlus,
  'split-middle': Columns2,
  'split-size': Scale,
  'split-text': Type,
  // Merge
  merge: Combine,
  'alternate-mix': Shuffle,
  organize: LayoutGrid,
  // Security
  protect: Lock,
  unlock: LockOpen,
  watermark: Stamp,
  flatten: Layers,
  // Convert from PDF
  'pdf-to-excel': Table,
  'pdf-to-jpg': ImageDown,
  'pdf-to-ppt': Presentation,
  'pdf-to-text': AlignLeft,
  'pdf-to-word': FileText,
  // Convert to PDF
  'html-to-pdf': Globe,
  'jpg-to-pdf': ImagePlus,
  'word-to-pdf': FileType2,
  // Other
  crop: Crop,
  'bates-numbering': ReceiptText,
  'edit-bookmarks': Bookmark,
  'edit-metadata': FileCog,
  'extract-images': FileImage,
  flip: FlipHorizontal,
  grayscale: Contrast,
  'header-footer': PanelTop,
  'n-up': Grid2x2,
  'page-numbers': Hash,
  rename: Pencil,
  repair: Wrench,
  resize: Maximize,
  rotate: RotateCw,
  'remove-annotations': Eraser,
  // Scans
  deskew: Frame,
  ocr: ScanText,
  // Automate
  workflows: Workflow,
}

export function ToolIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = TOOL_ICONS[slug]
  if (!Icon) return null
  return <Icon className={className} aria-hidden="true" />
}
