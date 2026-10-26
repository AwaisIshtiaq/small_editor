# Worklog

---
Task ID: recovery-3
Agent: main (Z.ai)
Task: Third sandbox reset wiped ALL source code. Rebuild the 44-tool Sejda clone (web + engine + desktop) from in-context captures. Registry, desktop/*, worklog lessons were captured verbatim this session; everything else is rebuilt from documented knowledge.

Work Log:
- Detected wipe: only .git(5 files, no code), .env, scripts/sejda_sitemap.xml, upload/, skills/, download/ survived
- Ran fullstack init script; bun add @cantoo/pdf-lib@2.11.1 fflate@0.8.3 pdfjs-dist@6.4.299
- Verified binaries intact: soffice 25.2, tesseract 5.5, gs 10.05, qpdf 12.2, pdftoppm 25.03
- Rewrote foundation: next.config.ts (standalone, ignoreBuildErrors, serverExternalPackages=[pdfjs-dist], turbopack.persistentCaching=false), registry.ts (44 tools VERBATIM), errors.ts, mime.ts, parse.ts (parsePageSelection + parsePageCount), store.ts (TTL 2h + janitor + meta sidecars), ratelimit.ts (LIMITS_ENFORCED switch), tasklog.ts, http.ts, tasks.ts (per-slug param validators), taskstate.ts, types.ts (TaskContext contract), runner.ts (buildContext), handlers.ts (aggregate: coreHandlers/convertHandlers/editsecHandlers)
- API routes: upload-check, upload (pageCount parsed at upload!), tasks (POST async + GET poll), tasks/[id], files/[id], health
- Restored desktop/main.js + package.json (electron-builder AppImage/deb/nsis/dmg) + README

Stage Summary:
- Foundation contract: handlers export Record<slug, TaskHandler>; ctx = {taskId, files, params, readBuf, workdir, putOutput, adoptOutput, progress}
- Next: agents build handlers families + UI in parallel

---
Task ID: knowledge-base (reference from previous builds — VERIFIED lessons, keep forever)
Agent: main (Z.ai)

## @cantoo/pdf-lib 2.11.1 API (verified via scripts/verify-deps.ts in build 2)
- `PDFDocument.load(bytes, { ignoreEncryption: true })` loads encrypted docs
- `doc.encrypt({ userPassword, ownerPassword, permissions })` then `save()` → AES-256
- **CRITICAL**: after `load()` with password, `save()` KEEPS /Encrypt → unlock must COPY pages into a `PDFDocument.create()` fresh doc
- `doc.embedPage(page, { left, bottom, right, top })` supports bbox + negative scale (split-middle uses it)
- `doc.embedJpg/embedPng` for images; embedTiff/embedGif/embedBmp NOT supported by pdf-lib → for jpg-to-pdf non-jpg/png inputs, convert via bin (ImageMagick absent → use soffice? NO — use gs or pdftoppm reverse) — ACTUALLY: build 3 approach: jpg/png direct; gif/bmp/tiff/webp → render via `pdftoppm` on a one-image PDF made by... simplest verified path: embed via canvas-free pure-JS decode is out of scope → convert with `gs -sDEVICE=png16m` wrapping input in a minimal PDF via pdf-lib embed of raw? — DECISION from build 2: non-embeddable images go through `soffice --convert-to pdf`? NO. Build 2 verified path: `bin.run('bash', [...])` NOT allowed... FINAL: image-to-pdf for gif/bmp/tiff/webp uses gs: `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -o out.pdf input.bmp` (gs reads images directly). USE THIS.
- pdf-lib font: StandardFonts.Helvetica/TimesRoman/Courier (+Bold/Oblique variants); WinAnsi encoding — sanitize text: replace non-WinAnsi chars with '?' or strip (CRASH otherwise on smart quotes/emoji)
- `PDFString` vs `PDFName`: setTitle must take PDFString (build 2 bug: Name crashed)
- Permissions bits in @cantoo: permissions: { printing: 'highResolution'|'lowResolution'|false, copying/modifying/annotating/formFilling/contentAccessibility/documentAssembly: boolean }

## pdf.js (pdfjs-dist 6.x)
- Server: `pdfjs-dist/legacy/build/pdf.mjs`, set `standardFontDataUrl` to node_modules copy; standalone build must COPY pdf.worker.mjs + standard_fonts into output (build 2 lesson) — with output:'standalone', copy via script after build or reference by absolute path from process.cwd()… SAFEST: pdfjs-server.ts sets `getDocInitParams` with standardFontDataUrl pointing at `require.resolve`-style path via `path.join(process.cwd(),'..','..','node_modules/pdfjs-dist/standard_fonts/')` — verify at runtime, fall back gracefully (only affects font metrics fidelity)
- Client: `pdfjs-dist/build/pdf.mjs` + worker via `new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url))` — Turbopack handles this; disable persistentCaching (done)
- text items: `page.getTextContent()` → items[{str, transform, width, height}] — transform[5]=y baseline, transform[4]=x

## External binaries (ALL VERIFIED PRESENT: /usr/bin/{soffice,tesseract,gs,qpdf,pdftoppm})
- bin.ts: spawn with timeout 120s, capture stdout/stderr, throw TaskError('FAILED') with trimmed stderr
- soffice: `soffice --headless --convert-to pdf --outdir <dir> <input>` (word-to-pdf, .doc too); concurrent soffice needs separate UserInstallation profile: `-env:UserInstallation=file://<tmpdir>/lo-profile`
- tesseract: `tesseract input.png outbase -l eng pdf` (searchable PDF) / `txt` (text); render PDF pages to PNG first via pdftoppm
- pdftoppm: `pdftoppm -png|-jpeg|-tiff -r <dpi> in.pdf out-prefix` → outputs `out-prefix-N.png` (build 2 lesson: prefix-N.ext naming + `-png` for grayscale `-gray`)
- qpdf: `qpdf --decrypt in.pdf out.pdf` (repair path), `qpdf --check` (repair detection)
- gs: compress: `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=/screen|/ebook|/printer|/prepress -dNOPAUSE -dBATCH -o out.pdf in.pdf` (+ `-sColorConversionStrategy=Gray -dProcessColorModel=/DeviceGray` for grayscale); image→pdf for gif/bmp/tiff/webp: `-sDEVICE=pdfwrite`
- deskew: render page via pdftoppm → estimate skew — SIMPLEST honest impl: ImageMagick absent; use tesseract's OSD? NO — build 2 used: pdftoppm render → naive projection-profile skew estimate in pure JS on the PNG bitmap (decode PNG via pdfjs? no) → DECISION build 2: skew estimated via gs-render + simple Hough-lite on bitmap using `pngjs`? NOT INSTALLED. FINAL (build 2, verified 68/68): deskew renders with pdftoppm at 150dpi, decodes PNG with a minimal pure-TS PNG decoder (zlib inflate via fflate + defilter), computes projection-profile skew over ±10°, rotates bitmap, rebuilds PDF with gs from images. That was heavy; SIMPLER build-3 alternative that stays honest: use gs `-sDEVICE=pdfwrite` after `pdftoppm` + re-embed WITHOUT deskew = not honest. KEEP build-2 approach (png decoder exists in fflate ecosystem: use `fflate` inflate + manual defilter — ~60 lines, verified).
- split-size: iterate pages, accumulate estimated page bytes (totalSize/pages heuristic + real doc check via pdf-lib save), open new doc when limit crossed
- crop: render 72dpi via pdftoppm → measure white margins per page from bitmap → set CropBox via pdf-lib
- html-to-pdf: source=url needs fetch + render — NO headless browser in engine build 2 (Playwright chromium IS cached in sandbox for agent use only). Build 2 used: fetch HTML → inline as simple layout via pdf-lib text? NO — build 2 VERIFIED: html-to-pdf renders via headless chromium IF available (`~/.cache/ms-playwright`), else falls back to text-only PDF via pdf.js text extraction → pdf-lib. Build 3: check `chromium` presence via `npx playwright` cache; fallback documented honestly in UI. ALSO source=code/file: same pipeline.
- pdf-to-word: pdf.js text extraction → writers.ts DOCX (paragraph blocks with x/y grouping into lines) — TEXT-FOCUSED converter (honest label in UI)
- pdf-to-excel: pdf.js text items → column clustering by x-gaps → rows → writers.ts XLSX or CSV
- pdf-to-ppt: render each page via pdftoppm → full-slide image → writers.ts PPTX 16:9
- writers.ts (fflate zip + hand XML, build 2 verified): docx minimal OOXML (w:document, paragraphs, runs, bold/size), xlsx (workbook.xml, sheet1.xml inline strings, sharedStrings optional — inlineStr cells simplest), pptx (p:sld with pic full-bleed, presentation.xml sldSz 12192000x6858000 16:9, rels, content types) — ALL zips built with fflate.zipSync
- extract-images: walk XObject image streams via pdf-lib lowlevel? Build 2 used pdf.js `page.getOperatorList()` → OPS.paintImageXObject → objs stored in page.objs? UNRELIABLE. Build 2 FINAL: pdf.js `page.getOperatorList()`, track `fnArray` paint ops, fetch from `page.objs`/`page.commonObjs` async get → raw RGBA → encode PNG via fflate (png encoder ~80 lines, build 2 had pure-TS PNG encode). KEEP.
- flatten rasterize: pdftoppm -r resolution → rebuild PDF from images (gs pdfwrite)
- ocr: pdftoppm -r 300 → tesseract per page → searchable pdf (tesseract pdf output merges via gs) / text via tesseract txt
- workflows: chain CHAINABLE tools; each step feeds previous outputs (as input files); build synthetic ctx per step by reusing parent ctx fns; validate each step's params via validateParams; skip 'workflows' slug itself

## Sejda DNA API contract (build 1+2 verified in browser)
- POST /api/upload-check {type,size,pages} → {ok,reasons}
- POST /api/upload multipart → {files:[{id,name,size,pages,mime}]}
- POST /api/tasks {type,fileIds,params} → {taskId} (async processing)
- GET /api/tasks/:id → {status:processing|done|failed, progress, outputs, error}
- GET /api/files/:id → bytes (content-disposition)
- Errors: {error:{code,message}} with proper HTTP codes (errors.ts map)
- TTL 2h, janitor 60s; LIMITS_ENFORCED=false default (unlimited testing), true → 3 tasks/h, 50MB, 200 pages

## UI contract (build 2 browser-verified)
- Home `/`: header with search (keyboard nav), category sections ×10, tool cards (icon, name, desc) → `/workspace?tool=slug`
- Workspace phases: files → options → processing (progress) → done (download list)
- page-grid component: thumbnails via pdf.js client render; modes: select (delete/extract pages), order (organize), place (sign/editor placement)
- signature-pad: canvas pointer draw → PNG → auto-upload → sign params {pageNumber,x,y,width,imageDataId}; y TOP-LEFT based (convert to PDF bottom-left: y_pdf = pageHeight - y_ui - drawHeight)
- tool-options: PARAM_DEFAULTS per slug in one module; per-tool form fields
- pdf-to-jpg: CLIENT flow (pdf.js render → fflate zip download, zero server); API parity via server handler (pdftoppm) for http-matrix
- PARAM_DEFAULTS must exist for ALL 44 slugs (workflows step options reuse ToolOptionsInner recursively)
- honest labels: pdf-to-word/text "text-focused", OCR "English only", compress quality labels

## Testing (build 2: 68/68 smoke + 44/44 http-matrix)
- scripts/make-fixtures.ts: alpha-5p.pdf, beta-3p.pdf, encrypted-pw-test123.pdf, 1x1-red.png, sample.docx, sample.html, corrupt.pdf (truncated), tilted.pdf, multi-image.pdf, bookmarks.pdf, form.pdf, table.pdf
- scripts/smoke-test.ts: engine-level, imports handlers directly with real store, covers all 44 + regression (pageCount, unlock fresh-doc, split-size bounds)
- scripts/http-matrix.ts: all 44 via HTTP against dev server
- Run with: `bun run scripts/smoke-test.ts` (dev server must be up for http-matrix)
- Sandbox: CDP file injection delivers 0-byte files → inject fixtures via DataTransfer in browser tests (agent-browser)

---
Task ID: 4-a/4-b/6/8 (parallel agents)
Agent: full-stack-developer x4
Task: Parallel rebuild of handlers families, UI layer, test harness.

Work Log:
- 4-a: bin.ts (runBin/sofficeConvert/pdfToImages/gsPdfWrite/gsImageToPdf/qpdfRepair/tesseractRun), pdfjs-server.ts (extractTextPages/extractOutline, workerSrc fix), writers.ts (docx/xlsx/pptx + PNG codec via zlibSync), handlers-core.ts (19 slugs; gs 10.05 has NO raster delegates → gsImageToPdf re-encodes via sharp/soffice fallback)
- 4-b: handlers-convert.ts (9 slugs; chromium-discovery html-to-pdf with honest text fallback), handlers-editsec.ts (16 slugs incl. manual /Outlines builder, workflows chaining)
- 6: full UI — site-header search (keyboard nav), home 10 categories, workspace phases, PARAM_DEFAULTS all 44, page-grid (select/order DnD), signature-pad, editor-canvas (sign/edit/forms), workflow-builder, download-panel, emerald theme
- 8: make-fixtures (22 fixtures), smoke-test 55/55, http-matrix 44/44; engine fixes: split-text change-detection semantics, pdf-to-excel raw-item clustering (extractTextItems added), qpdf okExitCodes [3], extract-images resolution gate removed

Stage Summary:
- Engine 44/44 green at both engine and HTTP level
- App renders: home 200 with 44 tools, health API ok

---
Task ID: 9
Agent: main (Z.ai)
Task: Replicate uploaded "Small Editor" landing page 1:1 and wire every feature on it to the real 44-tool engine.

Work Log:
- Extracted upload/small-editor.zip (landing: index.html 360L, dark-grey+orange theme, Plus Jakarta Sans + Instrument Serif, glass navbar, hero frame-engine demo, 45 tool cards, rating, Web/Desktop Remotion webp cards, 9 how-to guides, footer)
- Copied assets to public/assets/: logo.svg, web.webp, desktop.webp (Remotion renders shipped pre-rendered — no remotion install needed)
- src/styles/landing.css: original CSS verbatim, fonts -> next/font vars, bare element selectors scoped (.se-nav, .se-home h1/h2/section/footer), unused .gd/.gl/.gs legacy blocks dropped; added .mg-search style
- globals.css rewritten: Small Editor palette as shadcn tokens (dark default #232323/#2e2e2e/#FF5A09; light #f6f2ee warm) -> whole app incl. workspace rethemed; light follows prefers-color-scheme per DESIGN.md
- layout.tsx: Plus_Jakarta_Sans + Instrument_Serif via next/font, new metadata
- components/landing/data.ts: 45 landing tools mapped to 44 slugs (Visual Combine & Reorder + Organize -> organize), icons IT/IC, 9 guides, languages, footer tools
- landing-nav.tsx (client): glass pill nav, All Tools mega menu with live search (React controlled-input fix verified), 29-language dropdown, mobile overlay, quick links -> real tool routes
- hero-demo.tsx (client): frame engine port (FPS 30, interpolate/spring/seq, scenes Text/Highlight/Sign, rAF gated by IntersectionObserver + reduced-motion)
- landing-effects.tsx (client): .rv scroll reveals + guide band frame animation
- landing-footer.tsx: 3 columns, tool links -> real slugs
- page.tsx: full assembly, every card/CTA/guide link -> /workspace?tool=slug (or /desktop for Mac guide)
- New pages: /desktop (electron-builder instructions per platform), /pricing (Web/Desktop/API), /api-docs (real REST lifecycle + all slugs)
- Removed all emerald remnants in workspace components -> text/border/bg-primary (orange)
- Verified: hero typing+signature+toast animation, dark & light themes, mega search 45->5, merge UI e2e (alpha+beta -> merged 8p PDF download), smoke-test 55/55, http-matrix 44/44, mobile iPhone 15 layout

Stage Summary:
- Landing replicated 1:1 with every visible feature functional; 45/45 cards wired; engine untouched and green (55/55 + 44/44)
- Screenshots: download/landing-{hero,hero-dark,cards,apps,guides,mega,ws-done,landing-mobile}.png
