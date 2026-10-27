// Content data ported 1:1 from the user-provided desktop ui.html design.
// Each tool name is mapped to a real registry slug so every link opens a
// working tool at /workspace?tool=<slug>.

export type DCat = { c: string; n: string; d: string; slug: string }

const RAW = `Merge|Alternate & Mix|Mixes pages from 2 or more documents, alternating between them|alternate-mix
Merge|Merge|Combine multiple PDFs and images into one|merge
Merge|Visual Combine & Reorder|Visually combine PDFs and drag pages into the order you want|organize
Merge|Organize|Arrange and reorder PDF pages|organize
Split|Extract Pages|Get a new document containing only the desired pages|extract-pages
Split|Split by pages|Split page ranges or extract every page into a separate document|split
Split|Split by bookmarks|Extract chapters to separate documents based on the table of contents|split-bookmarks
Split|Split in half|Split two-page layout scans, A3 to double A4 or A4 to double A5|split-middle
Split|Split by size|Get multiple smaller documents with specific file sizes|split-size
Split|Split by text|Extract separate documents when specific text changes between pages|split-text
Edit & Sign|PDF Editor|Edit PDF files for free. Fill & sign, add text, links, images and shapes. Edit existing text. Annotate|pdf-editor
Edit & Sign|Fill & Sign|Add a signature to a PDF. Fill out PDF forms|sign
Edit & Sign|Create Forms|Free PDF forms creator. Make existing documents fillable|pdf-forms
Edit & Sign|Delete Pages|Remove pages from a PDF document|delete-pages
Compress & Scans|Compress|Reduce the size of your PDF|compress
Compress & Scans|Deskew|Automatically straighten and deskew scanned pages|deskew
Compress & Scans|OCR|Convert scans to searchable text and PDFs. Extract text from scans|ocr
Security|Protect|Protect a file with password and permissions|protect
Security|Unlock|Remove restrictions and password from PDF files|unlock
Security|Watermark|Add an image or text watermark to PDF documents|watermark
Security|Flatten|Makes fillable PDFs read-only. Print & scan in one step|flatten
Convert from PDF|PDF to Excel|Convert PDF to Excel or CSV. Extract table data|pdf-to-excel
Convert from PDF|PDF to JPG|Get pages converted to JPG, PNG or TIFF images|pdf-to-jpg
Convert from PDF|PDF to PowerPoint|Convert PDF to PowerPoint online|pdf-to-ppt
Convert from PDF|PDF to Text|Copies all text from the PDF and extracts it to a text file|pdf-to-text
Convert from PDF|PDF to Word|Convert from PDF to DOC online|pdf-to-word
Convert to PDF|HTML to PDF|Convert web pages or HTML files to PDF documents|html-to-pdf
Convert to PDF|JPG to PDF|Convert images to PDF|jpg-to-pdf
Convert to PDF|Word to PDF|Creates a PDF document from Microsoft Word .docx|word-to-pdf
Others|Bates Numbering|Bates stamp multiple files at once|bates-numbering
Others|Create Bookmarks|Create PDF bookmarks|edit-bookmarks
Others|Crop|Trim PDF margins, change PDF page size|crop
Others|Edit Metadata|Change author, title, keywords, subject and other metadata|edit-metadata
Others|Extract Images|Extract images from PDF|extract-images
Others|Flip|Mirror pages horizontally or vertically|flip
Others|Grayscale|Make a PDF text and images grayscale|grayscale
Others|Header & Footer|Apply page numbers or text labels to PDF files|header-footer
Others|N-up|Print multiple pages per sheet. A5 as 4-up on A3, or 2-up on A4|n-up
Others|Page Numbers|Add PDF page numbers|page-numbers
Others|Rename|Change document filename based on text from the pages|rename
Others|Repair|Recover data from a corrupted or damaged PDF|repair
Others|Resize|Add page margins and padding, change page size|resize
Others|Rotate|Rotate and save PDF pages permanently|rotate
Others|Remove annotations|Batch remove highlights, strikeouts or any annotations|remove-annotations
Automate|Workflows|Execute a series of tasks on PDFs. Configure tool chains|workflows`

export const D: DCat[] = RAW.split('\n').map((l) => {
  const [c, n, d, slug] = l.split('|')
  return { c, n, d, slug }
})

// Stroke icon paths from the original design (24x24 viewBox)
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

// Free vs PRO comparison rows
export const CMP: [string, string][] = [
  ['3 tasks per day', 'Unlimited'],
  ['Docs up to 50MB and 200 pages', 'Unlimited'],
  ['Compress files up to 100MB', 'Unlimited'],
  ['OCR files up to 10 pages', 'Unlimited'],
  ['Images up to 5MB', 'Unlimited'],
  ['Combine up to 30 files and 50 pages', 'Unlimited'],
  ['Convert files one by one', 'Multiple files in one go'],
]

// Homepage feature cards
export const F3: [string, string, string][] = [
  ['Merge files into one PDF', 'Visually combine and reorder pages, merge multiple PDF files. Alternate and mix odd and even page from separate files.', 'Merge'],
  ['Split PDF files', 'Split documents by pages. Extract separate documents. Split by size, bookmarks or text occurrences. Divide two page layout scans.', 'Split by pages'],
  ['Convert PDF files to Office and image formats', 'Convert PDF files to Word, Excel and to image. Convert images to PDF file.', 'PDF to Word'],
  ['Compress PDF', 'Reduce the size of PDF files. Optimize images and other resources.', 'Compress'],
  ['Edit PDF files', 'Add, edit or move text in your PDF. Change the font type, size and style. Insert, reorder, move or delete pages. Add signature, highlight text and shapes.', 'PDF Editor'],
  ['Apply PDF passwords and restrictions', 'Add copy and edit protection to a PDF. Include a password to protect your PDF from unapproved access.', 'Protect'],
  ['Watermark PDF', 'Add image or text watermark to PDF documents.', 'Watermark'],
  ['Grayscale PDF', 'Make a PDF text and images grayscale.', 'Grayscale'],
  ['Crop PDF', 'Trim PDF margins, adjust visible page area, change PDF page size.', 'Crop'],
]

// Footer tool list from the original design, mapped to real slugs
export const FOOTER_TOOLS: [string, string][] = [
  ['Add PDF Page Numbers', 'page-numbers'],
  ['Alternate & Mix PDF', 'alternate-mix'],
  ['Bates Numbering PDF', 'bates-numbering'],
  ['Compress PDF', 'compress'],
  ['Create PDF Bookmarks', 'edit-bookmarks'],
  ['Crop PDF', 'crop'],
  ['Delete PDF Annotations', 'remove-annotations'],
  ['Delete PDF Pages', 'delete-pages'],
  ['Deskew PDF', 'deskew'],
  ['Edit PDF Metadata', 'edit-metadata'],
  ['Extract Images from PDF', 'extract-images'],
  ['Extract PDF Pages', 'extract-pages'],
  ['Fill & Sign PDF', 'sign'],
  ['Flatten PDF', 'flatten'],
  ['Flip PDF', 'flip'],
  ['Grayscale PDF', 'grayscale'],
  ['Header & Footer PDF', 'header-footer'],
  ['HTML to PDF', 'html-to-pdf'],
  ['JPG to PDF', 'jpg-to-pdf'],
  ['Merge PDF', 'merge'],
  ['N-up PDF', 'n-up'],
  ['OCR PDF', 'ocr'],
  ['PDF Editor', 'pdf-editor'],
  ['PDF Page Numbers', 'page-numbers'],
  ['PDF to Excel', 'pdf-to-excel'],
  ['PDF to JPG', 'pdf-to-jpg'],
  ['PDF to PowerPoint', 'pdf-to-ppt'],
  ['PDF to Text', 'pdf-to-text'],
  ['PDF to Word', 'pdf-to-word'],
  ['Protect PDF', 'protect'],
  ['Repair PDF', 'repair'],
  ['Resize PDF', 'resize'],
  ['Rotate PDF', 'rotate'],
  ['Split PDF by bookmarks', 'split-bookmarks'],
  ['Split PDF by pages', 'split'],
  ['Split PDF by size', 'split-size'],
  ['Split PDF by text', 'split-text'],
  ['Split PDF in half', 'split-middle'],
  ['Unlock PDF', 'unlock'],
  ['Visual Combine & Reorder PDF', 'organize'],
  ['Watermark PDF', 'watermark'],
  ['Word to PDF', 'word-to-pdf'],
]

export const LANGS = ['English', 'العربية', 'Bahasa Indonesia', 'Dansk', 'Deutsch', 'Čeština', 'Español', 'Français', 'Italiano', 'Ελληνικά', '日本語', '한국어', '简体中文', '繁體中文', 'हिन्दी', 'עברית', 'Magyar', 'Nederlands', 'Norsk', 'Polski', 'Português', 'Română', 'Русский', 'Suomi', 'Svenska', 'ไทย', 'Tiếng Việt', 'Türkçe', 'Українська']
