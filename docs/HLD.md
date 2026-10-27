# HLD — Small Editor (Sejda-style PDF toolbox)

Status: implemented (44 tools — Sejda's full public catalog — engine-tested 68/68,
HTTP-verified 44/44, production build green). This document describes the system
as it is built, not as it is imagined.

## 1. System context

Small Editor is a free toolbox that performs 44 document operations on PDFs,
images, HTML and Word files — mirroring sejda.com's 44 public tool routes 1:1
(catalog source: `upload/extracted/samples/reports/coverage/tools.csv`).
Users pick a tool, upload files, configure options, and download results.
The product deliberately mirrors Sejda's server model: **files are ephemeral** —
everything uploaded or produced is deleted automatically after ~2 hours.
Available as a web app and as a desktop app (Electron wrapping the same engine).

Honest scope boundaries (per RULES.md §2 — the app never pretends):
- "Fill & Sign" places a drawn signature image; it is NOT cryptographic/PAdES.
- PDF→Word / PDF→Excel / PDF→PPT are text/geometric reconstructions (docx/xlsx/
  pptx writers), best for text-centric documents — the UI says so.
- OCR supports the installed language packs (English); the UI states this.
- Split-by-size estimates from average page weight and verifies each chunk.
- Tools needing external engines (LibreOffice, Ghostscript, qpdf, poppler,
  tesseract, headless Chromium) fail with honest ENGINE_* errors when a binary
  is absent rather than faking results.

## 2. Architecture

Single Next.js 16 (App Router) application, TypeScript end to end. One deployable
unit; no external services, no database (state is intentionally disposable).

```
┌────────────────────────── Browser ──────────────────────────┐
│ page.tsx (view state: home | workspace(tool))               │
│   Header/SearchBar ─ Home (10 category grids)               │
│   Workspace ─ ToolOptions / PageGrid / SignaturePad         │
│   WorkflowBuilder (step chains) · editor op placement       │
│   pdfjs-client: thumbnails, page selection                  │
└──────────────┬──────────────────────────────────────────────┘
               │ fetch (same origin)
┌──────────────▼──────────── Route Handlers (Node) ────────────┐
│ POST /api/upload-check   pre-flight validation               │
│ POST /api/upload         temp store + page count             │
│ POST /api/tasks          validate → handler → store results  │
│ GET  /api/tasks/[id]     task record (polling contract)      │
│ GET  /api/files/[id]     result download                     │
│ GET  /api                health/limits discovery             │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼──────────── Engine (src/lib/pdf-tools) ───────┐
│ registry.ts       44 tools / 10 Sejda categories             │
│ tasks.ts          server-side validation, limits, errors     │
│ handlers.ts       HANDLERS map (assembles the 3 families)    │
│  ├ handlers-core.ts    organize/split/geometry + shared      │
│  ├ handlers-convert.ts images/text/word/ppt/excel/html      │
│  └ handlers-editsec.ts  edit/security/scans/automation      │
│ pdfjs-server.ts   server-side text + outline extraction      │
│ writers.ts        minimal OOXML writers (docx/xlsx/pptx)     │
│ bin.ts            subprocess runner (gs/qpdf/soffice/...)    │
│ store.ts          TTL temp store (files + sidecar meta, 2h)  │
│ tasklog.ts        in-memory task records                     │
│ ratelimit.ts      3 tasks/h per IP, LIMITS_ENFORCED switch   │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼── External engines (subprocess / bundled) ────┐
│ pdftoppm  rasterize (PDF→JPG/PNG/TIFF, crop, deskew, OCR,    │
│           flatten-rasterize, PDF→PPT)                        │
│ gs        compression presets, grayscale, repair fallback    │
│ qpdf      xref recovery (repair)                             │
│ soffice   Word→PDF                                           │
│ tesseract OCR (eng)                                          │
│ chromium  HTML→PDF (Playwright headless shell)               │
│ sharp     image decode/re-encode (extract-images, crops)     │
└──────────────────────────────────────────────────────────────┘
```

## 3. The 44-tool catalog (Sejda 1:1)

Categories mirror Sejda's sidebar groups; slugs map to Sejda's `data-task` types.

| Category | Tools |
|---|---|
| Compress | compress (gs presets + lossless) |
| Edit & Sign | pdf-editor (text/whiteout/image ops), sign, pdf-forms (AcroForm fields), delete-pages |
| Split | extract-pages, split (ranges/step), split-bookmarks, split-middle, split-size, split-text |
| Merge | merge (normalize/blank-page options), alternate-mix, organize |
| Security | protect (AES-256 + 7 permissions), unlock, watermark (text/image), flatten (forms/rasterize) |
| Convert from PDF | pdf-to-excel (xlsx/csv), pdf-to-jpg (jpg/png/tiff, dpi, gray), pdf-to-ppt, pdf-to-text, pdf-to-word |
| Convert to PDF | html-to-pdf (url/file/code via Chromium), jpg-to-pdf (6 image formats), word-to-pdf (LibreOffice) |
| Other | crop, bates-numbering, edit-bookmarks, edit-metadata, extract-images, flip, grayscale, header-footer, n-up, page-numbers, rename, repair, resize, rotate, remove-annotations |
| Scans | deskew (projection-profile skew detection), ocr |
| Automate | workflows (chain up to 5 CHAINABLE tools, output→input piping) |

Every route observes Sejda's API lifecycle: upload-check → upload → POST /api/tasks →
(poll) → download. Multi-file results ship as ZIPs, named like Sejda's
`[BASENAME]-<n>.<ext>` pattern.

## 4. Data flow & lifetime

1. **Upload-check** — tool-aware type/size gate (no bytes moved yet).
2. **Upload** — bytes to TTL store (tmp dir + sidecar JSON), PDFs get a page
   count parsed once; images (signatures/watermarks/editor assets) upload the
   same way and are referenced by id in task params.
3. **Task** — validation against the registry shape (ranges checked against the
   stored page count), then the handler runs. Subprocess handlers write to
   private scratch dirs that are always cleaned up.
4. **Results** — output bytes stored under fresh ids (same TTL); the client
   downloads via `/api/files/[id]`.
5. **Sweep** — janitor deletes files + metadata older than 2 h (10 min cycle).

## 5. Limits & deployment

- `LIMITS_ENFORCED=false` (current testing mode): Sejda-style limits inactive.
  `=true`: 50 MB/file, 200 pages, 3 tasks/h per IP, Sejda error codes.
- Web deployment: Next standalone (Docker), engines preinstalled in the image.
- Desktop: Electron spawns the standalone server locally (127.0.0.1:3847);
  renderer is sandboxed with no Node access; files never leave the machine.
  See `desktop/README.md` for packaging (AppImage/deb/nsis/dmg).

## 6. Quality gates

- `bun scripts/make-fixtures.ts` → 15 fixtures (multi-page, bookmarks, images,
  annotations, AcroForm, encrypted, corrupt, tilted scan, docx, html).
- `bun scripts/smoke-test.ts` → 68 engine assertions across all 44 tools.
- `bun scripts/http-matrix.ts` → 44/44 tools through the real HTTP surface.
- `bun run build` → standalone production bundle (boot-verified).
