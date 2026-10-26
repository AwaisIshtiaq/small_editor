# 20 — Bounded REA pass: public tool pages and the upload → task → result lifecycle

**Status:** COMPLETE for the bounded scope
**Date:** 2026-10-25 UTC
**Target:** public `https://www.sejda.com`, logged out
**Fixture:** `samples/sample.pdf` — 2,924 bytes, SHA-256 `5ef833b674aa0e691eb7b9b6a063402876500553997215eff905d786cf76d319`
**Environment:** Chrome 155.0.8059.85; 1440×900 at device scale 1; `en-US`; UTC; light; reduced motion; service workers bypassed; cache disabled; no account, payment, or private document.

**Evidence bundle:** `reports/evidence/rea-bounded-pass.bundle.json`
**Bundle size / SHA-256:** 6,347,689 bytes / `9fecd9a1d13504645a8c53c63a262ea968cf3cb41a1a34f984a2262a9680c006`
**REA records:** 9; **unknowns:** 0
**Raw lifecycle trace:** `reports/_raw/rea-upload-task-network.json` (20,325 bytes; `art_338ccde…`)
**Sanitized trace:** `reports/_raw/rea-upload-task-network.sanitized.json` (signed token and per-session ids redacted)
**Screenshots:** `reports/_raw/rea-split-ready.png`, `reports/_raw/rea-split-result.png`
**Result ZIP:** `reports/_raw/rea-split-result.zip` (6,881 bytes; `art_16a2bc…`)

---

## 1. Scope and adjustments

The earlier plan said “10 SDK-mapped tools plus upload/task lifecycle.” The public README list contains **nine unique routes**: split-by-size appears twice, and the bookmark route is actually `/split-pdf-by-outline`, not `/split-pdf-by-bookmarks`. I captured all nine unique routes and then exercised one complete split task. A tenth adjacent route (`/organize-pdf`) was **not** captured; it is not one of the SDK-mapped nine.

The page captures used `capture_browser_scenario`. The file upload itself used a small CDP script (`reports/_raw/rea-upload-task.mjs`) because REA scenario actions do not expose a `set_input_files` action. The script drove the page’s own `input.fileupload`, clicked the page’s own buttons, and stayed logged out. It did not bypass authentication, a paywall, or a security boundary.

## 2. Tool-page inventory

All nine pages are server-rendered HTML with a shared bundle and (usually) a page-specific script. Each page exposes a `data-task` value, an upload form, and a task form.

| Route | H1 | `data-task` | File input | Submit label |
|---|---|---|---|---|
| `/split-pdf` | Split PDF by pages | `splitByPages` | `.pdf`, multiple | Split PDF by pages |
| `/merge-pdf` | Merge PDF Files Online | `merge` | `.pdf,.png,.gif,.jpg,.jpeg,.tif,.tiff,.bmp,.webp`, multiple | Merge PDF files |
| `/split-pdf-by-outline` | Split PDF by bookmarks | `splitByBookmarks` | `.pdf`, multiple | Split by bookmarks |
| `/split-pdf-by-size` | Split PDF by file size | `splitBySize` | `.pdf`, multiple | Split PDF by size |
| `/alternate-mix-pdf` | Alternate & Mix Odd and Even PDF Pages | `alternateMix` | `.pdf`, multiple | Mix PDF files |
| `/extract-pdf-pages` | Extract pages from PDF online | `extractPages` | `.pdf`, multiple | Extract pages |
| `/header-footer-pdf` | Add PDF Header & Footer | `headerFooter` | `.pdf`, multiple | Add header/footer |
| `/rotate-pdf-pages` | Rotate PDF | `rotatePages` | `.pdf`, multiple | Apply changes |
| `/pdf-to-jpg` | Convert PDF to JPG, PNG or TIFF online | `pdfToImage` | `.pdf`, multiple | Convert |

Notes:

- The JPG tool uses `data-task="pdfToImage"`, not `pdfToJpg`.
- `/split-pdf-by-size` had no page-specific `js/pages/*.js` script in the captured DOM; its logic is likely in the shared bundle or an inline script.
- `data-multiple-files` is `true` for merge and alternate/mix, and `pro` for most single-file tools. The file input still has `multiple`; this is client-side gating, not proof of server enforcement.
- The upload form is the same on every page: `#fileUploadForm`, `method="post"`, `enctype="multipart/form-data"`, action `https://www.sejda.com/api/files/upload?_s=…&uplid=…`, with `data-chunked-uploads="true"` and `data-parallel-chunked-uploads="true"`.
- The task form is a separate `.form-inline.task-form` with a hidden `type` matching `data-task`.

### 2.1 Task-specific controls observed

| Task | Controls / values observed |
|---|---|
| `splitByPages` | `step=1`; `pages` (page ranges); `outputFilenamePattern=[BASENAME]-[CURRENTPAGE]`; `discardOutline`; step-2 choices: burst (every page), visually select, every X pages, every even page. |
| `merge` | `blankPageIfOdd`, `normalizePageSizes`, `firstInputCoverTitle`, `filenameFooter`; `outlinePolicy` (retain/discard/one_entry_each_doc/retain_as_one_entry); `tocPolicy` (none/file_names/doc_titles); `acroFormPolicy` (none/merge/merge_renaming/flatten); `mode=file`. |
| `splitByBookmarks` | `bookmarksLevel` 1/2/3; `bookmarksExpression`; `includePageAfter`; `outputFilenamePattern=[FILENUMBER]_[BOOKMARK_NAME]`. |
| `splitBySize` | `size=1.5`; `sizeUnit` MB/KB. |
| `alternateMix` | No static inputs; file order/step/reverse/repeat are built dynamically; submit “Mix PDF files”. |
| `extractPages` | `pages` odd/even/none or range text; `discardOutline`; `outputFilenamePattern=[BASENAME]`. |
| `headerFooter` | `pattern=Page [PAGE_ARABIC]`; repeated `hf-format-customize[]`; font (Times/Helvetica/Courier); `addMargins`; `pages`; `pageCountStartFrom`; `pageLocation` header/footer left/center/right; `fontSize` 6–28; colour `#000000`. |
| `rotatePages` | No static rotation input captured; rotation is canvas-driven; submit “Apply changes”. |
| `pdfToImage` | `resolution` 75/150/220; `imageFormat` jpg/png/tiff; `tiffSingleFileWithAllPages`; `imageColorType` rgb/grayscale/black_white; `outputFilenamePattern=[BASENAME]-[CURRENTPAGE]`; submit “Convert”. |

### 2.2 Bundle analysis

`analyze_web_bundle` on `/merge-pdf` observed 2 scripts: shared 803,543 B and page 5,377 B (`ev_5c82…`). On `/pdf-editor` it observed 3 scripts: shared 803,543 B, editor 394,992 B, and a 327 B script (`ev_e19…`). The static analyzer found only two endpoint candidates on each page (`/contact/suggest-answer` and another contact route), so it did not recover the dynamically constructed upload/task calls. I therefore downloaded the same public scripts and searched the shipped source directly. The shared bundle contains the literals and call sites for the lifecycle below. Shared/editor hashes match the existing artifacts `art_17dea15…` and `art_f83a8da…`.

## 3. Observed upload → task → result lifecycle

One logged-out split task, default “extract every page” choice.

| # | Request | Request shape | Response |
|---|---|---|---|
| 1 | `POST /api/files/upload-check` | `application/x-www-form-urlencoded`; `uplid=<redacted>` | `200 application/json`, 15 B: `{"status":"ok"}` |
| 2 | `POST /api/files/upload?_s=&uplid=<redacted>` | `multipart/form-data`; `X-FileLocalId: <redacted>`; `Content-Disposition: attachment; filename="sample.pdf"` | `200 application/json`, 64 B: `{"id":"<file-id>"}` |
| 3 | `POST /api/tasks` | `application/json`; payload below | `200 application/json`, 23 B: `"<task-id>"` (bare JSON string) |
| 4 | `GET /api/tasks/<task-id>/change?_=<timestamp>` | cache-buster query | `200 application/json`: `status:"Completed"` plus result metadata |
| 5 | Result page | `/result?id=<task-id>`; the page URL also showed `#results-<task-id>` | “Your documents are ready” modal |
| 6 | `GET /api/tasks/<task-id>/download/<filename>?s=<redacted>&d=true&_s=<redacted>` | signed capability URL from the change response | `200 application/zip`, 6,881 B, four PDFs |
| 7 | `POST https://a.sejda.com/api/event` | `text/plain` JSON pageview | `202`, body `ok` |

### 3.1 Task request (observed, ids redacted)

```json
{
  "type": "splitByPages",
  "step": "1",
  "pages": "all",
  "outputFilenamePattern": "[BASENAME]-[CURRENTPAGE]",
  "files": ["<file-id>"],
  "uri": "/split-pdf",
  "specificResultFilenames": ["", "", "", ""],
  "userAgent": "<browser UA>",
  "cvts": "0.10",
  "pdfjs": "bebd506c3",
  "libsCache": "654",
  "consoleLogs": ["Setting splitStep 1"],
  "traceId": "tr-<id>",
  "www": "www23.sejda.com"
}
```

The response was not an object; it was a JSON string containing the task id. The request includes client build/telemetry fields (`cvts`, `pdfjs`, `libsCache`, `consoleLogs`, `traceId`, `www`) that are not necessary for a minimal reconstruction.

### 3.2 Task-change response (observed shape, values sanitized)

```json
{
  "status": "Completed",
  "type": "splitByPages",
  "resultFilename": "sejda-DDYEYK.zip",
  "resultFileSize": 6896,
  "resultFullUrlPattern": "www.sejda.com/api/tasks/<task-id>/download/{{filename}}?s=<redacted>&d=true&_s=<redacted>",
  "warnings": [],
  "resultItems": ["sample-1.pdf", "sample-2.pdf", "sample-3.pdf", "sample-4.pdf"],
  "id": "<task-id>"
}
```

Only `Completed` was observed. Other status values, failure bodies, and polling cadence remain unknown.

### 3.3 Result download

- The downloaded ZIP was **6,881 bytes**; the task metadata said **6,896 bytes**. The 15-byte difference is unexplained. The ZIP contains `sample-1.pdf`, `sample-2.pdf`, `sample-3.pdf`, and `sample-4.pdf`.
- The result page showed the ZIP name and a Download button; the inline preview said “Document cannot be previewed” because the output was a ZIP.
- Individual PDF page counts were not independently parsed; the file sizes and names are consistent with one page per output from the four-page fixture.
- The download URL is a short-lived signed capability. It is redacted in this report and in the sanitized trace.

## 4. Endpoint inventory

### 4.1 Observed in this pass

| Method | Path | Status | Notes |
|---|---|---|---|
| POST | `/api/files/upload-check` | observed | Form `uplid`; returns `{"status":"ok"}`. |
| POST | `/api/files/upload` | observed | Multipart; `uplid` in query and form; `X-FileLocalId`; returns file id. |
| POST | `/api/tasks` | observed | JSON task submission; returns bare task-id string; rate-limit headers. |
| GET | `/api/tasks/{id}/change` | observed | Status/result polling; `Completed` + result metadata. |
| GET | `/api/tasks/{id}/download/{filename}` | observed | Signed capability; returned the result ZIP. |
| POST | `https://a.sejda.com/api/event` | observed | First-party pageview analytics; 202 `ok`. |
| GET | `/result?id=…` | observed | Result page; not an API, but part of the flow. |

### 4.2 Client references not exercised

| Method | Path | Source | Note |
|---|---|---|---|
| POST | `/api/files/upload-chunked` | shared bundle | Chunked path for files above 5,000,000 B; four concurrent chunks. |
| POST | `/api/files/{id}/password` | shared bundle | JSON `{password}`; for encrypted files. |
| POST | `/api/files/{id}/touch` | shared bundle | Keeps uploaded files alive every 30 min while a task is open. |
| POST | `/api/files` | shared bundle | Link/cloud-file import (`{url}`). |
| GET | `/api/files/client-view` | shared bundle | `?url=` cloud-file viewer. |
| DELETE | `/api/tasks/{id}` | shared bundle | Recent-task delete. |
| POST | `/api/tasks/{id}/cancel` | shared bundle | `window.cancelTask(id)`. |
| POST | `/contact/suggest-answer` | shared bundle | Support/contact search, not PDF processing. |

### 4.3 Client constants (derived, not server-confirmed)

- `maxChunkSize = 5000000` bytes; `maxConcurrentChunks = 4`.
- Uploaded file `expires_at = Date.now() + 36e5` (one hour).
- `touch` interval 1,800,000 ms (30 minutes).
- Free-tier text: 30 files/hour, 3 tasks/hour, 50 MB/file, 5 MB/image, one file per task for some tools.
- The observed task response reported `X-RateLimit-Remaining: 2` and `X-RateLimit-Wait: 3599`, consistent with the 3-tasks/hour client text for this one session. The scope (IP, cookie, account) is not established.

## 5. Findings and confidence

| Finding | Confidence | Basis |
|---|---|---|
| The nine unique public tool routes exist and expose the task types and forms above. | **CONFIRMED** | `ev_efde…`, DOM capture, 2026-10-25. |
| The public upload → task → poll → download sequence works logged out. | **CONFIRMED** | `art_338ccde…`, `art_16a2bc…`. |
| `POST /api/tasks` returns a bare JSON string task id. | **CONFIRMED** | Captured response body. |
| `GET /api/tasks/{id}/change` returns `Completed` plus result metadata. | **CONFIRMED** | Captured response body. |
| The server performed the split and produced four PDFs. | **CONFIRMED** | Downloaded ZIP with four PDFs; task metadata. |
| A free-tier rate limit exists and is exposed via headers. | **CONFIRMED** | `X-RateLimit-Remaining`, `X-RateLimit-Wait`. |
| The processing is asynchronous and polled. | **STRONGLY INFERRED** | Task id → `/change` polling → `Completed`; no synchronous result in the task response. |
| The download is a signed capability. | **STRONGLY INFERRED** | `s=web-…` token in the result URL; the exact validation policy is unknown. |
| Chunked upload, password, touch, cancel, delete, and cloud import are implemented on the client path. | **POSSIBLE** | Literal/call sites in the shipped bundle; not exercised. |
| The web backend is Java. | **UNKNOWN** | No Java/framework fingerprint; `Server: cloudflare`; no web-backend artifact. |
| The queue, worker, storage, retention, and database are Java/Spring. | **UNKNOWN** | No server-side artifact. |
| The other 35 public tools use the same lifecycle. | **POSSIBLE** | Shared upload/task code and common task form; only one task type exercised. |

### 5.1 Java question

This pass **does not change the Java verdict**:

- The official `torakiki/sejda` SDK is a Java PDF library, confirmed in report `19`.
- The public web API is HTTP/JSON and is compatible with Java, but also with Node, Python, .NET, Go, or a split service architecture.
- The observed responses still show only `Server: cloudflare`; no `JSESSIONID`, `X-Powered-By`, `X-Application-Context`, Tomcat/Jetty banner, or Spring error page was observed.
- The **sejda.com web backend** remains **UNKNOWN**. A web-layer artifact is still required.

## 6. Security and data-handling observations

- **No auth was required** for one small free task. This is the public free path, not an auth bypass.
- `uplid` and `X-FileLocalId` are correlation identifiers, not credentials.
- The result download is a **short-lived signed capability**. It is not an account-authenticated download in this path.
- The captured upload/task/change responses set **no `Set-Cookie`**; the requests carried **no `Authorization` header**; no CSRF token field was visible. This is **not** proof that no CSRF defence exists: cookie request headers were not exposed by this CDP capture, and the server may rely on origin checks or same-site cookies.
- CORS allowed `https://www.sejda.com` with credentials and `Vary: Origin`.
- Observed headers included `X-Firefox-Translate: disable`, `X-Frame-Options: SAMEORIGIN`, `Cache-Control: no-cache, private, no-store, no-transform`, and `Pragma: no-cache`.
- No CSP header was observed on these responses. That is a bounded observation, not a full security review.
- The fixture is a 2,924-byte synthetic test PDF, not private data. No bulk upload, account, payment, or destructive action was performed.
- The raw trace contains a short-lived signed URL. The report and sanitized trace redact it.

## 7. Limitations and unknowns

1. **One task, one fixture, one session.** No statistical claim about rate limits or reliability.
2. **Only `Completed` was observed.** No failure, cancellation, timeout, password-protected, or chunked path.
3. **The multipart upload body was not exposed** by CDP; field names come from the page form, not the raw body bytes.
4. **Cookie request headers were not exposed.** The “no Authorization / no CSRF token” observation is bounded.
5. **The step-2 choice cards were stale**: they displayed “12 pages / 12 docs” for the four-page fixture, while the task produced four PDFs. The cause is not established.
6. **The 15-byte ZIP size difference** (metadata 6,896 vs download 6,881) is unexplained.
7. **No server artifact.** The backend language, framework, queue, worker, storage, retention, database, auth, and payment provider remain unknown.
8. **No other task types.** The nine pages were loaded, but only `splitByPages` was submitted.
9. **The signed URL was used once** for the result download; expiry and revocation behavior were not tested.
10. **The result PDFs’ internal page counts** were not independently parsed; only filenames and the task metadata were checked.

## 8. Reproducibility

```text
# Page pass (REA record ev_efde…)
reports/evidence/rea-bounded-pass.bundle.json

# Live upload/task pass (requires a Chrome CDP target on 127.0.0.1:9333)
node reports/_raw/rea-upload-task.mjs

# Inspect the result ZIP
unzip -l reports/_raw/rea-split-result.zip
sha256sum reports/_raw/rea-split-result.zip

# Static endpoint search
rg -o -N '.{0,300}/api/(files|tasks).{0,500}' reports/_raw/sejda-js/shared.js
```

The CDP script assumes a live page target at `https://www.sejda.com`; it creates no account and uses only the public page UI. The raw trace can be replayed against the saved JSON; the signed URL will have expired.

## 9. Ledger updates

- Added claims `C-0058`–`C-0066`:
  - C-0058: nine tool routes and task types.
  - C-0059: full lifecycle.
  - C-0060: task request/response shape.
  - C-0061: change/result/download.
  - C-0062: rate-limit headers.
  - C-0063: ZIP contents and size discrepancy.
  - C-0064: cookie/Authorization/CSRF/CORS observations.
  - C-0065: stale “12 pages” choice text.
  - C-0066: client-only chunked/expiry/touch/password/cancel paths.
- Updated `C-0055` (no Set-Cookie also on task/change), `C-0056` (new responses still no Java fingerprint), and `C-0057` (bounded pass did not verify the web backend).
- Updated `unknowns.md` U6/U10, `site-re/sites/sejda-com/report.md` §4, `07-api-contracts.yaml` to v0.2.0, and the dossier index/evidence index.

## 10. Bottom line

The public client contract is now much better evidenced: **the upload, task submission, status polling, result metadata, and signed ZIP download are confirmed**, including one real split task. That still does **not** identify the server runtime. The public evidence supports “there is a real asynchronous PDF-processing service behind sejda.com,” but not “the web backend is Java.” The Java SDK/engine remains separately confirmed; the web backend remains **UNKNOWN / BLOCKED** without a server artifact.
