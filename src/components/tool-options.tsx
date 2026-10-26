'use client'

import { useId, useState } from 'react'
import { Loader2, Play, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Params = Record<string, unknown>

// Defaults for ALL 44 slugs — shapes mirror ToolParams / tasks.ts validators.
export const PARAM_DEFAULTS: Record<string, Params> = {
  merge: { normalizePageSizes: false, blankPageIfOdd: false },
  split: { mode: 'ranges', ranges: '', step: 1 },
  'split-bookmarks': { level: 1, expression: '', includePageAfter: false },
  'split-middle': { ratio: 50, mode: 'vertical', repagination: false, rightToLeft: false },
  'split-size': { size: 10, sizeUnit: 'MB' },
  'split-text': { areaY: 0, areaHeight: 10, startsWith: 'Invoice' },
  'extract-pages': { pages: '' },
  'delete-pages': { pages: '' },
  'alternate-mix': { step: 1, reverse: false, repeat: false },
  organize: { order: [] },
  rotate: { angle: 90, pages: 'all' },
  'jpg-to-pdf': { pageSize: 'fit', orientation: 'auto', margin: 0, mergeOutputs: true },
  'pdf-to-jpg': { pages: 'all', resolution: 150, imageFormat: 'jpg', grayscale: false },
  'pdf-to-text': {},
  'pdf-to-word': {},
  'pdf-to-ppt': { resolution: 150 },
  'pdf-to-excel': { exportFormat: 'xlsx', singleSheet: false },
  'word-to-pdf': {},
  'html-to-pdf': {
    source: 'url',
    url: '',
    htmlCode: '',
    pageSize: 'A4',
    orientation: 'portrait',
    viewportWidth: 1024,
    margin: 10,
    delay: 0,
    usePrintMedia: false,
  },
  sign: { pageNumber: 1, x: 0, y: 0, width: 150, imageDataId: '' },
  'pdf-editor': { ops: [] },
  'pdf-forms': { ops: [] },
  watermark: {
    text: 'DRAFT',
    fontSize: 48,
    opacity: 0.2,
    rotation: 45,
    color: '#888888',
    position: 'center',
    scale: 0.5,
  },
  'page-numbers': {
    position: 'bottom-center',
    startAt: 1,
    pattern: 'Page {n} of {total}',
    font: 'helvetica',
    fontSize: 12,
    pages: 'all',
    margin: 20,
  },
  'header-footer': {
    pattern: '{n}',
    positions: ['footer-center'],
    font: 'helvetica',
    fontSize: 10,
    color: '#111111',
    margin: 20,
    pages: 'all',
    startAt: 1,
  },
  'bates-numbering': {
    style: 'full-bates',
    text: '',
    digits: 6,
    startFrom: 1,
    increment: 1,
    pageLocation: 'bottom-right',
    font: 'helvetica',
    fontSize: 10,
    color: '#111111',
    margin: 20,
  },
  crop: { margin: 0 },
  resize: { pageSize: 'a4', customWidth: 0, customHeight: 0, margin: 0, unit: 'pt' },
  flip: { mode: 'horizontal' },
  'n-up': { n: 2, pageOrdering: 'horizontal', preservePageSize: false },
  'extract-images': {},
  'edit-metadata': { title: '', author: '', subject: '', keywords: '', removeAll: false },
  'edit-bookmarks': { entries: [] },
  rename: { renamePattern: '{text}', areaY: 0, areaHeight: 10 },
  'remove-annotations': { annotationTypes: [] },
  flatten: { mode: 'forms', resolution: 150 },
  protect: {
    userPassword: '',
    ownerPassword: '',
    allowPrinting: true,
    allowCopying: false,
    allowModifying: false,
    allowAnnotating: false,
    allowFillingForms: false,
    allowAccessibility: true,
    allowAssembly: false,
  },
  unlock: { password: '' },
  compress: { quality: 'recommended' },
  grayscale: { compressImages: true },
  ocr: { lang: 'eng', outputFormat: 'pdf' },
  deskew: { onlyStronglySkewed: true },
  repair: {},
  workflows: { steps: [] },
}

// Slugs whose options are rendered by dedicated editors in the workspace.
export const SPECIAL_SLUGS = new Set(['sign', 'pdf-editor', 'pdf-forms', 'organize', 'workflows'])

// ---- tiny field helpers ----------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  type?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={Number.isFinite(value) ? String(value) : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = e.target.valueAsNumber
          onChange(Number.isFinite(n) ? n : 0)
        }}
      />
    </Field>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function BoolField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
    </div>
  )
}

const PAGES_HINT = 'Leave as "all" or enter ranges like 1-3, 5'
const ANNOTATION_TYPES = ['highlight', 'underline', 'strikethrough', 'squiggly', 'link', 'note', 'stamp', 'freehand']

const POSITION_OPTIONS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
].map((p) => ({
  value: p,
  label: p.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' '),
}))

const HF_POSITIONS = ['header-left', 'header-center', 'header-right', 'footer-left', 'footer-center', 'footer-right']

const FONT_OPTIONS = [
  { value: 'helvetica', label: 'Helvetica' },
  { value: 'times', label: 'Times' },
  { value: 'courier', label: 'Courier' },
]

// Shared "position on page" select (page-numbers, bates).
function PositionSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return <SelectField label={label} value={value} onChange={onChange} options={POSITION_OPTIONS} />
}

// ---- per-slug forms --------------------------------------------------------

export function ToolOptionsInner({
  slug,
  value,
  onChange,
}: {
  slug: string
  value: Params
  onChange: (next: Params) => void
}) {
  if (SPECIAL_SLUGS.has(slug)) return null
  const set = (patch: Params) => onChange({ ...value, ...patch })

  switch (slug) {
    case 'merge':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <BoolField
            label="Normalize page sizes"
            checked={value.normalizePageSizes === true}
            onChange={(v) => set({ normalizePageSizes: v })}
          />
          <BoolField
            label="Add blank page if odd number of pages"
            checked={value.blankPageIfOdd === true}
            onChange={(v) => set({ blankPageIfOdd: v })}
          />
        </div>
      )

    case 'split': {
      const v = value as { mode: string; ranges: string; step: number }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Split by"
            value={v.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'ranges', label: 'Page ranges' },
              { value: 'step', label: 'Every N pages' },
            ]}
          />
          {v.mode === 'ranges' ? (
            <TextField
              label="Ranges"
              value={v.ranges}
              onChange={(ranges) => set({ ranges })}
              placeholder="1-3, 5"
              hint="One output file per range"
            />
          ) : (
            <NumField label="Pages per file" value={v.step} min={1} onChange={(step) => set({ step })} />
          )}
        </div>
      )
    }

    case 'split-bookmarks': {
      const v = value as { level: number; expression: string; includePageAfter: boolean }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Bookmark level to split at" value={v.level} min={1} onChange={(level) => set({ level })} />
          <TextField
            label="Title filter (optional)"
            value={v.expression}
            onChange={(expression) => set({ expression })}
            hint="Only split at bookmarks whose title matches"
          />
          <BoolField
            label="Include the page after each split"
            checked={v.includePageAfter}
            onChange={(includePageAfter) => set({ includePageAfter })}
          />
        </div>
      )
    }

    case 'split-middle': {
      const v = value as { ratio: number; mode: string; repagination: boolean; rightToLeft: boolean }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Split position (%)" value={v.ratio} min={10} max={90} onChange={(ratio) => set({ ratio })} />
          <SelectField
            label="Direction"
            value={v.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'vertical', label: 'Vertical (left / right)' },
              { value: 'horizontal', label: 'Horizontal (top / bottom)' },
            ]}
          />
          <BoolField label="Repaginate for reading" checked={v.repagination} onChange={(repagination) => set({ repagination })} />
          <BoolField label="Right-to-left document" checked={v.rightToLeft} onChange={(rightToLeft) => set({ rightToLeft })} />
        </div>
      )
    }

    case 'split-size': {
      const v = value as { size: number; sizeUnit: string }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Max size per file" value={v.size} min={0.1} step={0.5} onChange={(size) => set({ size })} />
          <SelectField
            label="Unit"
            value={v.sizeUnit}
            onChange={(sizeUnit) => set({ sizeUnit })}
            options={[
              { value: 'MB', label: 'MB' },
              { value: 'KB', label: 'KB' },
            ]}
          />
        </div>
      )
    }

    case 'split-text': {
      const v = value as { areaY: number; areaHeight: number; startsWith: string }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Split when text starts with"
            value={v.startsWith}
            onChange={(startsWith) => set({ startsWith })}
            placeholder="Invoice"
          />
          <NumField label="Watch area — top (% of page height)" value={v.areaY} min={0} max={100} onChange={(areaY) => set({ areaY })} />
          <NumField label="Watch area — height (%)" value={v.areaHeight} min={1} max={100} onChange={(areaHeight) => set({ areaHeight })} />
        </div>
      )
    }

    case 'extract-pages':
    case 'delete-pages': {
      const v = value as { pages: string }
      return (
        <div className="grid gap-4">
          <TextField
            label="Pages"
            value={v.pages}
            onChange={(pages) => set({ pages })}
            placeholder="1-3, 5, 8-10"
            hint={PAGES_HINT}
          />
        </div>
      )
    }

    case 'alternate-mix': {
      const v = value as { step: number; reverse: boolean; repeat: boolean }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Take N pages from each file" value={v.step} min={1} onChange={(step) => set({ step })} />
          <BoolField label="Reverse second document" checked={v.reverse} onChange={(reverse) => set({ reverse })} />
          <BoolField label="Repeat until longest is exhausted" checked={v.repeat} onChange={(repeat) => set({ repeat })} />
        </div>
      )
    }

    case 'rotate': {
      const v = value as { angle: number; pages: string }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Rotate"
            value={String(v.angle)}
            onChange={(angle) => set({ angle: Number(angle) })}
            options={[
              { value: '90', label: '90° clockwise' },
              { value: '180', label: '180°' },
              { value: '270', label: '90° counter-clockwise' },
            ]}
          />
          <TextField label="Pages" value={v.pages} onChange={(pages) => set({ pages })} hint={PAGES_HINT} />
        </div>
      )
    }

    case 'jpg-to-pdf': {
      const v = value as { pageSize: string; orientation: string; margin: number; mergeOutputs: boolean }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Page size"
            value={v.pageSize}
            onChange={(pageSize) => set({ pageSize })}
            options={[
              { value: 'fit', label: 'Fit to image' },
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
            ]}
          />
          <SelectField
            label="Orientation"
            value={v.orientation}
            onChange={(orientation) => set({ orientation })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
          />
          <NumField label="Margin (pt)" value={v.margin} min={0} onChange={(margin) => set({ margin })} />
          <BoolField label="Merge all images into one PDF" checked={v.mergeOutputs} onChange={(mergeOutputs) => set({ mergeOutputs })} />
        </div>
      )
    }

    case 'pdf-to-jpg': {
      const v = value as { pages: string; resolution: number; imageFormat: string; grayscale: boolean }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Pages" value={v.pages} onChange={(pages) => set({ pages })} hint={PAGES_HINT} />
          <NumField label="Resolution (DPI)" value={v.resolution} min={36} max={600} onChange={(resolution) => set({ resolution })} />
          <SelectField
            label="Image format"
            value={v.imageFormat}
            onChange={(imageFormat) => set({ imageFormat })}
            options={[
              { value: 'jpg', label: 'JPG' },
              { value: 'png', label: 'PNG' },
              { value: 'tiff', label: 'TIFF' },
            ]}
          />
          <BoolField label="Grayscale" checked={v.grayscale} onChange={(grayscale) => set({ grayscale })} />
        </div>
      )
    }

    case 'pdf-to-ppt': {
      const v = value as { resolution: number }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Slide render resolution (DPI)" value={v.resolution} min={36} max={600} onChange={(resolution) => set({ resolution })} />
        </div>
      )
    }

    case 'pdf-to-excel': {
      const v = value as { exportFormat: string; singleSheet: boolean }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Output format"
            value={v.exportFormat}
            onChange={(exportFormat) => set({ exportFormat })}
            options={[
              { value: 'xlsx', label: 'Excel (XLSX)' },
              { value: 'csv', label: 'CSV' },
            ]}
          />
          <BoolField label="Put all tables on a single sheet" checked={v.singleSheet} onChange={(singleSheet) => set({ singleSheet })} />
        </div>
      )
    }

    case 'html-to-pdf': {
      const v = value as {
        source: string
        url: string
        htmlCode: string
        pageSize: string
        orientation: string
        viewportWidth: number
        margin: number
        delay: number
        usePrintMedia: boolean
      }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Source"
            value={v.source}
            onChange={(source) => set({ source })}
            options={[
              { value: 'url', label: 'Web page URL' },
              { value: 'file', label: 'Uploaded .html file' },
              { value: 'code', label: 'HTML code' },
            ]}
          />
          {v.source === 'url' ? (
            <TextField label="URL" value={v.url} onChange={(url) => set({ url })} placeholder="https://example.com" />
          ) : v.source === 'code' ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">HTML code</Label>
              <Textarea
                rows={6}
                value={v.htmlCode}
                onChange={(e) => set({ htmlCode: e.target.value })}
                placeholder="<html><body><h1>Hello</h1></body></html>"
                className="font-mono text-sm"
              />
            </div>
          ) : (
            <p className="self-end text-sm text-muted-foreground">
              Uses the .html file uploaded in the previous step.
            </p>
          )}
          <SelectField
            label="Page size"
            value={v.pageSize}
            onChange={(pageSize) => set({ pageSize })}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'Letter', label: 'Letter' },
            ]}
          />
          <SelectField
            label="Orientation"
            value={v.orientation}
            onChange={(orientation) => set({ orientation })}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
          />
          <NumField label="Viewport width (px)" value={v.viewportWidth} min={320} onChange={(viewportWidth) => set({ viewportWidth })} />
          <NumField label="Margin (mm)" value={v.margin} min={0} onChange={(margin) => set({ margin })} />
          <NumField label="Wait before render (ms)" value={v.delay} min={0} step={100} onChange={(delay) => set({ delay })} />
          <BoolField label="Use print media styles" checked={v.usePrintMedia} onChange={(usePrintMedia) => set({ usePrintMedia })} />
        </div>
      )
    }

    case 'watermark': {
      const v = value as {
        text: string
        fontSize: number
        opacity: number
        rotation: number
        color: string
        position: string
        scale: number
      }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Text" value={v.text} onChange={(text) => set({ text })} placeholder="DRAFT" />
          <div className="space-y-1.5">
            <Label className="text-sm">Color</Label>
            <Input type="color" value={v.color} onChange={(e) => set({ color: e.target.value })} className="h-9 p-1" />
          </div>
          <NumField label="Font size (pt)" value={v.fontSize} min={4} max={200} onChange={(fontSize) => set({ fontSize })} />
          <NumField label="Opacity (0-1)" value={v.opacity} min={0.05} max={1} step={0.05} onChange={(opacity) => set({ opacity })} />
          <NumField label="Rotation (degrees)" value={v.rotation} min={-180} max={180} step={5} onChange={(rotation) => set({ rotation })} />
          <SelectField
            label="Position"
            value={v.position}
            onChange={(position) => set({ position })}
            options={[
              { value: 'center', label: 'Center' },
              { value: 'top', label: 'Top' },
              { value: 'bottom', label: 'Bottom' },
              { value: 'tile', label: 'Tiled across page' },
            ]}
          />
          <NumField label="Scale (0-1)" value={v.scale} min={0.1} max={1} step={0.1} onChange={(scale) => set({ scale })} />
        </div>
      )
    }

    case 'page-numbers': {
      const v = value as {
        position: string
        startAt: number
        pattern: string
        font: string
        fontSize: number
        pages: string
        margin: number
      }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <PositionSelect label="Position" value={v.position} onChange={(position) => set({ position })} />
          <TextField label="Pattern" value={v.pattern} onChange={(pattern) => set({ pattern })} hint="{n} = page number, {total} = total pages" />
          <NumField label="Start numbering at" value={v.startAt} min={1} onChange={(startAt) => set({ startAt })} />
          <SelectField label="Font" value={v.font} onChange={(font) => set({ font })} options={FONT_OPTIONS} />
          <NumField label="Font size (pt)" value={v.fontSize} min={4} max={72} onChange={(fontSize) => set({ fontSize })} />
          <NumField label="Margin (pt)" value={v.margin} min={0} onChange={(margin) => set({ margin })} />
          <TextField label="Pages" value={v.pages} onChange={(pages) => set({ pages })} hint={PAGES_HINT} />
        </div>
      )
    }

    case 'header-footer': {
      const v = value as {
        pattern: string
        positions: string[]
        font: string
        fontSize: number
        color: string
        margin: number
        pages: string
        startAt: number
      }
      const toggle = (p: string, on: boolean) =>
        set({ positions: on ? [...v.positions, p] : v.positions.filter((x) => x !== p) })
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm">Positions</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {HF_POSITIONS.map((p) => (
                <BoolField
                  key={p}
                  label={p.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ')}
                  checked={v.positions.includes(p)}
                  onChange={(on) => toggle(p, on)}
                />
              ))}
            </div>
          </div>
          <TextField label="Pattern" value={v.pattern} onChange={(pattern) => set({ pattern })} hint="{n} = page number" />
          <NumField label="Start numbering at" value={v.startAt} min={1} onChange={(startAt) => set({ startAt })} />
          <SelectField label="Font" value={v.font} onChange={(font) => set({ font })} options={FONT_OPTIONS} />
          <div className="space-y-1.5">
            <Label className="text-sm">Color</Label>
            <Input type="color" value={v.color} onChange={(e) => set({ color: e.target.value })} className="h-9 p-1" />
          </div>
          <NumField label="Font size (pt)" value={v.fontSize} min={4} max={72} onChange={(fontSize) => set({ fontSize })} />
          <NumField label="Margin (pt)" value={v.margin} min={0} onChange={(margin) => set({ margin })} />
          <TextField label="Pages" value={v.pages} onChange={(pages) => set({ pages })} hint={PAGES_HINT} />
        </div>
      )
    }

    case 'bates-numbering': {
      const v = value as {
        style: string
        text: string
        digits: number
        startFrom: number
        increment: number
        pageLocation: string
        font: string
        fontSize: number
        color: string
        margin: number
      }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Style"
            value={v.style}
            onChange={(style) => set({ style })}
            options={[
              { value: 'full-bates', label: 'Bates numbering' },
              { value: 'bates-with-exhibit', label: 'Bates with exhibit' },
              { value: 'custom', label: 'Custom text' },
            ]}
          />
          {v.style !== 'full-bates' ? (
            <TextField
              label={v.style === 'custom' ? 'Custom text ({n} = number)' : 'Exhibit prefix'}
              value={v.text}
              onChange={(text) => set({ text })}
              placeholder={v.style === 'custom' ? 'DOC-{n}' : 'Exhibit A'}
            />
          ) : null}
          <NumField label="Digits" value={v.digits} min={1} max={12} onChange={(digits) => set({ digits })} />
          <NumField label="Start from" value={v.startFrom} min={1} onChange={(startFrom) => set({ startFrom })} />
          <NumField label="Increment" value={v.increment} min={1} onChange={(increment) => set({ increment })} />
          <PositionSelect label="Page location" value={v.pageLocation} onChange={(pageLocation) => set({ pageLocation })} />
          <SelectField label="Font" value={v.font} onChange={(font) => set({ font })} options={FONT_OPTIONS} />
          <NumField label="Font size (pt)" value={v.fontSize} min={4} max={72} onChange={(fontSize) => set({ fontSize })} />
          <NumField label="Margin (pt)" value={v.margin} min={0} onChange={(margin) => set({ margin })} />
        </div>
      )
    }

    case 'crop': {
      const v = value as { margin: number }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Margin to keep (pt)" value={v.margin} min={0} onChange={(margin) => set({ margin })} />
        </div>
      )
    }

    case 'resize': {
      const v = value as { pageSize: string; customWidth: number; customHeight: number; margin: number; unit: string }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Page size"
            value={v.pageSize}
            onChange={(pageSize) => set({ pageSize })}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'legal', label: 'Legal' },
              { value: 'a3', label: 'A3' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          {v.pageSize === 'custom' ? (
            <>
              <NumField label="Custom width" value={v.customWidth} min={1} onChange={(customWidth) => set({ customWidth })} />
              <NumField label="Custom height" value={v.customHeight} min={1} onChange={(customHeight) => set({ customHeight })} />
            </>
          ) : null}
          <SelectField
            label="Unit"
            value={v.unit}
            onChange={(unit) => set({ unit })}
            options={[
              { value: 'pt', label: 'Points' },
              { value: 'mm', label: 'Millimeters' },
              { value: 'in', label: 'Inches' },
            ]}
          />
          <NumField label="Margin" value={v.margin} min={0} onChange={(margin) => set({ margin })} />
        </div>
      )
    }

    case 'flip': {
      const v = value as { mode: string }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Flip"
            value={v.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'horizontal', label: 'Horizontally (mirror)' },
              { value: 'vertical', label: 'Vertically (upside-down)' },
            ]}
          />
        </div>
      )
    }

    case 'n-up': {
      const v = value as { n: number; pageOrdering: string; preservePageSize: boolean }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Pages per sheet"
            value={String(v.n)}
            onChange={(n) => set({ n: Number(n) })}
            options={[2, 3, 4, 6, 9].map((n) => ({ value: String(n), label: `${n} pages per sheet` }))}
          />
          <SelectField
            label="Page order"
            value={v.pageOrdering}
            onChange={(pageOrdering) => set({ pageOrdering })}
            options={[
              { value: 'horizontal', label: 'Horizontal (left to right)' },
              { value: 'vertical', label: 'Vertical (top to bottom)' },
            ]}
          />
          <BoolField label="Preserve original page size" checked={v.preservePageSize} onChange={(preservePageSize) => set({ preservePageSize })} />
        </div>
      )
    }

    case 'edit-metadata': {
      const v = value as { title: string; author: string; subject: string; keywords: string; removeAll: boolean }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Title" value={v.title} onChange={(title) => set({ title })} />
          <TextField label="Author" value={v.author} onChange={(author) => set({ author })} />
          <TextField label="Subject" value={v.subject} onChange={(subject) => set({ subject })} />
          <TextField label="Keywords" value={v.keywords} onChange={(keywords) => set({ keywords })} hint="Comma separated" />
          <BoolField label="Remove all metadata instead" checked={v.removeAll} onChange={(removeAll) => set({ removeAll })} />
        </div>
      )
    }

    case 'edit-bookmarks': {
      const v = value as { entries: { title: string; page: number; level: number }[] }
      const setEntry = (i: number, patch: Partial<{ title: string; page: number; level: number }>) =>
        set({ entries: v.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
      return (
        <div className="space-y-3">
          {v.entries.map((e, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input value={e.title} onChange={(ev) => setEntry(i, { title: ev.target.value })} />
              </div>
              <div className="w-20">
                <Label className="text-xs text-muted-foreground">Page</Label>
                <Input
                  type="number"
                  min={1}
                  value={String(e.page)}
                  onChange={(ev) => setEntry(i, { page: Math.max(1, Number(ev.target.valueAsNumber) || 1) })}
                />
              </div>
              <div className="w-16">
                <Label className="text-xs text-muted-foreground">Level</Label>
                <Input
                  type="number"
                  min={1}
                  value={String(e.level)}
                  onChange={(ev) => setEntry(i, { level: Math.max(1, Number(ev.target.valueAsNumber) || 1) })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove bookmark ${e.title || i + 1}`}
                onClick={() => set({ entries: v.entries.filter((_, j) => j !== i) })}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set({ entries: [...v.entries, { title: '', page: 1, level: 1 }] })}
          >
            <Plus className="size-4" /> Add bookmark
          </Button>
        </div>
      )
    }

    case 'rename': {
      const v = value as { renamePattern: string; areaY: number; areaHeight: number }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Filename pattern"
            value={v.renamePattern}
            onChange={(renamePattern) => set({ renamePattern })}
            hint="{text} = matched text, {original} = current name"
          />
          <NumField label="Search area — top (% of page height)" value={v.areaY} min={0} max={100} onChange={(areaY) => set({ areaY })} />
          <NumField label="Search area — height (%)" value={v.areaHeight} min={1} max={100} onChange={(areaHeight) => set({ areaHeight })} />
        </div>
      )
    }

    case 'remove-annotations': {
      const v = value as { annotationTypes: string[] }
      const toggle = (t: string, on: boolean) =>
        set({ annotationTypes: on ? [...v.annotationTypes, t] : v.annotationTypes.filter((x) => x !== t) })
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ANNOTATION_TYPES.map((t) => (
            <BoolField
              key={t}
              label={t[0].toUpperCase() + t.slice(1)}
              checked={v.annotationTypes.includes(t)}
              onChange={(on) => toggle(t, on)}
            />
          ))}
        </div>
      )
    }

    case 'flatten': {
      const v = value as { mode: string; resolution: number }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Mode"
            value={v.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'forms', label: 'Flatten form fields only' },
              { value: 'rasterize', label: 'Rasterize pages (print & scan)' },
            ]}
          />
          {v.mode === 'rasterize' ? (
            <NumField label="Raster resolution (DPI)" value={v.resolution} min={36} max={600} onChange={(resolution) => set({ resolution })} />
          ) : null}
        </div>
      )
    }

    case 'protect': {
      const v = value as {
        userPassword: string
        ownerPassword: string
        allowPrinting: boolean
        allowCopying: boolean
        allowModifying: boolean
        allowAnnotating: boolean
        allowFillingForms: boolean
        allowAccessibility: boolean
        allowAssembly: boolean
      }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Password" type="password" value={v.userPassword} onChange={(userPassword) => set({ userPassword })} />
          <TextField label="Owner password (optional)" type="password" value={v.ownerPassword} onChange={(ownerPassword) => set({ ownerPassword })} />
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-sm">Allow readers to</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <BoolField label="Print" checked={v.allowPrinting} onChange={(allowPrinting) => set({ allowPrinting })} />
              <BoolField label="Copy text and images" checked={v.allowCopying} onChange={(allowCopying) => set({ allowCopying })} />
              <BoolField label="Modify" checked={v.allowModifying} onChange={(allowModifying) => set({ allowModifying })} />
              <BoolField label="Annotate" checked={v.allowAnnotating} onChange={(allowAnnotating) => set({ allowAnnotating })} />
              <BoolField label="Fill forms" checked={v.allowFillingForms} onChange={(allowFillingForms) => set({ allowFillingForms })} />
              <BoolField label="Content accessibility" checked={v.allowAccessibility} onChange={(allowAccessibility) => set({ allowAccessibility })} />
              <BoolField label="Document assembly" checked={v.allowAssembly} onChange={(allowAssembly) => set({ allowAssembly })} />
            </div>
          </div>
        </div>
      )
    }

    case 'unlock': {
      const v = value as { password: string }
      return (
        <div className="grid gap-4">
          <TextField
            label="Password"
            type="password"
            value={v.password}
            onChange={(password) => set({ password })}
            hint="Leave empty if the PDF only has owner restrictions"
          />
        </div>
      )
    }

    case 'compress': {
      const v = value as { quality: string }
      return (
        <div className="grid gap-4">
          <SelectField
            label="Compression level"
            value={v.quality}
            onChange={(quality) => set({ quality })}
            options={[
              { value: 'extremely', label: 'Extreme — smallest file, lower quality' },
              { value: 'recommended', label: 'Recommended — good balance' },
              { value: 'good', label: 'Good quality' },
              { value: 'great', label: 'Great quality' },
              { value: 'lossless', label: 'Lossless — no quality loss' },
            ]}
          />
        </div>
      )
    }

    case 'grayscale': {
      const v = value as { compressImages: boolean }
      return (
        <div className="grid gap-4">
          <BoolField label="Also compress images" checked={v.compressImages} onChange={(compressImages) => set({ compressImages })} />
        </div>
      )
    }

    case 'ocr': {
      const v = value as { lang: string; outputFormat: string }
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Language"
            value={v.lang}
            onChange={() => {}}
            options={[{ value: 'eng', label: 'English' }]}
            hint="English only in this build"
          />
          <SelectField
            label="Output"
            value={v.outputFormat}
            onChange={(outputFormat) => set({ outputFormat })}
            options={[
              { value: 'pdf', label: 'Searchable PDF' },
              { value: 'text', label: 'Plain text' },
              { value: 'both', label: 'PDF and text' },
            ]}
          />
        </div>
      )
    }

    case 'deskew': {
      const v = value as { onlyStronglySkewed: boolean }
      return (
        <div className="grid gap-4">
          <BoolField
            label="Only fix strongly skewed pages"
            checked={v.onlyStronglySkewed}
            onChange={(onlyStronglySkewed) => set({ onlyStronglySkewed })}
          />
        </div>
      )
    }

    // pdf-to-text, pdf-to-word, word-to-pdf, extract-images, repair: no options
    default:
      return <p className="text-sm text-muted-foreground">This tool has no options.</p>
  }
}

// Minimal client-side required-field checks (server re-validates).
export function optionError(slug: string, params: Params): string | null {
  const v = params as Record<string, string | number | boolean | unknown[]>
  switch (slug) {
    case 'split':
      return v.mode === 'ranges' && !String(v.ranges).trim() ? 'Enter at least one page range.' : null
    case 'extract-pages':
    case 'delete-pages':
      return !String(v.pages).trim() ? 'Enter the pages to process.' : null
    case 'protect':
      return !String(v.userPassword) ? 'Set a password.' : null
    case 'watermark':
      return !String(v.text).trim() ? 'Enter watermark text.' : null
    case 'split-text':
      return !String(v.startsWith).trim() ? 'Enter the text to watch for.' : null
    case 'rename':
      return !String(v.renamePattern).trim() ? 'Enter a filename pattern.' : null
    case 'html-to-pdf':
      if (v.source === 'url' && !String(v.url).trim()) return 'Enter a URL.'
      if (v.source === 'code' && !String(v.htmlCode).trim()) return 'Enter HTML code.'
      return null
    case 'edit-bookmarks':
      return (v.entries as unknown[]).length === 0 ? 'Add at least one bookmark.' : null
    case 'bates-numbering':
      if (v.style === 'custom' && !String(v.text).trim()) return 'Enter the custom text pattern.'
      if (v.style === 'bates-with-exhibit' && !String(v.text).trim()) return 'Enter the exhibit prefix.'
      return null
    default:
      return null
  }
}

export function ToolOptions({
  slug,
  onRun,
  running,
}: {
  slug: string
  onRun: (params: Params) => void
  running: boolean
}) {
  const [params, setParams] = useState<Params>(() => ({ ...PARAM_DEFAULTS[slug] }))
  const error = optionError(slug, params)

  return (
    <div className="space-y-4">
      <ToolOptionsInner slug={slug} value={params} onChange={setParams} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button onClick={() => onRun(params)} disabled={running || !!error}>
        {running ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        Run
      </Button>
    </div>
  )
}
