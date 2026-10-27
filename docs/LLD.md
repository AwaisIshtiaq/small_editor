# LLD — Small Editor engine (44 tools)

Companion to `HLD.md`. Details the internals a maintainer touches daily.
Status: implemented and tested (68/68 engine, 44/44 HTTP).

## 1. Module map (src/lib/pdf-tools)

| File | Responsibility |
|---|---|
| `registry.ts` | `ToolParams` param types, `ToolDef` list (44), `ToolCategory` (10 Sejda groups), `CHAINABLE` (workflow-safe slugs) |
| `tasks.ts` | `validateParams` per-tool switch; `validateTask` file-count/type gates; MAX_FILE_MB=50, MAX_PAGES=200 (only when enforced) |
| `handlers.ts` | `HANDLERS` map — assembles the three families + rotate/delete/extract/organize/sign/unlock/workflows |
| `handlers-core.ts` | shared helpers (`loadPdf`, `saveAs`, `zipOutputs`, `packOutputs`, `STD_FONTS`, `romanNumeral`) + organize/split/geometry handlers |
| `handlers-convert.ts` | jpg-to-pdf, pdf-to-image, pdf-to-text/word/ppt/excel, word-to-pdf, html-to-pdf, extract-images |
| `handlers-editsec.ts` | watermark, page-numbers, header-footer, bates, pdf-editor, pdf-forms, metadata, bookmarks, rename, annotations, flatten, protect, compress, grayscale, ocr, repair |
| `pdfjs-server.ts` | Node-side pdf.js: text items (`getPageText`, `toLines`), outline → page indices (`outlineEntries`) |
| `pdfjs-client.ts` | browser pdf.js for thumbnails/selection |
| `writers.ts` | minimal OOXML zip writers: `writeDocx`, `writeXlsx`, `writePptx` (fflate) |
| `bin.ts` | `run()` subprocess wrapper (timeout→ENGINE_FAILED), scratch dirs, `BIN` paths, `OCR_LANGS` |
| `store.ts` | TTL store: tmpdir files + sidecar JSON, boot recovery, 10-min sweep |
| `tasklog.ts` / `ratelimit.ts` / `errors.ts` / `http.ts` / `mime.ts` / `parse.ts` | task records, limits, error catalog, JSON errors, MIME matching, page-range grammar |

## 2. Handler contract

```ts
type Handler = (files: StoredMeta[], params: any) => Promise<HandlerOutput>
interface HandlerOutput { files: OutputFile[]; note?: string }
interface OutputFile { name: string; data: Uint8Array; mime: string }
```

- Handlers never see HTTP; validation already normalized params.
- Multi-output handlers end with `packOutputs(outs, base)` → single file, or a
  ZIP named `<base>.zip` (Sejda behavior for split/pdfToImage outputs).
- All thrown errors are `TaskError(code, message, status?)`; codes map to UI
  copy in the error catalog (`08-api-error-and-validation-catalog.md`).

## 3. Per-tool implementation notes

**Page geometry (embedPage family).** split-middle, resize, flip, n-up, deskew,
merge-normalize all rebuild pages by `src.embedPage(page[, bbox])` + `drawPage`
with transforms — vectors preserved, forms lost (acceptable: scan/layout ops).
- flip: `xScale: -1` with `x: width` (or y/height).
- n-up: layouts {2:[2,1], 4:[2,2], 6:[3,2], 9:[3,3], 16:[4,4]}; horizontal or
  column-major ordering; A4 landscape sheets for wide grids unless
  `preservePageSize`.
- deskew: renders at 72 dpi grayscale PNG, binarizes with sharp, finds the
  rotation maximizing row-projection variance (coarse ±8°/0.5° then 0.1°),
  re-draws rotated by `-angle` scaled to fit.

**Split family.**
- bookmarks: pdf.js `getOutline` + `getDestination`/`getPageIndex` → level-N
  sections; `expression` filters titles (case-insensitive substring);
  `includePageAfter` extends into the next section's first page.
- size: average byte/page from one full save → greedy pack → per-chunk verify
  (oversized chunk sheds its last page); single page > target → INVALID_PARAMS.
- text: per-page text inside a horizontal strip (areaY..areaY+areaHeight,
  full width) starting with `startsWith` → boundaries.
- middle: embedPage with clip box (ratio 0.2–0.8), vertical=left/right,
  horizontal=top/bottom; `repagination` interleaves halves, `rightToLeft`
  swaps half order; without repagination all first halves come first.

**Server pdf.js.** `serverExternalPackages: ["pdfjs-dist"]` in next.config —
bundling breaks its worker import. `standardFontDataUrl` resolved from
node_modules; the standalone build copies `pdf.worker.mjs` + `standard_fonts`
(see package.json build script).

**OOXML writers.** docx: paragraphs from pdf.js lines (y-clustering), sizes
clamped 6–24pt. xlsx: one sheet per page (or singleSheet), inline strings,
numeric detection, 20pt column clustering. pptx: one full-bleed JPEG per slide
(pdftoppm), slide size derived from page pt dims (EMU = pt×12700).

**External engines.**
- compress: presets screen/ebook/printer/prepress (72/150/300/300 dpi) via gs
  `-dPDFSETTINGS` + duplicate-image/compress-font flags; falls back to lossless
  when gs output is bigger; never returns a larger file.
- grayscale: gs `-sColorConversionStrategy=Gray -dProcessColorModel=/DeviceGray`.
- repair: pdf-lib tolerant load → qpdf → gs escalation; reports which engine won.
- ocr: pdftoppm 200 dpi PNG → per-page tesseract (pdf/txt) → merge via pdf-lib.
- html-to-pdf: playwright-core drives the cached Chromium headless shell;
  supports url/file/code sources, print media emulation, delay, viewport
  width, A4/Letter, margins; URL failures map to FETCH_FAILED with cause.
- crop: 72 dpi grayscale render → non-white bbox per page → CropBox with margin.

**Security.**
- protect: pdf-lib AES-256 `encrypt` with the 7 Sejda permission flags.
- unlock: fresh-doc page copy drops /Encrypt; WRONG_PASSWORD on failure.
- remove-annotations: filters /Annots by /Subtype set (16 types); zero matches
  → honest "unchanged" note; deleting all empties the array entry.

**Automation.** workflows validates ≤5 steps, each slug in CHAINABLE, reuses
`validateParams` per step with current page count, pipes PDF outputs through
the store as intermediates, and reports each executed step in `note`.

## 4. Validation snippets (tasks.ts)

Helpers: `num` (range), `str` (maxLen/required), `oneOf` (enum, string|number),
`bool`, `pageSpec` + `parsePages/parseRanges` (bounds-checked against the
upload-time page count), `hexColor`. All unknown slugs → UNKNOWN_TOOL/404.
`validateTask` allows zero files only for html-to-pdf when source ≠ file.

## 5. Frontend wiring

- `tool-options.tsx`: `PARAM_DEFAULTS` (44) + per-tool forms; components Row /
  NumRow / Sel / Check. WorkflowBuilder re-renders `ToolOptionsInner`
  recursively per step; BookmarksEditor parses "Title | page | level" lines.
- `workspace.tsx`: GRID_MODE map (select/order/place) extends to pdf-editor +
  pdf-forms; `handlePlace` appends editor ops (text/rect/image) or form fields
  using current option-panel values; html-to-pdf flips between file/url/code
  phases; blockedReason encodes each tool's completeness rule.
- `page-grid.tsx`: place mode is now generic ("where the element goes").

## 6. Test layout

- Fixtures regenerated by `scripts/make-fixtures.ts` (15 files incl. corrupt
  + tilted + docx + html).
- `scripts/smoke-test.ts` (68 checks): every handler happy path + honest
  failures (NO_IMAGES, INVALID_PARAMS, workflows caps) + validation layer.
- `scripts/http-matrix.ts` (44 checks): every slug through upload-check →
  upload → task; signature-image uploads skip upload-check exactly like the UI.
