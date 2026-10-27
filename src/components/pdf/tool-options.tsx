'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { SignaturePad } from './signature-pad'
import { TOOLS, getTool, isChainable, type ToolDef } from '@/lib/pdf-tools/registry'

export type ParamBag = Record<string, unknown>

export const PARAM_DEFAULTS: ParamBag = {
  compress: { quality: 'recommended' },
  'pdf-editor': { ops: [], editorKind: 'text', editorText: 'Type here', editorFontSize: 14, editorColor: '#111111', editorRectWidth: 200, editorRectHeight: 40, editorImageId: '' },
  sign: { pageNumber: 1, x: 0, y: 0, width: 150, imageDataId: '' },
  'pdf-forms': { ops: [], fieldName: '', fieldWidth: 160 },
  'delete-pages': { pages: '' },
  'extract-pages': { pages: '' },
  split: { mode: 'ranges', ranges: '', step: 1 },
  'split-bookmarks': { level: 1, expression: '', includePageAfter: false },
  'split-middle': { ratio: 0.5, mode: 'vertical', repagination: false, rightToLeft: false },
  'split-size': { size: 5, sizeUnit: 'MB' },
  'split-text': { areaY: 40, areaHeight: 60, startsWith: '' },
  merge: { normalizePageSizes: false, blankPageIfOdd: false },
  'alternate-mix': { step: 1, reverse: false, repeat: false },
  organize: { order: [] },
  protect: { userPassword: '', ownerPassword: '', allowPrinting: true, allowCopying: false, allowModifying: false, allowAnnotating: false, allowFillingForms: true, allowAccessibility: true, allowAssembly: false },
  unlock: { password: '' },
  watermark: { text: 'DRAFT', fontSize: 48, opacity: 0.5, rotation: 45, color: '#B23B3B', position: 'center', imageDataId: '', scale: 0.5 },
  flatten: { mode: 'forms', resolution: 150 },
  'pdf-to-excel': { exportFormat: 'xlsx', singleSheet: false },
  'pdf-to-jpg': { pages: '', resolution: 150, imageFormat: 'jpg', grayscale: false },
  'pdf-to-ppt': { resolution: 150 },
  'pdf-to-text': {},
  'pdf-to-word': {},
  'html-to-pdf': { source: 'url', url: '', htmlCode: '', pageSize: 'A4', orientation: 'portrait', viewportWidth: 1280, margin: 10, delay: 0, usePrintMedia: false },
  'jpg-to-pdf': { pageSize: 'fit', orientation: 'auto', margin: 0, mergeOutputs: true },
  'word-to-pdf': {},
  'bates-numbering': { style: 'full-bates', text: 'BATES', digits: 6, startFrom: 1, increment: 1, pageLocation: 'bottom-right', font: 'helvetica', fontSize: 10, color: '#000000', margin: 24 },
  'edit-bookmarks': { entries: [] },
  'edit-metadata': { title: '', author: '', subject: '', keywords: '', removeAll: false },
  'extract-images': {},
  flip: { mode: 'horizontal' },
  grayscale: { compressImages: true },
  'header-footer': { pattern: 'Page [PAGE_ARABIC]', positions: ['top-center'], font: 'times', fontSize: 10, color: '#000000', margin: 24, pages: '', startAt: 1 },
  'n-up': { n: 4, pageOrdering: 'horizontal', preservePageSize: false },
  'page-numbers': { position: 'bottom-center', startAt: 1, pattern: '[PAGE_ARABIC]', font: 'helvetica', fontSize: 12, pages: '', margin: 24 },
  rename: { renamePattern: '[TEXT]', areaY: 40, areaHeight: 60 },
  repair: {},
  resize: { pageSize: 'a4', customWidth: 595, customHeight: 842, margin: 0, unit: 'pt' },
  rotate: { angle: 90, pages: '' },
  'remove-annotations': { annotationTypes: ['highlight', 'note', 'freetext'] },
  deskew: { onlyStronglySkewed: false },
  ocr: { lang: 'eng', outputFormat: 'pdf' },
  workflows: { steps: [] },
}

interface Props {
  tool: ToolDef
  params: ParamBag
  onChange: (patch: ParamBag) => void
  onSignatureBlob: (blob: Blob | null) => void
  signatureReady: boolean
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function NumRow({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; format?: (n: number) => string }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-3">
        <Slider value={[value]} min={min} max={max} step={step ?? 1} onValueChange={([v]) => onChange(v)} className="flex-1" />
        <span className="w-14 text-right text-sm tabular-nums text-muted-foreground">{format ? format(value) : value}</span>
      </div>
    </Row>
  )
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </Row>
  )
}

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

const POS_OPTS = [
  { value: 'top-left', label: 'Top left' }, { value: 'top-center', label: 'Top center' }, { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' }, { value: 'bottom-center', label: 'Bottom center' }, { value: 'bottom-right', label: 'Bottom right' },
]
const FONT_OPTS = [{ value: 'helvetica', label: 'Helvetica' }, { value: 'times', label: 'Times New Roman' }, { value: 'courier', label: 'Courier' }]
const PATTERN_HINT = 'Placeholders: [PAGE_ARABIC], [PAGE_ROMAN], [TOTAL_PAGES_ARABIC], [BASE_NAME]'

export function ToolOptionsInner({ tool, params, onChange, onSignatureBlob, signatureReady }: Props) {
  const p = params
  const set = onChange
  switch (tool.slug) {
    // --- compress ---
    case 'compress':
      return (
        <Sel label="Optimization level" value={String(p.quality)} onChange={(v) => set({ quality: v })} options={[
          { value: 'extremely', label: 'Extremely small — 72 dpi images (for screens only)' },
          { value: 'recommended', label: 'Recommended — 150 dpi images' },
          { value: 'good', label: 'Good quality — 300 dpi images' },
          { value: 'great', label: 'Great quality — 300 dpi, high-fidelity color' },
          { value: 'lossless', label: 'Lossless — structure optimization only' },
        ]} />
      )
    // --- edit & sign ---
    case 'pdf-editor':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Pick an element type, set its style, then click on the page preview above to place it. Repeat as often as you like.</p>
          <Sel label="Element type" value={String(p.editorKind)} onChange={(v) => set({ editorKind: v })} options={[
            { value: 'text', label: 'Text' }, { value: 'rect', label: 'White-out box / rectangle' }, { value: 'image', label: 'Image' },
          ]} />
          {p.editorKind === 'text' && (
            <>
              <Row label="Text"><Input value={String(p.editorText ?? '')} onChange={(e) => set({ editorText: e.target.value })} maxLength={2000} /></Row>
              <NumRow label="Font size" value={Number(p.editorFontSize)} min={6} max={72} onChange={(n) => set({ editorFontSize: n })} format={(n) => `${n} pt`} />
            </>
          )}
          {p.editorKind === 'rect' && (
            <>
              <NumRow label="Box width" value={Number(p.editorRectWidth)} min={10} max={800} onChange={(n) => set({ editorRectWidth: n })} format={(n) => `${n} pt`} />
              <NumRow label="Box height" value={Number(p.editorRectHeight)} min={5} max={400} onChange={(n) => set({ editorRectHeight: n })} format={(n) => `${n} pt`} />
            </>
          )}
          {p.editorKind === 'image' && (
            <Row label="Image" hint="Upload a PNG or JPG, then click on the page to place it.">
              <input type="file" accept="image/png,image/jpeg" className="text-sm" onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) onSignatureBlob(f)
              }} />
            </Row>
          )}
          {p.editorKind !== 'rect' && (
            <Row label={p.editorKind === 'rect' ? 'Fill color' : 'Color'}>
              <input type="color" value={String(p.editorColor)} onChange={(e) => set({ editorColor: e.target.value })} className="h-9 w-20 cursor-pointer rounded-md border" aria-label="Element color" />
            </Row>
          )}
          <p className="text-xs text-muted-foreground">{Array.isArray(p.ops) ? p.ops.length : 0} element(s) placed so far.</p>
        </div>
      )
    case 'sign':
      return (
        <div className="space-y-4">
          <SignaturePad onChange={onSignatureBlob} />
          <p className="text-xs text-muted-foreground">{signatureReady ? 'Signature uploaded — click its position on the page preview above.' : 'Draw a signature, then click its position on the page preview above.'}</p>
          <NumRow label="Signature width" value={Number(p.width)} min={40} max={400} onChange={(n) => set({ width: n })} format={(n) => `${n} pt`} />
        </div>
      )
    case 'pdf-forms':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Click on the page preview above to place text fields where users should type.</p>
          <Row label="Field name (optional)" hint="Leave empty to auto-name fields Field 1, Field 2, …">
            <Input value={String(p.fieldName ?? '')} onChange={(e) => set({ fieldName: e.target.value })} maxLength={100} />
          </Row>
          <NumRow label="Field width" value={Number(p.fieldWidth)} min={40} max={500} onChange={(n) => set({ fieldWidth: n })} format={(n) => `${n} pt`} />
          <p className="text-xs text-muted-foreground">{Array.isArray(p.ops) ? p.ops.length : 0} field(s) placed so far.</p>
        </div>
      )
    case 'delete-pages':
      return <p className="text-sm text-muted-foreground">Click pages above to mark them for deletion.</p>
    case 'extract-pages':
      return <p className="text-sm text-muted-foreground">Click pages above — the selected ones become a new PDF.</p>
    // --- split ---
    case 'split':
      return (
        <div className="space-y-4">
          <Sel label="Split mode" value={String(p.mode)} onChange={(v) => set({ mode: v })} options={[
            { value: 'ranges', label: 'By page ranges' },
            { value: 'step', label: 'By fixed step — every N pages' },
          ]} />
          {p.mode === 'ranges' ? (
            <Row label="Page ranges" hint="One output file per range — e.g. 1-3, 4-6, 7">
              <Input value={String(p.ranges ?? '')} onChange={(e) => set({ ranges: e.target.value })} placeholder="1-3,4-6,7" />
            </Row>
          ) : (
            <NumRow label="Pages per document" value={Number(p.step)} min={1} max={100} onChange={(n) => set({ step: n })} format={(n) => (n === 1 ? '1 page each' : `${n} pages each`)} />
          )}
        </div>
      )
    case 'split-bookmarks':
      return (
        <div className="space-y-4">
          <NumRow label="Bookmark level to split on" value={Number(p.level)} min={1} max={4} onChange={(n) => set({ level: n })} />
          <Row label="Only bookmark titles containing (optional)">
            <Input value={String(p.expression ?? '')} onChange={(e) => set({ expression: e.target.value })} placeholder="Chapter" maxLength={100} />
          </Row>
          <Check label="Include the page after each section" checked={p.includePageAfter === true} onChange={(v) => set({ includePageAfter: v })} hint="Extends every section into the next section's first page" />
        </div>
      )
    case 'split-middle':
      return (
        <div className="space-y-4">
          <Sel label="Cut direction" value={String(p.mode)} onChange={(v) => set({ mode: v })} options={[
            { value: 'vertical', label: 'Vertical — left and right halves' },
            { value: 'horizontal', label: 'Horizontal — top and bottom halves' },
          ]} />
          <NumRow label="Cut position" value={Number(p.ratio)} min={0.2} max={0.8} step={0.05} onChange={(n) => set({ ratio: n })} format={(n) => `${Math.round(n * 100)}%`} />
          <Check label="Repaginate" checked={p.repagination === true} onChange={(v) => set({ repagination: v })} hint="Interleave halves: left 1, right 1, left 2, right 2…" />
          <Check label="Right-to-left document" checked={p.rightToLeft === true} onChange={(v) => set({ rightToLeft: v })} hint="Right half comes first (Manga, Hebrew, Arabic scans)" />
        </div>
      )
    case 'split-size':
      return (
        <div className="space-y-4">
          <Row label="Maximum size per document">
            <div className="flex gap-2">
              <Input type="number" min={0.01} step="any" value={Number(p.size)} onChange={(e) => set({ size: Number(e.target.value) })} className="w-28" />
              <Select value={String(p.sizeUnit)} onValueChange={(v) => set({ sizeUnit: v })}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MB">MB</SelectItem><SelectItem value="KB">KB</SelectItem></SelectContent>
              </Select>
            </div>
          </Row>
          <p className="text-xs text-muted-foreground">Sizes are estimated from average page weight — each output is verified after packing.</p>
        </div>
      )
    case 'split-text':
      return (
        <div className="space-y-4">
          <Row label="Text at the start of each document" hint="A new document starts on every page whose text (inside the strip below) begins with this">
            <Input value={String(p.startsWith ?? '')} onChange={(e) => set({ startsWith: e.target.value })} placeholder="Invoice number" maxLength={100} />
          </Row>
          <NumRow label="Strip top offset" value={Number(p.areaY)} min={0} max={800} onChange={(n) => set({ areaY: n })} format={(n) => `${n} pt`} />
          <NumRow label="Strip height" value={Number(p.areaHeight)} min={5} max={800} onChange={(n) => set({ areaHeight: n })} format={(n) => `${n} pt`} />
        </div>
      )
    // --- merge ---
    case 'merge':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Files are combined in the order shown above.</p>
          <Check label="Normalize page sizes" checked={p.normalizePageSizes === true} onChange={(v) => set({ normalizePageSizes: v })} hint="Scale every page to the first file's page size" />
          <Check label="Add a blank page after odd-page documents" checked={p.blankPageIfOdd === true} onChange={(v) => set({ blankPageIfOdd: v })} hint="Keeps double-sided printing aligned" />
        </div>
      )
    case 'alternate-mix':
      return (
        <div className="space-y-4">
          <NumRow label="Pages per step" value={Number(p.step)} min={1} max={20} onChange={(n) => set({ step: n })} />
          <Check label="Reverse each document" checked={p.reverse === true} onChange={(v) => set({ reverse: v })} />
          <Check label="Repeat shorter documents" checked={p.repeat === true} onChange={(v) => set({ repeat: v })} hint="Cycle them until the longest document is exhausted" />
        </div>
      )
    case 'organize':
      return <p className="text-sm text-muted-foreground">Drag pages above into the order you want.</p>
    // --- security ---
    case 'protect':
      return (
        <div className="space-y-4">
          <Row label="Password" hint="Needed to open the PDF. If you lose it, it cannot be recovered.">
            <Input type="password" value={String(p.userPassword ?? '')} onChange={(e) => set({ userPassword: e.target.value })} maxLength={128} />
          </Row>
          <Row label="Owner password (optional)" hint="Controls permissions; defaults to the open password.">
            <Input type="password" value={String(p.ownerPassword ?? '')} onChange={(e) => set({ ownerPassword: e.target.value })} maxLength={128} />
          </Row>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Check label="Allow printing" checked={p.allowPrinting !== false} onChange={(v) => set({ allowPrinting: v })} />
            <Check label="Allow copying text" checked={p.allowCopying === true} onChange={(v) => set({ allowCopying: v })} />
            <Check label="Allow modifying" checked={p.allowModifying === true} onChange={(v) => set({ allowModifying: v })} />
            <Check label="Allow annotating" checked={p.allowAnnotating === true} onChange={(v) => set({ allowAnnotating: v })} />
            <Check label="Allow filling forms" checked={p.allowFillingForms !== false} onChange={(v) => set({ allowFillingForms: v })} />
            <Check label="Allow screen readers" checked={p.allowAccessibility !== false} onChange={(v) => set({ allowAccessibility: v })} />
            <Check label="Allow page assembly" checked={p.allowAssembly === true} onChange={(v) => set({ allowAssembly: v })} />
          </div>
        </div>
      )
    case 'unlock':
      return (
        <Row label="Password" hint="Leave empty if the PDF opens without one (permissions-only lock).">
          <Input type="password" value={String(p.password ?? '')} onChange={(e) => set({ password: e.target.value })} maxLength={128} />
        </Row>
      )
    case 'watermark': {
      const imageMode = Boolean(p.imageDataId)
      return (
        <div className="space-y-4">
          <Row label="Text" hint={imageMode ? 'Using an image watermark — clear the image below to switch back to text.' : undefined}>
            <Input value={String(p.text ?? '')} onChange={(e) => set({ text: e.target.value })} placeholder="DRAFT" maxLength={100} />
          </Row>
          <Row label="…or use an image watermark">
            {imageMode ? (
              <Button type="button" variant="outline" size="sm" onClick={() => set({ imageDataId: '' })}>Remove image and use text</Button>
            ) : (
              <input type="file" accept="image/png,image/jpeg" className="text-sm" onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) onSignatureBlob(f)
              }} />
            )}
          </Row>
          {imageMode && <NumRow label="Image width (share of page)" value={Number(p.scale)} min={0.1} max={1} step={0.05} onChange={(n) => set({ scale: n })} format={(n) => `${Math.round(n * 100)}%`} />}
          <Sel label="Position" value={String(p.position)} onChange={(v) => set({ position: v })} options={[
            { value: 'center', label: 'Center' }, { value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }, { value: 'tile', label: 'Tiled across the page' },
          ]} />
          {!imageMode && <NumRow label="Font size" value={Number(p.fontSize)} min={8} max={200} onChange={(n) => set({ fontSize: n })} format={(n) => `${n} pt`} />}
          <NumRow label="Opacity" value={Number(p.opacity)} min={0.05} max={1} step={0.05} onChange={(n) => set({ opacity: n })} format={(n) => `${Math.round(n * 100)}%`} />
          <NumRow label="Rotation" value={Number(p.rotation)} min={-180} max={180} onChange={(n) => set({ rotation: n })} format={(n) => `${n}°`} />
          {!imageMode && (
            <Row label="Color">
              <input type="color" value={String(p.color)} onChange={(e) => set({ color: e.target.value })} className="h-9 w-20 cursor-pointer rounded-md border" aria-label="Watermark color" />
            </Row>
          )}
        </div>
      )
    }
    case 'flatten':
      return (
        <div className="space-y-4">
          <Sel label="Flatten mode" value={String(p.mode)} onChange={(v) => set({ mode: v })} options={[
            { value: 'forms', label: 'Form fields only — keeps text vector-sharp' },
            { value: 'rasterize', label: 'Rasterize everything — print & scan in one step' },
          ]} />
          {p.mode === 'rasterize' && <NumRow label="Raster resolution" value={Number(p.resolution)} min={72} max={300} onChange={(n) => set({ resolution: n })} format={(n) => `${n} dpi`} />}
        </div>
      )
    // --- convert from PDF ---
    case 'pdf-to-excel':
      return (
        <div className="space-y-4">
          <Sel label="Output format" value={String(p.exportFormat)} onChange={(v) => set({ exportFormat: v })} options={[
            { value: 'xlsx', label: 'Excel (.xlsx)' }, { value: 'csv', label: 'CSV' },
          ]} />
          <Check label="Single sheet" checked={p.singleSheet === true} onChange={(v) => set({ singleSheet: v })} hint="Merge all pages into one sheet instead of one sheet per page" />
          <p className="text-xs text-muted-foreground">Tables are detected from text positions — works best on simple, well-aligned tables.</p>
        </div>
      )
    case 'pdf-to-jpg':
      return (
        <div className="space-y-4">
          <Sel label="Image format" value={String(p.imageFormat)} onChange={(v) => set({ imageFormat: v })} options={[
            { value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'tiff', label: 'TIFF' },
          ]} />
          <NumRow label="Resolution" value={Number(p.resolution)} min={30} max={300} step={10} onChange={(n) => set({ resolution: n })} format={(n) => `${n} dpi`} />
          <Check label="Grayscale" checked={p.grayscale === true} onChange={(v) => set({ grayscale: v })} />
          <Row label="Pages" hint="Leave empty to convert all pages">
            <Input value={String(p.pages ?? '')} onChange={(e) => set({ pages: e.target.value })} placeholder="all pages" />
          </Row>
        </div>
      )
    case 'pdf-to-ppt':
      return <NumRow label="Slide image resolution" value={Number(p.resolution)} min={50} max={300} step={10} onChange={(n) => set({ resolution: n })} format={(n) => `${n} dpi`} />
    case 'pdf-to-text':
      return <p className="text-sm text-muted-foreground">All text is extracted into one .txt file, one section per page.</p>
    case 'pdf-to-word':
      return <p className="text-sm text-muted-foreground">Paragraphs and reading order are converted into an editable .docx — best for text-centric documents.</p>
    // --- convert to PDF ---
    case 'html-to-pdf':
      return (
        <div className="space-y-4">
          <Sel label="Source" value={String(p.source)} onChange={(v) => set({ source: v })} options={[
            { value: 'url', label: 'Web page URL' }, { value: 'file', label: 'Uploaded HTML file' }, { value: 'code', label: 'Pasted HTML code' },
          ]} />
          {p.source === 'url' && (
            <Row label="URL"><Input value={String(p.url ?? '')} onChange={(e) => set({ url: e.target.value })} placeholder="https://example.com" /></Row>
          )}
          {p.source === 'code' && (
            <Row label="HTML"><Textarea rows={6} value={String(p.htmlCode ?? '')} onChange={(e) => set({ htmlCode: e.target.value })} placeholder="<h1>Hello</h1>" /></Row>
          )}
          {p.source === 'file' && <p className="text-sm text-muted-foreground">Upload an .html file above.</p>}
          <div className="grid grid-cols-2 gap-3">
            <Sel label="Page size" value={String(p.pageSize)} onChange={(v) => set({ pageSize: v })} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'US Letter' }]} />
            <Sel label="Orientation" value={String(p.orientation)} onChange={(v) => set({ orientation: v })} options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
          </div>
          <NumRow label="Viewport width" value={Number(p.viewportWidth)} min={320} max={1920} step={10} onChange={(n) => set({ viewportWidth: n })} format={(n) => `${n} px`} />
          <NumRow label="Page margin" value={Number(p.margin)} min={0} max={50} onChange={(n) => set({ margin: n })} format={(n) => `${n} pt`} />
          <NumRow label="Wait before printing" value={Number(p.delay)} min={0} max={10} step={0.5} onChange={(n) => set({ delay: n })} format={(n) => `${n}s`} />
          <Check label="Use print media styles" checked={p.usePrintMedia === true} onChange={(v) => set({ usePrintMedia: v })} />
        </div>
      )
    case 'jpg-to-pdf':
      return (
        <div className="space-y-4">
          <Sel label="Page size" value={String(p.pageSize)} onChange={(v) => set({ pageSize: v })} options={[{ value: 'fit', label: 'Fit to image' }, { value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} />
          <Sel label="Orientation" value={String(p.orientation)} onChange={(v) => set({ orientation: v })} options={[{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
          <NumRow label="Margin" value={Number(p.margin)} min={0} max={100} onChange={(n) => set({ margin: n })} format={(n) => `${n} pt`} />
          <Check label="Merge into one PDF" checked={p.mergeOutputs !== false} onChange={(v) => set({ mergeOutputs: v })} hint="Uncheck to get one PDF per image (as a ZIP)" />
        </div>
      )
    case 'word-to-pdf':
      return <p className="text-sm text-muted-foreground">Converted with LibreOffice on the server. Password-protected .docx files must be unlocked first.</p>
    // --- other ---
    case 'crop':
      return <NumRow label="Keep this margin around the content" value={Number(p.margin)} min={0} max={100} onChange={(n) => set({ margin: n })} format={(n) => `${n} pt`} />
    case 'bates-numbering':
      return (
        <div className="space-y-4">
          <Sel label="Style" value={String(p.style)} onChange={(v) => set({ style: v })} options={[
            { value: 'full-bates', label: 'BATES_000001' },
            { value: 'bates-with-exhibit', label: 'EXHIBIT_A_00001 (use the text field for the exhibit label)' },
            { value: 'custom', label: 'Custom pattern with [BATES] placeholder' },
          ]} />
          <Row label={p.style === 'custom' ? 'Pattern' : 'Prefix text'} hint={p.style === 'custom' ? 'Use [BATES] where the number goes, e.g. CASE-42-[BATES]' : undefined}>
            <Input value={String(p.text ?? '')} onChange={(e) => set({ text: e.target.value })} maxLength={100} />
          </Row>
          <NumRow label="Number padding" value={Number(p.digits)} min={1} max={9} onChange={(n) => set({ digits: n })} format={(n) => `${n} digit(s)`} />
          <div className="grid grid-cols-2 gap-3">
            <Row label="Start from"><Input type="number" min={0} value={Number(p.startFrom)} onChange={(e) => set({ startFrom: Number(e.target.value) })} /></Row>
            <Row label="Increment"><Input type="number" min={1} value={Number(p.increment)} onChange={(e) => set({ increment: Number(e.target.value) })} /></Row>
          </div>
          <Sel label="Position" value={String(p.pageLocation)} onChange={(v) => set({ pageLocation: v })} options={POS_OPTS} />
          <div className="grid grid-cols-2 gap-3">
            <Sel label="Font" value={String(p.font)} onChange={(v) => set({ font: v })} options={FONT_OPTS} />
            <NumRow label="Font size" value={Number(p.fontSize)} min={6} max={72} onChange={(n) => set({ fontSize: n })} format={(n) => `${n} pt`} />
          </div>
          <Row label="Color">
            <input type="color" value={String(p.color)} onChange={(e) => set({ color: e.target.value })} className="h-9 w-20 cursor-pointer rounded-md border" aria-label="Bates color" />
          </Row>
        </div>
      )
    case 'edit-bookmarks':
      return <BookmarksEditor params={p} onChange={set} />
    case 'edit-metadata':
      return (
        <div className="space-y-4">
          <Row label="Title"><Input value={String(p.title ?? '')} onChange={(e) => set({ title: e.target.value })} maxLength={300} /></Row>
          <Row label="Author"><Input value={String(p.author ?? '')} onChange={(e) => set({ author: e.target.value })} maxLength={300} /></Row>
          <Row label="Subject"><Input value={String(p.subject ?? '')} onChange={(e) => set({ subject: e.target.value })} maxLength={500} /></Row>
          <Row label="Keywords" hint="Comma-separated"><Input value={String(p.keywords ?? '')} onChange={(e) => set({ keywords: e.target.value })} maxLength={300} /></Row>
          <Check label="Remove all metadata instead" checked={p.removeAll === true} onChange={(v) => set({ removeAll: v })} />
        </div>
      )
    case 'extract-images':
      return <p className="text-sm text-muted-foreground">Embedded JPG and PNG images are exported; duplicates are removed. Images in exotic encodings (JPEG2000, CCITT) are skipped and reported.</p>
    case 'flip':
      return (
        <Sel label="Mirror direction" value={String(p.mode)} onChange={(v) => set({ mode: v })} options={[
          { value: 'horizontal', label: 'Horizontal — left/right mirror' },
          { value: 'vertical', label: 'Vertical — top/bottom mirror' },
        ]} />
      )
    case 'grayscale':
      return <Check label="Also recompress images" checked={p.compressImages !== false} onChange={(v) => set({ compressImages: v })} hint="Shrinks the file further at 150 dpi" />
    case 'header-footer':
      return (
        <div className="space-y-4">
          <Row label="Text pattern" hint={PATTERN_HINT}>
            <Input value={String(p.pattern ?? '')} onChange={(e) => set({ pattern: e.target.value })} maxLength={200} placeholder="Page [PAGE_ARABIC]" />
          </Row>
          <Row label="Positions">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {POS_OPTS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={Array.isArray(p.positions) && (p.positions as string[]).includes(o.value)} onCheckedChange={(v) => {
                    const cur = Array.isArray(p.positions) ? (p.positions as string[]) : []
                    set({ positions: v === true ? [...cur, o.value] : cur.filter((x) => x !== o.value) })
                  }} />
                  {o.label}
                </label>
              ))}
            </div>
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Sel label="Font" value={String(p.font)} onChange={(v) => set({ font: v })} options={FONT_OPTS} />
            <NumRow label="Font size" value={Number(p.fontSize)} min={6} max={72} onChange={(n) => set({ fontSize: n })} format={(n) => `${n} pt`} />
          </div>
          <Row label="Color">
            <input type="color" value={String(p.color)} onChange={(e) => set({ color: e.target.value })} className="h-9 w-20 cursor-pointer rounded-md border" aria-label="Text color" />
          </Row>
          <NumRow label="Margin from edge" value={Number(p.margin)} min={10} max={200} onChange={(n) => set({ margin: n })} format={(n) => `${n} pt`} />
          <Row label="Start page numbering at"><Input type="number" min={0} value={Number(p.startAt)} onChange={(e) => set({ startAt: Number(e.target.value) })} /></Row>
          <Row label="Pages" hint="Leave empty to label all pages">
            <Input value={String(p.pages ?? '')} onChange={(e) => set({ pages: e.target.value })} placeholder="all pages" />
          </Row>
        </div>
      )
    case 'n-up':
      return (
        <div className="space-y-4">
          <Sel label="Pages per sheet" value={String(p.n)} onChange={(v) => set({ n: Number(v) })} options={[
            { value: '2', label: '2 per sheet' }, { value: '4', label: '4 per sheet' }, { value: '6', label: '6 per sheet' },
            { value: '9', label: '9 per sheet' }, { value: '16', label: '16 per sheet' },
          ]} />
          <Sel label="Page order" value={String(p.pageOrdering)} onChange={(v) => set({ pageOrdering: v })} options={[
            { value: 'horizontal', label: 'Horizontal (left to right)' }, { value: 'vertical', label: 'Vertical (top to bottom)' },
          ]} />
          <Check label="Keep original page size" checked={p.preservePageSize === true} onChange={(v) => set({ preservePageSize: v })} hint="Otherwise sheets are A4 (landscape for wide layouts)" />
        </div>
      )
    case 'page-numbers':
      return (
        <div className="space-y-4">
          <Sel label="Position" value={String(p.position)} onChange={(v) => set({ position: v })} options={POS_OPTS} />
          <Row label="Number pattern" hint={PATTERN_HINT}>
            <Input value={String(p.pattern ?? '')} onChange={(e) => set({ pattern: e.target.value })} maxLength={200} placeholder="[PAGE_ARABIC]" />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Sel label="Font" value={String(p.font)} onChange={(v) => set({ font: v })} options={FONT_OPTS} />
            <NumRow label="Font size" value={Number(p.fontSize)} min={6} max={72} onChange={(n) => set({ fontSize: n })} format={(n) => `${n} pt`} />
          </div>
          <Row label="Start numbering at">
            <Input type="number" min={0} value={Number(p.startAt)} onChange={(e) => set({ startAt: Number(e.target.value) })} />
          </Row>
          <Row label="Pages" hint="Leave empty to number all pages">
            <Input value={String(p.pages ?? '')} onChange={(e) => set({ pages: e.target.value })} placeholder="all pages" />
          </Row>
        </div>
      )
    case 'rename':
      return (
        <div className="space-y-4">
          <Row label="Filename pattern" hint="[TEXT] = text found in the strip below, [FILENUMBER] = 1, 2, 3…">
            <Input value={String(p.renamePattern ?? '')} onChange={(e) => set({ renamePattern: e.target.value })} maxLength={120} placeholder="invoice-[TEXT]" />
          </Row>
          <NumRow label="Strip top offset" value={Number(p.areaY)} min={0} max={800} onChange={(n) => set({ areaY: n })} format={(n) => `${n} pt`} />
          <NumRow label="Strip height" value={Number(p.areaHeight)} min={5} max={800} onChange={(n) => set({ areaHeight: n })} format={(n) => `${n} pt`} />
        </div>
      )
    case 'repair':
      return <p className="text-sm text-muted-foreground">Three recovery engines are tried in turn (internal parser, qpdf, Ghostscript). Heavily damaged content may be missing from the output.</p>
    case 'resize':
      return (
        <div className="space-y-4">
          <Sel label="Page size" value={String(p.pageSize)} onChange={(v) => set({ pageSize: v })} options={[
            { value: 'keep', label: 'Keep current size' }, { value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' },
            { value: 'legal', label: 'US Legal' }, { value: 'a3', label: 'A3' }, { value: 'a5', label: 'A5' },
            { value: 'custom', label: 'Custom size' },
          ]} />
          {p.pageSize === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <Row label={`Width (${p.unit})`}><Input type="number" min={10} value={Number(p.customWidth)} onChange={(e) => set({ customWidth: Number(e.target.value) })} /></Row>
              <Row label={`Height (${p.unit})`}><Input type="number" min={10} value={Number(p.customHeight)} onChange={(e) => set({ customHeight: Number(e.target.value) })} /></Row>
            </div>
          )}
          <Sel label="Unit" value={String(p.unit)} onChange={(v) => set({ unit: v })} options={[{ value: 'pt', label: 'Points' }, { value: 'mm', label: 'Millimeters' }, { value: 'in', label: 'Inches' }]} />
          <NumRow label="Margin around content" value={Number(p.margin)} min={0} max={200} onChange={(n) => set({ margin: n })} format={(n) => `${n} ${p.unit}`} />
        </div>
      )
    case 'rotate':
      return (
        <div className="space-y-4">
          <Sel label="Angle" value={String(p.angle)} onChange={(v) => set({ angle: Number(v) })} options={[{ value: '90', label: '90° clockwise' }, { value: '180', label: '180°' }, { value: '270', label: '90° counter-clockwise' }]} />
          <Row label="Pages" hint="Leave empty to rotate all pages">
            <Input value={String(p.pages ?? '')} onChange={(e) => set({ pages: e.target.value })} placeholder="all pages" />
          </Row>
        </div>
      )
    case 'remove-annotations':
      return (
        <Row label="Annotation types to remove">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {['link', 'highlight', 'underline', 'strikeout', 'squiggly', 'note', 'freetext', 'stamp', 'form-field', 'popup', 'ink', 'square', 'circle', 'line', 'attachment'].map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm capitalize">
                <Checkbox checked={Array.isArray(p.annotationTypes) && (p.annotationTypes as string[]).includes(t)} onCheckedChange={(v) => {
                  const cur = Array.isArray(p.annotationTypes) ? (p.annotationTypes as string[]) : []
                  set({ annotationTypes: v === true ? [...cur, t] : cur.filter((x) => x !== t) })
                }} />
                {t.replace('-', ' ')}
              </label>
            ))}
          </div>
        </Row>
      )
    // --- scans ---
    case 'deskew':
      return <Check label="Only fix strongly skewed pages (≥ 2°)" checked={p.onlyStronglySkewed === true} onChange={(v) => set({ onlyStronglySkewed: v })} />
    case 'ocr':
      return (
        <div className="space-y-4">
          <Sel label="Output" value={String(p.outputFormat)} onChange={(v) => set({ outputFormat: v })} options={[
            { value: 'pdf', label: 'Searchable PDF' }, { value: 'text', label: 'Plain text' }, { value: 'both', label: 'Both PDF and text' },
          ]} />
          <p className="text-xs text-muted-foreground">Language: English (the installed OCR language pack). Pages are recognized at 200 dpi.</p>
        </div>
      )
    // --- automate ---
    case 'workflows':
      return <WorkflowBuilder params={p} onChange={set} />
  }
}

// Bookmarks editor: plain-text lines "Title | page | level" → structured entries.
function BookmarksEditor({ params, onChange }: { params: ParamBag; onChange: (patch: ParamBag) => void }) {
  const entries = Array.isArray(params.entries) ? (params.entries as { title: string; page: number; level: number }[]) : []
  const raw = entries.map((e) => `${e.title} | ${e.page} | ${e.level}`).join('\n')
  return (
    <Row label="Bookmarks" hint="One per line: Title | page | level — level 2 indents under the previous level 1">
      <Textarea
        rows={7}
        defaultValue={raw}
        placeholder={'Chapter 1 | 1 | 1\nSection A | 2 | 2\nChapter 2 | 4 | 1'}
        onChange={(e) => {
          const lines = e.target.value.split('\n').filter((l) => l.trim())
          const parsed = lines.map((l) => {
            const [title, page, level] = l.split('|').map((s) => s.trim())
            return { title: title ?? '', page: Math.max(1, Math.trunc(Number(page) || 1)), level: Math.min(3, Math.max(1, Math.trunc(Number(level) || 1))) }
          })
          onChange({ entries: parsed })
        }}
      />
    </Row>
  )
}

// Workflow builder: pick up to 5 chainable tools, each with its own options.
function WorkflowBuilder({ params, onChange }: { params: ParamBag; onChange: (patch: ParamBag) => void }) {
  const steps = Array.isArray(params.steps) ? (params.steps as { type: string; params: ParamBag }[]) : []
  const chainable = TOOLS.filter((t) => isChainable(t.slug))
  const update = (next: { type: string; params: ParamBag }[]) => onChange({ steps: next })
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Steps run in order — each one receives the previous step's PDF output.</p>
      {steps.map((step, i) => {
        const tool = getTool(step.type)
        if (!tool) return null
        return (
          <div key={i} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
              <Select value={step.type} onValueChange={(v) => {
                const t = getTool(v)
                const next = [...steps]
                next[i] = { type: v, params: { ...(PARAM_DEFAULTS[v as string] ?? {}) } }
                void t
                update(next)
              }}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{chainable.map((t) => <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove step ${i + 1}`} onClick={() => update(steps.filter((_, k) => k !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <ToolOptionsInner
              tool={tool}
              params={step.params}
              onChange={(patch) => {
                const next = [...steps]
                next[i] = { ...step, params: { ...step.params, ...patch } }
                update(next)
              }}
              onSignatureBlob={() => {}}
              signatureReady={false}
            />
          </div>
        )
      })}
      {steps.length < 5 && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            const first = chainable[0]
            update([...steps, { type: first.slug, params: { ...(PARAM_DEFAULTS[first.slug] as ParamBag ?? {}) } }])
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add step
        </Button>
      )}
    </div>
  )
}

export function ToolOptions(props: Props) {
  return <ToolOptionsInner {...props} />
}
