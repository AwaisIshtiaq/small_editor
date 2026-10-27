import {
  FileStack, Scissors, Minimize2, RotateCw, Trash2, Copy, ArrowUpDown, Images, FileImage,
  Stamp, Hash, PanelTop, Lock, Unlock, PenTool, FileText, Presentation, Table2, FileType,
  Globe, FilePlus2, ListOrdered, SplitSquareHorizontal, Binary, FlipHorizontal2, Grid3x3,
  BookOpen, Tags, ImageOff, ArrowLeftRight, Layers, Signature, SquareStack, Eraser,
  ClipboardList, ScanLine, Wand2, Sigma, Baseline, Maximize2, FormInput, FileScan, Wrench, Crop, Contrast,
  type LucideIcon,
} from 'lucide-react'
import type { ToolDef } from '@/lib/pdf-tools/registry'

const ICONS: Record<ToolDef['slug'], LucideIcon> = {
  // compress
  compress: Minimize2,
  // edit & sign
  'pdf-editor': FilePlus2,
  sign: Signature,
  'pdf-forms': FormInput,
  'delete-pages': Trash2,
  // split
  'extract-pages': Copy,
  split: Scissors,
  'split-bookmarks': BookOpen,
  'split-middle': SplitSquareHorizontal,
  'split-size': Binary,
  'split-text': Baseline,
  // merge
  merge: FileStack,
  'alternate-mix': ArrowLeftRight,
  organize: ArrowUpDown,
  // security
  protect: Lock,
  unlock: Unlock,
  watermark: Stamp,
  flatten: Layers,
  // convert from PDF
  'pdf-to-excel': Table2,
  'pdf-to-jpg': FileImage,
  'pdf-to-ppt': Presentation,
  'pdf-to-text': FileText,
  'pdf-to-word': FileType,
  // convert to PDF
  'html-to-pdf': Globe,
  'jpg-to-pdf': Images,
  'word-to-pdf': FileScan,
  // other
  crop: Crop,
  'bates-numbering': ClipboardList,
  'edit-bookmarks': ListOrdered,
  'edit-metadata': Tags,
  'extract-images': ImageOff,
  flip: FlipHorizontal2,
  grayscale: Contrast,
  'header-footer': PanelTop,
  'n-up': Grid3x3,
  'page-numbers': Hash,
  rename: Wrench,
  repair: Wrench,
  resize: Maximize2,
  rotate: RotateCw,
  'remove-annotations': Eraser,
  // scans
  deskew: ScanLine,
  ocr: Sigma,
  // automate
  workflows: Wand2,
}

export function ToolIcon({ slug, className }: { slug: ToolDef['slug']; className?: string }) {
  const Icon = ICONS[slug]
  return <Icon className={className ?? 'h-6 w-6'} aria-hidden />
}
