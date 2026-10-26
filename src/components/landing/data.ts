// Small Editor landing data — mirrors the reference landing page 1:1.
// Every entry carries `slug`, the REAL tool route in this app
// (/workspace?tool=<slug>), so all 45 cards are wired to working tools.

export type LandingTool = {
  c: string // category
  n: string // name
  d: string // description
  slug: string // real route slug
  nw?: boolean // "New" badge
}

const T = (
  c: string,
  n: string,
  d: string,
  slug: string,
  nw = false,
): LandingTool => ({ c, n, d, slug, nw })

export const TOOLS_LANDING: LandingTool[] = [
  T('Merge', 'Alternate & Mix', 'Mixes pages from 2 or more documents, alternating between them', 'alternate-mix'),
  T('Merge', 'Merge', 'Combine multiple PDFs and images into one', 'merge'),
  T('Merge', 'Visual Combine & Reorder', 'Visually combine PDFs and drag pages into the order you want', 'organize'),
  T('Merge', 'Organize', 'Arrange and reorder PDF pages', 'organize'),
  T('Split', 'Extract Pages', 'Get a new document containing only the desired pages', 'extract-pages'),
  T('Split', 'Split by pages', 'Split page ranges or extract every page into a separate document', 'split'),
  T('Split', 'Split by bookmarks', 'Extract chapters to separate documents based on the table of contents', 'split-bookmarks'),
  T('Split', 'Split in half', 'Split two-page layout scans, A3 to double A4 or A4 to double A5', 'split-middle'),
  T('Split', 'Split by size', 'Get multiple smaller documents with specific file sizes', 'split-size'),
  T('Split', 'Split by text', 'Extract separate documents when specific text changes between pages', 'split-text'),
  T('Edit & Sign', 'PDF Editor', 'Edit PDF files for free. Fill & sign, add text, links, images and shapes. Edit existing text. Annotate', 'pdf-editor'),
  T('Edit & Sign', 'Fill & Sign', 'Add a signature to a PDF. Fill out PDF forms', 'sign'),
  T('Edit & Sign', 'Create Forms', 'Free PDF forms creator. Make existing documents fillable', 'pdf-forms'),
  T('Edit & Sign', 'Delete Pages', 'Remove pages from a PDF document', 'delete-pages'),
  T('Compress & Scans', 'Compress', 'Reduce the size of your PDF', 'compress'),
  T('Compress & Scans', 'Deskew', 'Automatically straighten and deskew scanned pages', 'deskew'),
  T('Compress & Scans', 'OCR', 'Convert scans to searchable text and PDFs. Extract text from scans', 'ocr'),
  T('Security', 'Protect', 'Protect a file with password and permissions', 'protect'),
  T('Security', 'Unlock', 'Remove restrictions and password from PDF files', 'unlock'),
  T('Security', 'Watermark', 'Add an image or text watermark to PDF documents', 'watermark'),
  T('Security', 'Flatten', 'Makes fillable PDFs read-only. Print & scan in one step', 'flatten'),
  T('Convert from PDF', 'PDF to Excel', 'Convert PDF to Excel or CSV. Extract table data', 'pdf-to-excel'),
  T('Convert from PDF', 'PDF to JPG', 'Get pages converted to JPG, PNG or TIFF images', 'pdf-to-jpg'),
  T('Convert from PDF', 'PDF to PowerPoint', 'Convert PDF to PowerPoint online', 'pdf-to-ppt'),
  T('Convert from PDF', 'PDF to Text', 'Copies all text from the PDF and extracts it to a text file', 'pdf-to-text'),
  T('Convert from PDF', 'PDF to Word', 'Convert from PDF to DOC online', 'pdf-to-word'),
  T('Convert to PDF', 'HTML to PDF', 'Convert web pages or HTML files to PDF documents', 'html-to-pdf'),
  T('Convert to PDF', 'JPG to PDF', 'Convert images to PDF', 'jpg-to-pdf'),
  T('Convert to PDF', 'Word to PDF', 'Creates a PDF document from Microsoft Word .docx', 'word-to-pdf'),
  T('Others', 'Bates Numbering', 'Bates stamp multiple files at once', 'bates-numbering'),
  T('Others', 'Create Bookmarks', 'Create PDF bookmarks', 'edit-bookmarks'),
  T('Others', 'Crop', 'Trim PDF margins, change PDF page size', 'crop'),
  T('Others', 'Edit Metadata', 'Change author, title, keywords, subject and other metadata', 'edit-metadata'),
  T('Others', 'Extract Images', 'Extract images from PDF', 'extract-images'),
  T('Others', 'Flip', 'Mirror pages horizontally or vertically', 'flip', true),
  T('Others', 'Grayscale', 'Make a PDF text and images grayscale', 'grayscale'),
  T('Others', 'Header & Footer', 'Apply page numbers or text labels to PDF files', 'header-footer'),
  T('Others', 'N-up', 'Print multiple pages per sheet. A5 as 4-up on A3, or 2-up on A4', 'n-up'),
  T('Others', 'Page Numbers', 'Add PDF page numbers', 'page-numbers'),
  T('Others', 'Rename', 'Change document filename based on text from the pages', 'rename'),
  T('Others', 'Repair', 'Recover data from a corrupted or damaged PDF', 'repair'),
  T('Others', 'Resize', 'Add page margins and padding, change page size', 'resize'),
  T('Others', 'Rotate', 'Rotate and save PDF pages permanently', 'rotate'),
  T('Others', 'Remove annotations', 'Batch remove highlights, strikeouts or any annotations', 'remove-annotations', true),
  T('Automate', 'Workflows', 'Execute a series of tasks on PDFs. Configure tool chains', 'workflows', true),
]

export const POP = [
  'PDF Editor',
  'Compress',
  'Delete Pages',
  'Merge',
  'Split by pages',
  'Crop',
  'Fill & Sign',
  'PDF to Word',
  'Extract Pages',
]

// Category fallback icons (stroke paths on a 24 viewBox)
export const IC: Record<string, string> = {
  Merge: 'M5 7h8M5 12h14M5 17h8M17 5l3 2-3 2',
  Split: 'M12 4v16M5 8l-2 4 2 4M19 8l2 4-2 4',
  'Edit & Sign': 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  'Compress & Scans': 'M4 9l5 3-5 3M20 9l-5 3 5 3M9 12h6',
  Security: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  'Convert from PDF': 'M4 8h13l-3-3M20 16H7l3 3',
  'Convert to PDF': 'M4 8h13l-3-3M20 16H7l3 3',
  Others: 'M5 6h14M5 12h14M5 18h9',
  Automate: 'M13 3L5 14h6l-1 7 8-11h-6z',
}

// Per-tool icons (stroke paths on a 24 viewBox)
export const IT: Record<string, string> = {
  'Alternate & Mix': 'M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3',
  Merge: 'M12 4v5M12 9v5M5 20v-3a3 3 0 013-3h8a3 3 0 013 3v3M9 4h6',
  'Visual Combine & Reorder': 'M4 6h7v7H4zM13 11h7v7h-7z',
  Organize: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  'Extract Pages': 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  'Split by pages': 'M8 8h10v12H8zM6 16V4h10',
  'Split by bookmarks': 'M7 4h10v16l-5-4-5 4z',
  'Split in half': 'M4 5h16v14H4zM12 5v14',
  'Split by size': 'M12 4a8 8 0 108 8h-8zM14 3a8 8 0 016 6h-6z',
  'Split by text': 'M6 19L12 5l6 14M8.5 14h7',
  'PDF Editor': 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  'Fill & Sign': 'M4 17c3-8 5-9 6-4s3 3 5-2M4 21h16',
  'Create Forms': 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h4',
  'Delete Pages': 'M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6',
  Compress: 'M4 9l5 3-5 3M20 9l-5 3 5 3M9 12h6',
  Deskew: 'M7 4h8l3 3v13H7zM3 12h4',
  OCR: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z',
  Protect: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  Unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 017.5-2',
  Watermark: 'M6 4h9l3 3v13H6zM9 12h6M9 16h6',
  Flatten: 'M5 19L12 5l7 14M8 14h8',
  'PDF to Excel': 'M6 4h9l3 3v13H6zM9 12l5 5M14 12l-5 5',
  'PDF to JPG': 'M6 4h9l3 3v13H6zM9 17l3-4 2 2 2-3',
  'PDF to PowerPoint': 'M6 4h9l3 3v13H6zM10 17v-5h3a1.5 1.5 0 010 3h-3',
  'PDF to Text': 'M5 7h14M5 12h14M5 17h9',
  'PDF to Word': 'M6 4h9l3 3v13H6zM9 12l1.5 5 1.5-4 1.5 4 1.5-5',
  'HTML to PDF': 'M6 4h9l3 3v13H6zM10 11l-2 3 2 3M14 11l2 3-2 3',
  'JPG to PDF': 'M4 5h16v14H4zM7 16l4-5 3 3 2-2 2 4',
  'Word to PDF': 'M6 4h9l3 3v13H6zM9 12l1.5 5 1.5-4 1.5 4 1.5-5',
  'Bates Numbering': 'M5 19l8-8M9 5l10 10-3 3L6 8zM14 20h6',
  'Create Bookmarks': 'M7 4h10v16l-5-4-5 4z',
  Crop: 'M7 3v14h14M3 7h14v14',
  'Edit Metadata': 'M4 4h16v16H4zM12 11v6M12 7.5v.5',
  'Extract Images': 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  Flip: 'M12 3v18M7 8l-4 4 4 4zM17 8l4 4-4 4z',
  Grayscale: 'M5 19L19 5M14 5l5 5-9 9H5v-5z',
  'Header & Footer': 'M7 5v14M17 5v14M7 12h10M5 5h4M15 5h4M5 19h4M15 19h4',
  'N-up': 'M4 4h16v16H4zM12 4v16M4 12h16',
  'Page Numbers': 'M6 8l3-3 3 3M9 5v8M15 16l3 3 3-3M18 19v-8',
  Rename: 'M10 4h4M10 20h4M12 4v16',
  Repair: 'M14 6a4 4 0 00-5 5l-5 5 3 3 5-5a4 4 0 005-5l-3 3-2-2z',
  Resize: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  Rotate: 'M5 12a7 7 0 0112-5l2-2v6h-6l2-2M19 12a7 7 0 01-12 5l-2 2v-6h6l-2 2',
  'Remove annotations': 'M5 19l8-8M10 6l5-3 6 6-3 5zM4 21h6',
  Workflows: 'M13 3L5 14h6l-1 7 8-11h-6z',
}

export function toolIconPath(c: string, n: string): string {
  return IT[n] || IC[c] || IC.Others
}

export const CATEGORIES = [...new Set(TOOLS_LANDING.map((t) => t.c))]

export type Guide = {
  title: string
  sub?: string
  band: boolean
  cta: string
  ctaSlug: string
  ctaDesktop?: boolean
  steps: string[]
}

export const GUIDES: Guide[] = [
  {
    title: 'How to edit PDF files',
    band: false,
    cta: 'Edit PDF files',
    ctaSlug: 'pdf-editor',
    steps: [
      'Open a file in the <b>Online PDF editor</b>',
      'Click on the Text tool in the top menu',
      'Add text on the PDF page. Change text by clicking on existing text to start editing',
      'Add images to the page. Click and drag to move, resize or rotate the image',
      'Fill out PDF forms and add signatures. Draw, type or upload an image of your signature',
      'Annotate PDF pages, highlight text and mark changes with strikethrough',
      'Add new links to web URLs or pages in the document. Easily edit existing hyperlinks in the PDF',
      'Easily find and replace all occurrences of words in a PDF. Whiteout parts of the page. Add shapes',
      'Click Apply changes and download an edited document',
    ],
  },
  {
    title: 'How to convert a PDF to Word',
    band: true,
    cta: 'PDF to DOC converter',
    ctaSlug: 'pdf-to-word',
    steps: [
      'Open your document with the <b>PDF to Word converter</b>',
      'Click Convert and download a Word document',
    ],
  },
  {
    title: 'How to combine PDF files',
    band: false,
    cta: 'Merge PDF files',
    ctaSlug: 'merge',
    steps: [
      'Open the <b>Merge PDF files tool</b>',
      'Drag to reorder the files, or sort them alphabetically',
      'Optionally select only a collection of pages to pick from each file',
      'Select your documents, or just drag and drop them all to the page',
      'Generate bookmarks or an outline based on the inputs',
      'Add file names to the footer of each page',
      'Generate a nice table of contents based on the documents being merged',
      'Optionally specify a cover / title page(s)',
      'Merge Acroforms or flatten form fields',
    ],
  },
  {
    title: 'How to convert PDF to JPG',
    band: true,
    cta: 'PDF to image converter',
    ctaSlug: 'pdf-to-jpg',
    steps: [
      'Open your PDF with the <b>PDF to JPG, PNG and TIFF converter</b>',
      'Convert all pages or select only pages you want converted',
      'Select desired image format, PNG, TIFF or JPG',
      'Choose a higher resolution, 150 or 220',
      'Quickly convert a PDF page to PNG or JPG',
      'Download an archive with all the converted images',
    ],
  },
  {
    title: 'How to delete pages from PDF',
    band: false,
    cta: 'Delete PDF Pages',
    ctaSlug: 'delete-pages',
    steps: [
      'Open the file with the <b>Delete PDF Pages tool</b>',
      'Click the pages you want to remove',
      'Download a new document, with the pages removed',
    ],
  },
  {
    title: 'How to edit PDF on Mac',
    band: true,
    cta: 'Edit PDF offline with Small Editor Desktop for Mac',
    ctaSlug: 'pdf-editor',
    ctaDesktop: true,
    steps: [
      '<b>Edit PDF files online</b> in your Safari browser',
      'Download and install <b>Small Editor Desktop</b> and edit PDF documents offline',
    ],
  },
  {
    title: 'How to type on a PDF',
    band: false,
    cta: 'Fill out PDF files',
    ctaSlug: 'sign',
    steps: [
      'Open your file using the <b>PDF editor</b>',
      'Select the Text tool in the top menu',
      'Click anywhere on the page to start typing',
      'Fill out PDF forms easily, even if no form inputs are present',
      'Save and download your filled out document',
    ],
  },
  {
    title: 'How to password protect a PDF',
    band: true,
    cta: 'Protect PDF with password and restrictions',
    ctaSlug: 'protect',
    steps: [
      'Open the <b>Encrypt and Protect PDF tool</b>',
      'Select your PDF document',
      'Choose a really strong password (16 characters or more recommended)',
      'Optionally, select a set of restrictions for your document: modifying, printing, copying text and graphics, etc',
      'Save and download your protected PDF',
    ],
  },
  {
    title: 'How to compress a PDF',
    sub: 'How to reduce PDF file size',
    band: false,
    cta: 'Compress PDF online',
    ctaSlug: 'compress',
    steps: [
      'Open your document with the <b>Compress PDF tool</b>',
      'Configure image quality and resolution. This controls how small your PDF will become',
      'Compress and download your smaller PDF',
    ],
  },
]

export const LANGUAGES = [
  'English', 'العربية', 'Bahasa Indonesia', 'Dansk', 'Deutsch', 'Čeština',
  'Español', 'Français', 'Italiano', 'Ελληνικά', '日本語', '한국어', '简体中文',
  '繁體中文', 'हिन्दी', 'עברית', 'Magyar', 'Nederlands', 'Norsk', 'Polski',
  'Português', 'Română', 'Русский', 'Suomi', 'Svenska', 'ไทย', 'Tiếng Việt',
  'Türkçe', 'Українська',
]

// Footer "Tools" column — name + slug, sorted alphabetically like the reference
export const FOOTER_TOOLS: { label: string; slug: string }[] = [
  { label: 'Add PDF Page Numbers', slug: 'page-numbers' },
  { label: 'Alternate & Mix PDF', slug: 'alternate-mix' },
  { label: 'Bates Numbering PDF', slug: 'bates-numbering' },
  { label: 'Compress PDF', slug: 'compress' },
  { label: 'Create PDF Bookmarks', slug: 'edit-bookmarks' },
  { label: 'Crop PDF', slug: 'crop' },
  { label: 'Delete PDF Annotations', slug: 'remove-annotations' },
  { label: 'Delete PDF Pages', slug: 'delete-pages' },
  { label: 'Deskew PDF', slug: 'deskew' },
  { label: 'Edit PDF Metadata', slug: 'edit-metadata' },
  { label: 'Extract Images from PDF', slug: 'extract-images' },
  { label: 'Extract PDF Pages', slug: 'extract-pages' },
  { label: 'Fill & Sign PDF', slug: 'sign' },
  { label: 'Flatten PDF', slug: 'flatten' },
  { label: 'Flip PDF', slug: 'flip' },
  { label: 'Grayscale PDF', slug: 'grayscale' },
  { label: 'Header & Footer PDF', slug: 'header-footer' },
  { label: 'HTML to PDF', slug: 'html-to-pdf' },
  { label: 'JPG to PDF', slug: 'jpg-to-pdf' },
  { label: 'Merge PDF', slug: 'merge' },
  { label: 'N-up PDF', slug: 'n-up' },
  { label: 'OCR PDF', slug: 'ocr' },
  { label: 'PDF Editor', slug: 'pdf-editor' },
  { label: 'PDF Page Numbers', slug: 'page-numbers' },
  { label: 'PDF to Excel', slug: 'pdf-to-excel' },
  { label: 'PDF to JPG', slug: 'pdf-to-jpg' },
  { label: 'PDF to PowerPoint', slug: 'pdf-to-ppt' },
  { label: 'PDF to Text', slug: 'pdf-to-text' },
  { label: 'PDF to Word', slug: 'pdf-to-word' },
  { label: 'Protect PDF', slug: 'protect' },
  { label: 'Repair PDF', slug: 'repair' },
  { label: 'Resize PDF', slug: 'resize' },
  { label: 'Rotate PDF', slug: 'rotate' },
  { label: 'Split PDF by bookmarks', slug: 'split-bookmarks' },
  { label: 'Split PDF by pages', slug: 'split' },
  { label: 'Split PDF by size', slug: 'split-size' },
  { label: 'Split PDF by text', slug: 'split-text' },
  { label: 'Split PDF in half', slug: 'split-middle' },
  { label: 'Unlock PDF', slug: 'unlock' },
  { label: 'Visual Combine & Reorder PDF', slug: 'organize' },
  { label: 'Watermark PDF', slug: 'watermark' },
  { label: 'Word to PDF', slug: 'word-to-pdf' },
]
