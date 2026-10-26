// Tool registry: one tool = one slug + one handler (Sejda's task-type DNA).
// The catalog mirrors sejda.com's 44 public tool routes 1:1 — slugs, groups
// (categories), accepted files and option shapes follow the observed Sejda
// forms. Params are validated in tasks.ts against these shapes before a
// handler runs.

export type ToolCategory =
  | 'compress'
  | 'edit-sign'
  | 'split'
  | 'merge'
  | 'security'
  | 'convert-from'
  | 'convert-to'
  | 'other'
  | 'scans'
  | 'automate'

export type ToolParams = {
  // --- organize ---
  merge: { normalizePageSizes: boolean; blankPageIfOdd: boolean }
  split: { mode: 'ranges' | 'step'; ranges: string; step: number } // ranges: "1-3,5" → one output per range; step: fixed-size chunks (step=1 → one file per page)
  'split-bookmarks': { level: number; expression: string; includePageAfter: boolean }
  'split-middle': { ratio: number; mode: 'horizontal' | 'vertical'; repagination: boolean; rightToLeft: boolean }
  'split-size': { size: number; sizeUnit: 'MB' | 'KB' }
  'split-text': { areaY: number; areaHeight: number; startsWith: string }
  'extract-pages': { pages: string }
  'delete-pages': { pages: string }
  'alternate-mix': { step: number; reverse: boolean; repeat: boolean }
  organize: { order: number[] } // new order as list of original 0-based page indices
  rotate: { angle: 90 | 180 | 270; pages: string }
  // --- convert ---
  'jpg-to-pdf': { pageSize: 'fit' | 'a4' | 'letter'; orientation: 'auto' | 'portrait' | 'landscape'; margin: number; mergeOutputs: boolean }
  'pdf-to-jpg': { pages: string; resolution: number; imageFormat: 'jpg' | 'png' | 'tiff'; grayscale: boolean }
  'pdf-to-text': Record<string, never>
  'pdf-to-word': Record<string, never>
  'pdf-to-ppt': { resolution: number }
  'pdf-to-excel': { exportFormat: 'xlsx' | 'csv'; singleSheet: boolean }
  'word-to-pdf': Record<string, never>
  'html-to-pdf': { source: 'url' | 'file' | 'code'; url: string; htmlCode: string; pageSize: 'A4' | 'Letter'; orientation: 'portrait' | 'landscape'; viewportWidth: number; margin: number; delay: number; usePrintMedia: boolean }
  // --- edit & sign ---
  sign: { pageNumber: number; x: number; y: number; width: number; imageDataId: string }
  'pdf-editor': { ops: EditorOp[] }
  'pdf-forms': { ops: FormOp[] }
  watermark: { text: string; fontSize: number; opacity: number; rotation: number; color: string; position: 'center' | 'top' | 'bottom' | 'tile'; imageDataId?: string; scale: number }
  'page-numbers': { position: string; startAt: number; pattern: string; font: 'helvetica' | 'times' | 'courier'; fontSize: number; pages: string; margin: number }
  'header-footer': { pattern: string; positions: string[]; font: 'helvetica' | 'times' | 'courier'; fontSize: number; color: string; margin: number; pages: string; startAt: number }
  'bates-numbering': { style: 'full-bates' | 'bates-with-exhibit' | 'custom'; text: string; digits: number; startFrom: number; increment: number; pageLocation: string; font: 'helvetica' | 'times' | 'courier'; fontSize: number; color: string; margin: number }
  crop: { margin: number }
  resize: { pageSize: string; customWidth: number; customHeight: number; margin: number; unit: 'pt' | 'mm' | 'in' }
  flip: { mode: 'horizontal' | 'vertical' }
  'n-up': { n: number; pageOrdering: 'horizontal' | 'vertical'; preservePageSize: boolean }
  'extract-images': Record<string, never>
  'edit-metadata': { title: string; author: string; subject: string; keywords: string; removeAll: boolean }
  'edit-bookmarks': { entries: { title: string; page: number; level: number }[] }
  rename: { renamePattern: string; areaY: number; areaHeight: number }
  'remove-annotations': { annotationTypes: string[] }
  flatten: { mode: 'forms' | 'rasterize'; resolution: number }
  // --- security ---
  protect: { userPassword: string; ownerPassword?: string; allowPrinting: boolean; allowCopying: boolean; allowModifying: boolean; allowAnnotating: boolean; allowFillingForms: boolean; allowAccessibility: boolean; allowAssembly: boolean }
  unlock: { password: string }
  compress: { quality: 'extremely' | 'recommended' | 'good' | 'great' | 'lossless' }
  grayscale: { compressImages: boolean }
  // --- scans ---
  ocr: { lang: 'eng'; outputFormat: 'pdf' | 'text' | 'both' }
  deskew: { onlyStronglySkewed: boolean }
  repair: Record<string, never>
  // --- automate ---
  workflows: { steps: { type: ChainSlug; params: Record<string, unknown> }[] }
}

export type EditorOp =
  | { kind: 'text'; page: number; x: number; y: number; text: string; fontSize: number; color: string }
  | { kind: 'rect'; page: number; x: number; y: number; width: number; height: number; color: string }
  | { kind: 'image'; page: number; x: number; y: number; width: number; imageDataId: string }

export type FormOp = { kind: 'textfield'; page: number; x: number; y: number; width: number; name: string }

// Tools whose output is always PDF (possibly several) — valid as workflow steps.
export const CHAINABLE = [
  'merge', 'rotate', 'compress', 'grayscale', 'watermark', 'page-numbers', 'header-footer',
  'flatten', 'resize', 'n-up', 'flip', 'crop', 'deskew', 'protect', 'unlock', 'sign',
  'edit-metadata', 'remove-annotations', 'repair', 'rename', 'delete-pages',
] as const
export type ChainSlug = (typeof CHAINABLE)[number]

export interface ToolDef {
  slug: keyof ToolParams
  name: string
  description: string
  category: ToolCategory
  keywords: string[]
  accept: string // file input accept attr
  multiple: boolean
  minFiles: number
  maxFiles: number
}

const PDF = 'application/pdf'

export const TOOLS: ToolDef[] = [
  // --- Compress ---
  { slug: 'compress', name: 'Compress PDF', description: 'Reduce the size of your PDF while keeping the best possible quality', category: 'compress', keywords: ['reduce', 'shrink', 'optimize', 'smaller'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Edit & Sign ---
  { slug: 'pdf-editor', name: 'Edit PDF', description: 'Add text, white-out boxes, shapes and images to any page', category: 'edit-sign', keywords: ['edit', 'text', 'annotate', 'whiteout', 'shape'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'sign', name: 'Fill & Sign PDF', description: 'Draw a signature, fill and place it on the page', category: 'edit-sign', keywords: ['signature', 'initials', 'draw', 'sign'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'pdf-forms', name: 'Create PDF Forms', description: 'Make existing PDF documents fillable with text fields', category: 'edit-sign', keywords: ['form', 'fillable', 'fields', 'acroform'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'delete-pages', name: 'Delete Pages', description: 'Remove selected pages from a PDF document', category: 'edit-sign', keywords: ['remove', 'drop'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Split ---
  { slug: 'extract-pages', name: 'Extract Pages', description: 'Get a new document containing only the desired pages', category: 'split', keywords: ['select', 'subset', 'get pages'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'split', name: 'Split PDF', description: 'Split by page ranges or fixed steps — every N pages or one file per page', category: 'split', keywords: ['separate', 'divide', 'cut'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'split-bookmarks', name: 'Split by Bookmarks', description: 'Extract chapters to separate documents based on the table of contents', category: 'split', keywords: ['outline', 'toc', 'chapter'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'split-middle', name: 'Split in Half', description: 'Split two-page layout scans: A3 to double A4, vertically or horizontally', category: 'split', keywords: ['middle', 'half', 'scan', 'a3'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'split-size', name: 'Split by Size', description: 'Get multiple smaller documents under a specific file size', category: 'split', keywords: ['size', 'mb', 'email'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'split-text', name: 'Split by Text', description: 'Split when specific text changes from page to page', category: 'split', keywords: ['text marker', 'invoice', 'account'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Merge ---
  { slug: 'merge', name: 'Merge PDF', description: 'Combine multiple PDFs into one, optionally normalizing page sizes', category: 'merge', keywords: ['combine', 'join', 'unite'], accept: PDF, multiple: true, minFiles: 2, maxFiles: 20 },
  { slug: 'alternate-mix', name: 'Alternate & Mix', description: 'Mix pages from two or more documents, alternating between them', category: 'merge', keywords: ['interleave', 'mix', 'scan'], accept: PDF, multiple: true, minFiles: 2, maxFiles: 20 },
  { slug: 'organize', name: 'Organize Pages', description: 'Arrange and reorder PDF pages visually', category: 'merge', keywords: ['reorder', 'rearrange', 'sort', 'move'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Security ---
  { slug: 'protect', name: 'Protect PDF', description: 'Protect file with password and permissions (AES-256)', category: 'security', keywords: ['encrypt', 'password', 'lock', 'secure'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'unlock', name: 'Unlock PDF', description: 'Remove restrictions and password from PDF files', category: 'security', keywords: ['decrypt', 'remove password'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'watermark', name: 'Watermark', description: 'Stamp text or an image watermark over PDF pages', category: 'security', keywords: ['stamp', 'brand', 'label', 'draft'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'flatten', name: 'Flatten PDF', description: 'Make fillable PDFs read-only. Print & scan in one step', category: 'security', keywords: ['flatten', 'readonly', 'form'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Convert from PDF ---
  { slug: 'pdf-to-excel', name: 'PDF to Excel', description: 'Convert PDF tables to Excel or CSV', category: 'convert-from', keywords: ['excel', 'csv', 'table', 'xlsx'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'pdf-to-jpg', name: 'PDF to JPG', description: 'Get PDF pages converted to JPG, PNG or TIFF images', category: 'convert-from', keywords: ['image', 'picture', 'export', 'png', 'tiff'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'pdf-to-ppt', name: 'PDF to PowerPoint', description: 'Convert PDF pages into an editable PowerPoint deck', category: 'convert-from', keywords: ['ppt', 'powerpoint', 'slides'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'pdf-to-text', name: 'PDF to Text', description: 'Copy all text from the PDF into a plain text file', category: 'convert-from', keywords: ['text', 'txt', 'extract'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'pdf-to-word', name: 'PDF to Word', description: 'Convert PDF text into an editable Word document', category: 'convert-from', keywords: ['word', 'docx', 'doc'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Convert to PDF ---
  { slug: 'html-to-pdf', name: 'HTML to PDF', description: 'Convert web pages or HTML files to PDF documents', category: 'convert-to', keywords: ['html', 'url', 'web', 'link'], accept: 'text/html,.html,.htm', multiple: false, minFiles: 0, maxFiles: 1 },
  { slug: 'jpg-to-pdf', name: 'JPG to PDF', description: 'Convert JPG, PNG, GIF, TIFF, BMP and WebP images to PDF', category: 'convert-to', keywords: ['image', 'photo', 'picture', 'png', 'gif'], accept: 'image/jpeg,image/png,image/gif,image/tiff,image/bmp,image/webp', multiple: true, minFiles: 1, maxFiles: 50 },
  { slug: 'word-to-pdf', name: 'Word to PDF', description: 'Create a PDF document from Microsoft Word .docx and .doc', category: 'convert-to', keywords: ['docx', 'doc', 'word'], accept: 'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,.doc', multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Other ---
  { slug: 'crop', name: 'Crop PDF', description: 'Automatically trim white margins from every page', category: 'other', keywords: ['trim', 'margins', 'auto crop'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'bates-numbering', name: 'Bates Numbering', description: 'Bates stamp multiple files at once — legal numbering', category: 'other', keywords: ['bates', 'legal', 'stamp', 'exhibit'], accept: PDF, multiple: true, minFiles: 1, maxFiles: 20 },
  { slug: 'edit-bookmarks', name: 'Create Bookmarks', description: 'Add a bookmark outline to a PDF that has none', category: 'other', keywords: ['outline', 'toc', 'bookmarks'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'edit-metadata', name: 'Edit Metadata', description: 'Change PDF Author, Title, Keywords and Subject', category: 'other', keywords: ['metadata', 'author', 'title', 'properties'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'extract-images', name: 'Extract Images', description: 'Extract embedded images from a PDF', category: 'other', keywords: ['images', 'photos', 'export'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'flip', name: 'Flip PDF', description: 'Mirror pages horizontally or vertically', category: 'other', keywords: ['mirror', 'reverse'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'grayscale', name: 'Grayscale PDF', description: 'Make a PDF text and images grayscale', category: 'other', keywords: ['gray', 'black and white', 'monochrome'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'header-footer', name: 'Header & Footer', description: 'Apply page labels like "Page 3" to header or footer positions', category: 'other', keywords: ['title', 'date', 'text'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'n-up', name: 'N-up PDF', description: 'Print multiple pages per sheet — 2-up, 4-up, 6-up on A4 or A3', category: 'other', keywords: ['n-up', 'imposition', 'sheet'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'page-numbers', name: 'Page Numbers', description: 'Add PDF page numbers with position, font, and pattern options', category: 'other', keywords: ['numbering', 'pagination'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'rename', name: 'Rename PDF', description: 'Change the filename based on text found in the PDF pages', category: 'other', keywords: ['rename', 'filename', 'text'], accept: PDF, multiple: true, minFiles: 1, maxFiles: 20 },
  { slug: 'repair', name: 'Repair PDF', description: 'Recover data from a corrupted or damaged PDF document', category: 'other', keywords: ['fix', 'corrupt', 'recover'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'resize', name: 'Resize PDF', description: 'Add margins, scale and change the PDF page size', category: 'other', keywords: ['scale', 'margins', 'padding', 'a4'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'rotate', name: 'Rotate PDF', description: 'Rotate and save PDF pages permanently', category: 'other', keywords: ['turn', 'landscape', 'portrait'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'remove-annotations', name: 'Remove Annotations', description: 'Batch remove highlights, links, notes and other annotations', category: 'other', keywords: ['annotations', 'highlights', 'comments'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Scans ---
  { slug: 'deskew', name: 'Deskew PDF', description: 'Automatically straighten and deskew scanned PDF pages', category: 'scans', keywords: ['skew', 'straighten', 'scan'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  { slug: 'ocr', name: 'OCR PDF', description: 'Convert PDF scans to searchable text and PDFs (English)', category: 'scans', keywords: ['ocr', 'searchable', 'recognize'], accept: PDF, multiple: false, minFiles: 1, maxFiles: 1 },
  // --- Automate ---
  { slug: 'workflows', name: 'Workflows', description: 'Execute a series of tools in order on your documents', category: 'automate', keywords: ['automate', 'chain', 'pipeline', 'batch'], accept: PDF, multiple: true, minFiles: 1, maxFiles: 20 },
]

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  compress: 'Compress',
  'edit-sign': 'Edit & Sign',
  split: 'Split',
  merge: 'Merge',
  security: 'Security',
  'convert-from': 'Convert from PDF',
  'convert-to': 'Convert to PDF',
  other: 'Other',
  scans: 'Scans',
  automate: 'Automate',
}

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug)
}

export function isChainable(slug: string): boolean {
  return (CHAINABLE as readonly string[]).includes(slug)
}
