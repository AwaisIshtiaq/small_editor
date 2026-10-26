# Task 6 — UI layer (Small Editor)

Agent: ui-builder (Task ID 6)

## Files created / modified
- `src/lib/pdfjs-client.ts` — client-only pdf.js helper: `loadPdf` (WeakMap-cached doc per bytes object, copies buffer before handing to worker), `renderThumb(bytes, pageNum, maxW=160)` → `{dataUrl, width, height}` where width/height are PAGE SIZE IN PDF POINTS (scale-1 viewport), `renderPageJpeg(bytes, pageNum, dpi=150, opts?)`, `pageCount(bytes)`.
- `src/components/tool-icon.tsx` — `TOOL_ICONS` record (all 44 slugs, no duplicates) + `ToolIcon({slug, className})`. Pure lucide mapping, server-safe.
- `src/components/site-header.tsx` — sticky header, emerald-dot wordmark, centered search (max 8 results, ArrowUp/Down/Enter/Escape, click-outside close, combobox ARIA), "All tools" link.
- `src/app/layout.tsx` — new metadata ("Small Editor — Free online PDF tools"), root wrapper `min-h-screen flex flex-col`, footer after children with `mt-auto`, safe-area-inset padding, real `{TOOLS.length} tools` count.
- `src/app/page.tsx` — server component, 10 category sections in Sejda order, tool cards (Card + ToolIcon emerald, name, line-clamp-2 desc) → `/workspace?tool=slug`, `hover:border-emerald-500/50 hover:shadow-sm`.
- `src/app/globals.css` — ONLY primary/primary-foreground/ring swapped to emerald-600 (light) / emerald-500 (dark) oklch in :root and .dark; appended `.slim-scroll` scrollbar utility. Token structure untouched.
- `src/app/workspace/page.tsx` — awaits `searchParams: Promise`, `getTool`, not-found empty state, `generateMetadata` per tool, Suspense wrapper around client.
- `src/components/workspace-client.tsx` — phases files → options → processing → done (+ error). upload-check → upload (single multipart, in-order) → file chips → options (ToolOptions | EditorCanvas | PageGrid(organize) | WorkflowBuilder) → POST /api/tasks → 800ms poll → DownloadPanel. pdf-to-jpg client flow (pdf.js render → fflate zipSync → `<name>-pages.zip` direct download); TIFF selection falls back to server task path. Errors parsed from `{error:{code,message}}` into amber Alert.
- `src/components/tool-options.tsx` — `PARAM_DEFAULTS` for ALL 44 slugs (shapes match tasks.ts validators, verified line-by-line), `ToolOptionsInner` (controlled per-slug forms), `ToolOptions` (state + local required-field validation + Run), `SPECIAL_SLUGS`, `optionError`.
- `src/components/page-grid.tsx` — thumbnails grid (3/4/5/6 cols), select mode (emerald ring toggle, 0-based) and order mode (HTML5 draggable + up/down arrows, new order as original indices), max-h with slim scroll.
- `src/components/signature-pad.tsx` — 500×160 canvas, pointer events, stroke #111/2.5 round caps, Clear button, debounced 300ms `toBlob('image/png')` → `onReady(blob|null)`.
- `src/components/workflow-builder.tsx` — CHAINABLE-only step list, per-step ToolOptionsInner, add/remove/reorder, Run → `{type, params}[]`.
- `src/components/editor-canvas.tsx` — one component for sign/pdf-editor/pdf-forms: page selector, 900px render, percentage-positioned overlays so CSS scaling never breaks coords. sign: SignaturePad → auto-upload `/api/upload` (signature.png) → click places → Run `{pageNumber,x,y,width:150,imageDataId}`. pdf-editor: Text (inline input, Enter/blur commits, Escape cancels) | White-out (drag, red/40 preview, commits white rect), ops chips. pdf-forms: click places `field_N` textfield ops. All overlay coords are pt with TOP-LEFT origin (see convention note below).
- `src/components/download-panel.tsx` — output rows (name + fmtSize KB/MB), per-file download links, "Download all" via sequential anchor clicks 300ms apart.

## Verification (all green)
- `bunx eslint src` → 0 problems (project `bun run lint` OOMs on the huge `upload/` reference dump, so lint scoped to src).
- `bunx tsc --noEmit` filtered to my files → 0 errors. (Pre-existing errors in `src/app/api/upload/route.ts`, `src/lib/pdf-tools/tasks.ts`, `next.config.ts`, `examples/`, `skills/` belong to other agents / scaffold — untouched.)
- `curl /` → 200, contains "Merge PDF", "Search 44 tools…", footer copy + "44 tools".
- `curl /workspace?tool=merge` → 200; `?tool=sign` → 200; `?tool=organize` → 200; `?tool=nope` → "Tool not found".
- dev.log: `✓ Compiled`, only warning is `Package pdfjs-dist can't be external ... pdf.worker.min.mjs` — caused by `serverExternalPackages: ['pdfjs-dist']` in next.config (other agent's file) tracing my client worker URL during the SSR pass; non-fatal, all routes render 200.

## ToolIcon slug→icon map
compress→FileArchive, pdf-editor→SquarePen, sign→PenTool, pdf-forms→TextCursorInput, delete-pages→FileMinus, extract-pages→FileOutput, split→Scissors, split-bookmarks→BookmarkPlus, split-middle→Columns2, split-size→Scale, split-text→Type, merge→Combine, alternate-mix→Shuffle, organize→LayoutGrid, protect→Lock, unlock→LockOpen, watermark→Stamp, flatten→Layers, pdf-to-excel→Table, pdf-to-jpg→ImageDown, pdf-to-ppt→Presentation, pdf-to-text→AlignLeft, pdf-to-word→FileText, html-to-pdf→Globe, jpg-to-pdf→ImagePlus, word-to-pdf→FileType2, crop→Crop, bates-numbering→ReceiptText, edit-bookmarks→Bookmark, edit-metadata→FileCog, extract-images→FileImage, flip→FlipHorizontal, grayscale→Contrast, header-footer→PanelTop, n-up→Grid2x2, page-numbers→Hash, rename→Pencil, repair→Wrench, resize→Maximize, rotate→RotateCw, remove-annotations→Eraser, deskew→Frame, ocr→ScanText, workflows→Workflow.

## Convention for editor coords (HANDLER AGENTS READ THIS)
sign / pdf-editor / pdf-forms UI sends x,y in PDF points with **top-left origin** (y grows downward), matching the worklog line "y TOP-LEFT based (convert to PDF bottom-left: y_pdf = pageHeight − y_ui − drawHeight)". So handlers must convert: `y_pdf = pageHeight − y_top − drawnHeight`. `sign.width` is fixed 150pt; `textfield.width` fixed 160pt; text ops fontSize 16, color #111111; rect color #ffffff.

## Deviations from spec (small, deliberate)
1. **pdf-to-jpg**: options phase IS shown (pages/resolution/format/grayscale via ToolOptions) and *Run* triggers the client render→zip→download flow, instead of Continue intercepting with defaults. Server task path used when TIFF selected (browser can't encode TIFF). Keeps "zero-server" flow while giving users param control.
2. **renderThumb width/height** = page size in pt (not rendered px) — callers need pt for coordinate math; aspect identical.
3. **renderPageJpeg** takes optional 4th arg `{grayscale, format}` (needed by the client jpg/png flow; jpg+default dpi unchanged).
4. Run buttons live inside ToolOptions / EditorCanvas / WorkflowBuilder (they own their state; onRun receives built params), workspace owns only organize's "Apply order" button. Matches the `ToolOptions({slug,onRun,running})` signature in the task.
5. remove-annotations offers type checkboxes (highlight/underline/strikethrough/squiggly/link/note/stamp/freehand) defaulting to `[]` — validator only requires strings; handler should map these to PDF annotation subtypes (flag: pick these names or tell me to change the UI options).
6. `unlocks password`, `split-bookmarks.level=1`, `rename.renamePattern='{text}'`, `header-footer.color=#111111`, `bates.text=''`, `grayscale.compressImages=true`, `jpg-to-pdf.mergeOutputs=true`, `rotate.pages='all'` — sensible defaults chosen where spec was silent; all validator-compatible.
