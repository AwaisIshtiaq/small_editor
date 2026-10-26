# Reconstructed PDF backend PoC

An **independent, local-only** backend reconstruction of the public
`sejda.com` upload → task → result lifecycle. It is **not** Sejda's backend,
it does **not** contain Sejda source or bytecode, and it does **not** use the
Sejda SDK.

- Public behaviour reference: [`../reports/20-bounded-rea-pass.md`](../reports/20-bounded-rea-pass.md)
- Approval/design context: [`../reports/17-reconstruction-proposal.md`](../reports/17-reconstruction-proposal.md)
- Java/web-backend distinction: [`../reports/19-official-sejda-sdk-review.md`](../reports/19-official-sejda-sdk-review.md)

## What this proves

| Question | Result |
|---|---|
| Can an independent Java service implement the observed upload → task → poll → download flow? | **Yes — POC VERIFIED** |
| Does this show that the real `sejda.com` backend is Java? | **No — UNKNOWN** |
| Does this use the Sejda SDK? | **No — Apache PDFBox 2.0.32** |
| Does it implement the nine bounded task types? | **Yes locally — 6 observed end-to-end, 3 inferred from static forms; public `encrypt` is outside this PoC** |
| Is this production-ready? | **No** |

## Licensing decision

The project needs a PDF engine. The two realistic routes are:

1. **Apache PDFBox 2.0.32** — Apache License 2.0; permissive; no network
   copyleft. This PoC uses this route.
2. **Sejda SDK** — the official SDK/engine is Java and AGPLv3 (or commercial
   under a separate Sejda license). Choosing it would make the combined
   network service subject to AGPLv3 obligations unless a commercial license is
   obtained. It is **not** used here.

**Decision for the PoC:** Apache PDFBox, to keep the reconstruction independent
and free of AGPL/commercial entanglement. The PoC code is MIT-licensed; the
vendored PDFBox jars remain Apache-2.0. If a production build needs Sejda's
broader task coverage, make the AGPLv3-versus-commercial decision explicitly
before adding the SDK.

## Bookmark fixture

`../samples/sample-bookmarks.pdf` is generated from the 4-page fixture by
`tools/MakeBookmarkedFixture.java`. To regenerate it:

```bash
cd reconstructed-backend
bash build.sh
javac --release 17 -cp "lib/*" -d out tools/MakeBookmarkedFixture.java
java -cp "out;lib/*" MakeBookmarkedFixture ../samples/sample.pdf ../samples/sample-bookmarks.pdf
```

The fixture has level-1 bookmarks `Chapter 1` (page 1), `Chapter 2` (page 2),
`Chapter 3` (page 4) and level-2 bookmarks `Section 1.1` (page 1),
`Section 2.1` (page 3). The path separator in the `java -cp` example is
Windows-style; use `:` on Linux/macOS.

## Requirements

- JDK 17 or newer. Tested with **OpenJDK 23.0.1**.
- No Maven or Gradle. The three required jars are in `lib/` (unmodified,
  downloaded from Maven Central; SHA-1 values matched Maven Central, SHA-256
  values are in `lib/SHA256SUMS.txt` and `THIRD_PARTY_NOTICES.md`).
- Node 18+ only for the optional smoke test.

The service uses the JDK's built-in `com.sun.net.httpserver`, so run with
`--add-modules jdk.httpserver`.

## Build and run

### Git Bash / Linux

```bash
cd reconstructed-backend
bash build.sh
bash run.sh
```

### PowerShell

```powershell
cd reconstructed-backend
.\build.ps1
.\run.ps1
```

Default bind: **`127.0.0.1:18080`**. Set `PORT` to change it. The data directory
is a private temporary directory, printed at startup. It is deleted on a clean
shutdown.

## Smoke test

```bash
cd reconstructed-backend
node smoke.mjs
```

The smoke test starts the service on `127.0.0.1:18081`, then verifies:

- health;
- multipart upload of `../samples/sample.pdf`;
- `splitByPages` with `step=1`, four outputs, ZIP download;
- `merge` of two uploads, one 8-page PDF result;
- `extractPages` with `pages=1,3-4`, two outputs;
- `rotatePages` with `angle=90`, one PDF result;
- `splitByBookmarks` at level 1, three outputs, from the bookmark fixture;
- `splitBySize` with a tiny target, multiple chunks;
- `alternateMix` of two 4-page inputs, one 8-page PDF;
- `headerFooter` with the observed `Page [PAGE_ARABIC]` default, one PDF;
- `pdfToImage` at 150 dpi JPG, four 1240×1753 JPEGs in a ZIP;
- unsupported `ocr` becomes a failed task;
- negative cases: non-PDF upload `400`, unknown file `400`, unknown task
  download `404`, delete task.

The generated files are in `out/`. Result sizes vary between runs because PDF
timestamps and compression are not deterministic.

## Endpoints

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/health` | **implemented** | service/version/data dir/PDFBox version |
| `GET` | `/` | **implemented** | small HTML usage page |
| `POST` | `/api/files/upload-check` | **implemented** | returns `{"status":"ok"}` |
| `POST` | `/api/files/upload` | **implemented** | multipart field `file`, or raw `application/pdf` |
| `POST` | `/api/tasks` | **implemented** | JSON; returns a bare JSON string task id |
| `GET` | `/api/tasks/{id}/change` | **implemented** | `Processing`, `Completed`, `Failed`, `Canceled` |
| `GET` | `/api/tasks/{id}/download/{filename}` | **implemented** | unsigned local URL; ZIP, PDF, or image |
| `POST` | `/api/tasks/{id}/cancel` | **implemented** | basic `Future.cancel` |
| `DELETE` | `/api/tasks/{id}` | **implemented** | removes task metadata and result |
| `DELETE` | `/api/files/{id}` | **implemented** | removes the uploaded file |
| `POST` | `/api/files/{id}/password` | **501** | deliberately not implemented |
| `POST` | `/api/files/upload-chunked` | **not implemented** | public client reference only |
| `POST` | `/api/files/{id}/touch` | **not implemented** | public client reference only |
| `POST` | `/api/files` (cloud/link import) | **not implemented** | public client reference only |
| `GET` | `/api/files/client-view` | **not implemented** | public client reference only |

### Implemented task types

| Type | Request fields | Output |
|---|---|---|
| `splitByPages` | `step` (default 1), `pages` (`all` or ranges), `outputFilenamePattern` | one PDF per group; multiple outputs become a ZIP |
| `extractPages` | `pages` (e.g. `1,3-4`), `outputFilenamePattern` | one PDF per range; multiple outputs become a ZIP |
| `merge` | `files[]` with two or more ids | one merged PDF |
| `rotatePages` | `angle` (90/180/270; default 90) | one rotated PDF |
| `splitByBookmarks` | `bookmarksLevel` (1–3), `bookmarksExpression` (title contains), `includePageAfter`, `outputFilenamePattern` | one PDF per bookmark section; multiple outputs become a ZIP |
| `splitBySize` | `size` (default 1.5), `sizeUnit` (`MB`/`KB`) | greedy page-range chunks; multiple outputs become a ZIP |
| `alternateMix` | `files[]` (2+), `reverse[]`, `step[]`, `repeat[]` | one interleaved PDF |
| `headerFooter` | `pattern`, `hf-format-customize`, `pageLocation`, `font`, `fontSize`, `color`, `addMargins`, `pages`, `pageCountStartFrom`, `outputFilenamePattern` | one PDF with page text |
| `pdfToImage` | `pages`, `allPages`, `resolution`, `imageFormat`, `imageColorType`, `outputFilenamePattern`, `tiffSingleFileWithAllPages` | JPG/PNG/TIFF; multiple images become a ZIP |

Other task types return a failed task with
`Task type is not implemented in this PoC: <type>`. They are not silently
mapped to a different operation.

Six of the nine types now have end-to-end public observations: `splitByPages`,
`merge`, `headerFooter`, `pdfToImage`, `splitByBookmarks` (level 1 and title
filter) and `alternateMix` (default order). The remaining three inferred types
(`splitBySize`, `extractPages`, `rotatePages`) are local approximations of the
public form semantics. None of the local outputs is byte-identical to the
public service. `encrypt` is observed publicly but is outside this bounded
nine-type PoC. Local limitations:

- `splitByBookmarks` uses PDFBox outline items at the requested level; the
  public site’s exact handling of duplicate/missing destinations is unknown.
  `includePageAfter` follows the page’s tooltip: add one extra page at the end
  of each split document.
- `splitBySize` greedily writes candidate ranges and keeps the largest one at
  or under the target. It is not byte-identical to the vendor’s splitter.
- `alternateMix` implements the observed `files[]`, `reverse[]`, `step[]` and
  `repeat[]` payload arrays with a regular A1, B1, A2, B2 order.
- `headerFooter` supports `[PAGE_ARABIC]`, `[PAGE_ROMAN]`,
  `[TOTAL_PAGES_ARABIC]`, `[TOTAL_PAGES_ROMAN]` and `[BASE_NAME]`; unknown
  tokens remain literal. The public site may support more tokens.
- `pdfToImage` uses PDFBox rendering; JPG/PNG/TIFF are supported when the JDK
  ImageIO provider is available. TIFF multi-page mode is attempted with the
  JDK TIFF writer and fails clearly if no writer exists.

## Example

```bash
BASE=http://127.0.0.1:18080

# 1. Upload
FILE_ID=$(curl -sS -F "file=@../samples/sample.pdf;type=application/pdf" \
  "$BASE/api/files/upload" | python -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "$FILE_ID"

# 2. Submit a split task. The response is a bare JSON string task id.
TASK_ID=$(curl -sS -H "Content-Type: application/json" \
  -d "{\"type\":\"splitByPages\",\"step\":\"1\",\"pages\":\"all\",\"outputFilenamePattern\":\"[BASENAME]-[CURRENTPAGE]\",\"files\":[\"$FILE_ID\"],\"uri\":\"/split-pdf\"}" \
  "$BASE/api/tasks" | python -c 'import json,sys; print(json.load(sys.stdin))')
echo "$TASK_ID"

# 3. Poll
curl -sS "$BASE/api/tasks/$TASK_ID/change?_=$(date +%s%3N)"

# 4. Download the result. Substitute the resultFilename returned in step 3.
RESULT_FILENAME='poc-...-split.zip'
curl -sS -o result.zip "$BASE/api/tasks/$TASK_ID/download/$RESULT_FILENAME"
unzip -l result.zip
```

Raw upload also works:

```bash
curl -sS -H "Content-Type: application/pdf" \
  --data-binary @../samples/sample.pdf \
  "$BASE/api/files/upload"
```

## What matches the observed sejda.com contract

| Public sejda.com observation | This PoC |
|---|---|
| `POST /api/files/upload-check` → `{"status":"ok"}` | yes |
| `POST /api/files/upload` multipart → file id | yes; also raw PDF |
| `POST /api/tasks` JSON → bare task-id string | yes |
| `GET /api/tasks/{id}/change` → status + result metadata | yes; statuses include `Processing`/`Completed`/`Failed`/`Canceled` |
| Result ZIP with one PDF per output page | yes for the implemented split |
| `resultFilename`, `resultFileSize`, `resultItems`, `warnings` | yes |
| Six observed task types (`splitByPages`, `merge`, `headerFooter`, `pdfToImage`, `splitByBookmarks`, `alternateMix`) | yes, locally verified |
| Three form-inferred task types (`splitBySize`, `extractPages`, `rotatePages`) | yes, local approximation |
| Public `encrypt` task (AES-256) | **no** — outside the bounded PoC |
| Signed download URL | **no** — local unsigned URL |
| Rate-limit headers | **no** — no rate limiter in the PoC |
| Chunked upload, password, touch, cloud import | **no** |
| Auth, accounts, payments, retention, queue/DB | **no** |
| Browser CORS/CSRF policy | **no** — local-only, no CORS |
| Sejda SDK | **no** — Apache PDFBox |

The PoC deliberately keeps the **same core JSON shape** where it is cheap to do
so, but it is not byte-for-byte compatible and does not claim to be.

## Architecture

```text
src/main/java/com/example/pdfpoc/
  Main.java       HTTP routing, upload, task submit/poll/download, limits
  Json.java       minimal JSON parser/writer
  Multipart.java  minimal multipart/form-data parser
  Store.java      in-memory maps + private temp directory
  PdfService.java PDFBox split/extract/merge/rotate/bookmarks/by-size/mix/header-footer/image rendering + ZIP packaging
  tools/MakeBookmarkedFixture.java  deterministic bookmark fixture generator
```

- HTTP pool: 4 threads.
- Task pool: 2 threads; each task runs asynchronously, sleeps 150 ms so a
  poller can observe `Processing`, then executes. `pdfToImage` and
  `splitBySize` are CPU/IO heavier than the initial four types; this is still
  not a production queue.
- Storage: temp files only; no database, no object store, no restart
  persistence.
- Upload limit: 50 MB; bodies must start with `%PDF-`.
- Output filenames are sanitized; download names are reduced to a basename.

## Security

This is a local development PoC, not a hardened service.

- Binds to `127.0.0.1` only; do not expose it to a network.
- No authentication, authorization, CSRF protection, rate limiting, TLS,
  malware scanning, or tenant isolation.
- PDF parsing is an attack surface. Do not process untrusted PDFs in production
  without isolation/sandboxing and dependency updates.
- Temp files are deleted on a clean shutdown; a crash can leave them behind.
- Uploaded files are not encrypted at rest.
- The service does not execute PDF JavaScript, but PDFBox still parses complex
  structures.

## Production gaps

If this becomes more than a PoC, the next steps are:

1. Choose Spring Boot (or another framework) and a build tool; add integration
   tests, configuration, and a container image.
2. Add object storage, a database for task metadata, and a durable queue/worker
   (the public behaviour is asynchronous and polled; the internals are
   **UNKNOWN**).
3. Add authentication/authorization, signed download URLs, retention/deletion
   policy, rate limiting, CSRF/origin policy, and audit logging.
4. Add chunked uploads, password-protected files, touch/keepalive, cloud-file
   import, cancellation, and the remaining public task types (OCR, Office
   conversion, forms/sign, security, and the other tools outside the nine
   bounded types).
5. Decide the PDF engine licensing route before adding the Sejda SDK:
   **AGPLv3** or a **commercial** license. The current PoC avoids that choice
   by using Apache PDFBox.
6. Validate output fidelity against the public site with a broader fixture set.

## Verification log

- `bash build.sh` → compiled successfully with JDK 23.0.1 and `--release 17`.
- `node smoke.mjs` → **PASS** for health, upload, all nine bounded task types,
  unsupported task, and negative cases.
- Independent checks: split outputs 1 page each; merge 8 pages for two 4-page
  inputs; extract `1` + `3-4` = 1 + 2 pages; bookmarks level 1 = 3 outputs
  totaling 4 pages; size chunks total 4 pages; alternateMix = 8 pages;
  header/footer text is extractable above the body; PDF-to-JPG images are
  1240×1753 at 150 dpi.
- No Sejda SDK classes or jars are present; the only PDF jars are PDFBox,
  FontBox, and Commons Logging.
