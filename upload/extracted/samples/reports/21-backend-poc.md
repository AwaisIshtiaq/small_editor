# 21 — Independent backend PoC

**Status:** **POC VERIFIED** — independent, local-only, no Sejda SDK; 9 bounded task types implemented
**Location:** `reconstructed-backend/`
**Language:** Java 17 source; compiled/run with OpenJDK 23.0.1
**PDF engine:** Apache PDFBox 2.0.32 (Apache-2.0)
**PoC code license:** MIT
**Network:** `127.0.0.1` only
**Date:** 2026-10-25 UTC

---

## 1. Decision

The approved independent backend PoC is built with:

- the JDK's built-in `com.sun.net.httpserver` (no framework, no Maven);
- **Apache PDFBox 2.0.32** for PDF operations;
- a small JSON parser/writer and multipart parser written for the PoC;
- in-memory task metadata and a private temporary directory for files.

It deliberately does **not** use the official Sejda SDK. The licensing choice is:

| Option | License | Decision |
|---|---|---|
| Apache PDFBox 2.0.32 | Apache-2.0 | **selected for the PoC** |
| Sejda SDK / engine | AGPLv3, or commercial | **not used**; if adopted later, the network-copyleft/commercial decision must be made first |
| PoC wrapper code | MIT | selected for this independent reconstruction |

This keeps the PoC free of AGPL obligations and commercial SDK terms. It also
means the PoC does **not** exercise Sejda's broader task coverage; it proves a
compatible lifecycle shape, not Sejda engine parity.

## 2. Scope

### Implemented — **POC VERIFIED**

- `GET /health`
- `POST /api/files/upload-check` → `{"status":"ok"}`
- `POST /api/files/upload` (multipart field `file`, or raw `application/pdf`)
- `POST /api/tasks` → bare JSON string task id
- `GET /api/tasks/{id}/change` → `Processing` / `Completed` / `Failed` / `Canceled`
- `GET /api/tasks/{id}/download/{filename}` → ZIP, PDF, or image
- `POST /api/tasks/{id}/cancel`
- `DELETE /api/tasks/{id}`
- `DELETE /api/files/{id}`
- `splitByPages` (step grouping or page ranges)
- `extractPages` (page ranges)
- `merge` (multiple inputs)
- `rotatePages` (90/180/270)
- `splitByBookmarks` (outline levels 1–3, title contains filter, extra end page)
- `splitBySize` (approximate greedy KB/MB chunking)
- `alternateMix` (2+ inputs, per-file `reverse`, `step`, `repeat`)
- `headerFooter` (observed text tokens, fonts, positions; 4-page output)
- `pdfToImage` (JPG/PNG/TIFF, 75/150/220 dpi, optional single TIFF)
- unsupported types → failed task, not a silent fallback

### Not implemented — **NOT IN THE POC**

- authentication, accounts, tenant isolation
- payment/paywall
- rate limiting
- chunked uploads above 5 MB
- password-protected PDFs
- touch/keepalive
- cloud/link import and `client-view`
- signed download tokens
- durable queue, database, object storage, retention
- OCR, Office conversion, forms/sign, security/encryption, and the other public
  task types outside the nine bounded types
- production CORS/CSRF/TLS/malware scanning
- Sejda SDK

### Non-goal

The PoC does **not** prove that the real `sejda.com` backend is Java. It proves
that an independent Java service can implement the observed public lifecycle.
The real backend remains **UNKNOWN** without a web-layer artifact.

## 3. Architecture

```text
reconstructed-backend/
  src/main/java/com/example/pdfpoc/
    Main.java       HTTP routing, upload, task submit/poll/download, limits
    Json.java       minimal JSON parser/writer
    Multipart.java  minimal multipart/form-data parser
    Store.java      in-memory maps + temp directory
    PdfService.java PDFBox split/extract/merge/rotate/bookmarks/by-size/mix/header-footer/image rendering + ZIP packaging
  tools/            MakeBookmarkedFixture.java (deterministic fixture generator)
  lib/              PDFBox 2.0.32, FontBox 2.0.32, Commons Logging 1.2
  build.sh / build.ps1
  run.sh / run.ps1
  smoke.mjs
  README.md
  LICENSE
  THIRD_PARTY_NOTICES.md
```

- HTTP executor: 4 threads.
- Task executor: 2 threads.
- A task sleeps 150 ms before processing so a poller can observe `Processing`.
  `pdfToImage` and `splitBySize` are heavier than the initial four types; this
  is not a production queue or a resource-isolation boundary.
- Files and task metadata are in memory; files are temp files. A restart loses
  everything.
- Upload limit: 50 MB. The body must start with `%PDF-`.
- Output filenames are sanitized; downloads reduce the requested name to a
  basename.
- The service binds to `127.0.0.1` only.

## 4. Behavioural parity with the observed public contract

| Observed public behaviour | PoC | Confidence / caveat |
|---|---|---|
| `upload-check` returns `{"status":"ok"}` | yes | **POC** |
| Upload returns a file id | yes; format differs (`uuid-POC_n`) | **POC** |
| Task submit returns a bare JSON string task id | yes | **POC** |
| Task status is polled via `/change` | yes | **POC** |
| Result metadata has `resultFilename`, `resultFileSize`, `resultItems`, `warnings` | yes | **POC** |
| Split produces one PDF per page, packaged as ZIP | yes | **POC VERIFIED** |
| Merge produces one 8-page PDF for two 4-page inputs | yes | **POC VERIFIED** |
| Header/footer adds extractable page text | yes; default `Page [PAGE_ARABIC]` | **POC VERIFIED** |
| PDF-to-JPG produces four 1240×1753 JPEGs in a ZIP | yes; 150 dpi | **POC VERIFIED** |
| Split by bookmarks | yes; PDFBox outline level 1–3 | **POC VERIFIED LOCALLY**; level-1/title-filter section boundaries now match a public observation (pages 1 / 2–3 / 4); levels 2–3 and `includePageAfter` remain inferred |
| Split by size | yes; greedy approximation | **POC VERIFIED LOCALLY**, not byte-identical; public boundaries unobserved |
| Alternate/mix | yes; A1, B1, A2, B2 with step/reverse/repeat | **POC VERIFIED LOCALLY**; default order now matches a public observation; non-default step/reverse/repeat remain inferred |
| Encrypt (AES-256) | no | **OBSERVED PUBLICLY**, outside the bounded nine-type PoC |
| Download is signed | no; unsigned local URL | intentional difference |
| Free-tier rate-limit headers | no | intentional difference |
| Chunked/password/touch/cloud paths | no | intentional gap |
| Task types beyond the nine bounded types | no | intentional gap |
| Sejda SDK engine | no | intentional licensing choice |
| Real sejda.com backend is Java | **not established** | **UNKNOWN** |

The JSON field names that were cheap to preserve are preserved (`type`,
`files`, `step`, `pages`, `outputFilenamePattern`, `resultFilename`,
`resultFileSize`, `resultItems`, `warnings`). The PoC is not byte-for-byte
compatible and does not claim to be. One deliberate local difference: the PoC’s
`resultFullUrlPattern` uses an unencoded `{{filename}}` placeholder, while the
observed public response used URL-encoded `%7B%7Bfilename%7D%7D`. Clients should
substitute both forms.

## 5. Verification

### Build

```text
$ bash build.sh
compiled to D:/small_editor/reconstructed-backend/out
```

Compiled with `javac --release 17 --add-modules jdk.httpserver` on OpenJDK
23.0.1.

### Smoke test

```text
$ node smoke.mjs
{
  "ok": true,
  "base": "http://127.0.0.1:18081",
  "split":       ["sample-1.pdf", "sample-2.pdf", "sample-3.pdf", "sample-4.pdf"],
  "merge":       "sample-merged.pdf (8 pages)",
  "extract":     ["sample-1.pdf", "sample-3-4.pdf"],
  "rotate":      "sample-rotated.pdf",
  "bookmarks":   ["1_Chapter_1.pdf", "2_Chapter_2.pdf", "3_Chapter_3.pdf"],
  "bySize":      ["sample-part-1.pdf", "sample-part-2.pdf", "sample-part-3.pdf", "sample-part-4.pdf"],
  "mix":         "sample-sample-mixed.pdf (8 pages)",
  "headerFooter":"sample.pdf (4 pages, header text extractable)",
  "pdfToImage":  ["sample-1.jpg", "sample-2.jpg", "sample-3.jpg", "sample-4.jpg"] (1240×1753),
  "unsupported": { "status": "Failed", "error": "Task type is not implemented in this PoC: ocr" }
}
```

The smoke test validates ZIP structure, PDF page counts, bookmark section
counts, image dimensions, and the header’s position above the body. The exact
byte sizes vary between runs because PDF timestamps/compression are not
deterministic. The verification run’s hashes:

| Output | Bytes | SHA-256 |
|---|---:|---|
| `out/smoke-split.zip` | 4,377 | `84e64bf68e6a8d2fc9386e7756c85f96dc1b2cc0460b91448a798528dd041a8a` |
| `out/smoke-merge.pdf` | 10,083 | `f4fdcf487b2dcd823258ff58587609477248efc8d71bb224fdd4cb33555dd331` |
| `out/smoke-extract.zip` | 2,681 | `5ffc7434cc85e08cd2592d078eaa983957996891849384e9567a0652e08611e9` |
| `out/smoke-rotate.pdf` | 4,784 | `9233bed02acc3a69ef48973f03b1e3a119c0ebcb44c1c5e2d67f303892270d0a` |
| `out/smoke-bookmarks.zip` | 3,806 | `0d3d9f53bb39d0f5b7c34366ebfd99c0d4c8f7d7a4a92d4b3134cd94be7ed597` |
| `out/smoke-by-size.zip` | 4,419 | `23e8dc9e2c886009c382f04d93e415cbea30e3607b06f5f972137676e7234c2e` |
| `out/smoke-mix.pdf` | 8,187 | `3f8bb0a1e9bfa53a0e20f51bc7163345a98b982ea63e4bfa57463b1759ad6ad5` |
| `out/smoke-header-footer.pdf` | 5,916 | `0dcfa4d535b3ddf55b16f4761af55796f2b02de6d62f9417787b446a14d6f2ba` |
| `out/smoke-images.zip` | 117,451 | `fd3158c37c142cefae9bf24109a585ed1ba5a63eb2bba7f7d4b61d888f09e973` |
| `out/smoke-result.json` | 4,056 | `4b84b8450a2ca3b2fe5c034c563d86d72fb8670406a4aedfeebeb5c83258142a` |

### Independent checks

- Split ZIP: four PDFs, one page each.
- Merge: two 4-page inputs → 8 pages.
- Extract `1,3-4`: two PDFs, 1 + 2 pages.
- Rotate 90°: 4 pages, page-0 rotation 90°.
- Bookmarks level 1: three PDFs (`Chapter 1`, `Chapter 2`, `Chapter 3`) with
  page counts **1, 2, 1**, totaling four pages; this matches the public
  split-by-bookmarks result for the same fixture.
- Split by size with a 0.001 MB target: four chunks totaling four pages.
- AlternateMix: two 4-page inputs → 8 pages.
- Header/footer: 4 pages; `Page 1` is extractable at y≈802, above the body.
- PDF-to-JPG: four JPEGs, each 1240×1753 RGB, at 150 dpi.

### Negative checks

- non-PDF upload → `400`
- task with unknown file id → `400`
- download for unknown task → `404`
- unsupported `ocr` → task `Failed` with an explicit error

## 6. Dependencies and licenses

| Jar | Version | License | SHA-256 |
|---|---|---|---|
| `pdfbox-2.0.32.jar` | 2.0.32 | Apache-2.0 | `ac2c82df0dd5fccc91ca691f3a1845fb0b06c57f183d2f4701570c1d842c37d7` |
| `fontbox-2.0.32.jar` | 2.0.32 | Apache-2.0 | `057983e9d4cabb9d649d286a5ae507a1d8e13b66744fd9432b3a0b3d04180fc3` |
| `commons-logging-1.2.jar` | 1.2 | Apache-2.0 | `daddea1ea0be0f56978ab3006b8ac92834afeefbd9b7e4e6316fca57df0fa636` |

The jars are unmodified and retain their own `META-INF` notices. SHA-1 values
matched Maven Central at download time. See
`reconstructed-backend/THIRD_PARTY_NOTICES.md`.

No Sejda jar, class, source, or SDK dependency is present.

## 7. Security posture

**Not production-ready.** The PoC is intentionally minimal.

- Binds to `127.0.0.1`; do not expose it to a network.
- No auth, authorization, tenant isolation, CSRF, CORS, TLS, or rate limiting.
- No malware scan or PDF sanitization; PDF parsing is an attack surface.
- 50 MB upload cap and `%PDF-` magic check only.
- Temp files are deleted on a clean shutdown; a crash can leave them behind.
- No encryption at rest.
- No signed download capability; any local process that can reach the port can
  download known task results.
- The task status endpoint reveals task metadata for known ids.
- The service does not execute PDF JavaScript, but PDFBox still parses complex
  structures.

For production, isolate parsing in a sandbox, enforce per-tenant quotas, use
signed URLs, scan uploads, and update dependencies.

## 8. How to run

```bash
cd reconstructed-backend
bash build.sh
bash run.sh
# in another terminal
node smoke.mjs
```

The bookmark smoke case uses `../samples/sample-bookmarks.pdf`. Regenerate it
from the 4-page fixture with:

```bash
cd reconstructed-backend
javac --release 17 -cp "lib/*" -d out tools/MakeBookmarkedFixture.java
java -cp "out;lib/*" MakeBookmarkedFixture ../samples/sample.pdf ../samples/sample-bookmarks.pdf
```

Use `:` instead of `;` in the classpath on Linux/macOS.

PowerShell:

```powershell
cd reconstructed-backend
.\build.ps1
.\run.ps1
```

Default endpoint: `http://127.0.0.1:18080`. Set `PORT` to change it. The data
directory is printed at startup and removed on clean shutdown.

## 9. Relationship to the investigation

- Report `20` confirms the public lifecycle and task payload shape.
- Report `22` confirms the 44-tool matrix and **seven** observed end-to-end
  task types (`splitByPages`, `merge`, `headerFooter`, `pdfToImage`,
  `splitByBookmarks`, `alternateMix`, `encrypt`).
- Report `19` confirms the official Sejda SDK/engine is Java, but is not the
  web backend.
- Report `17` contains the design/approval context.
- This report confirms an **independent** Java PoC can implement the observed
  lifecycle and nine bounded task types with Apache PDFBox. Six of the nine are
  now backed by end-to-end public observations: `splitByPages`, `merge`,
  `headerFooter`, `pdfToImage`, `splitByBookmarks` (level 1/title filter) and
  `alternateMix` (default order). Three remain local approximations:
  `splitBySize`, `extractPages` and `rotatePages`. `encrypt` was observed
  publicly but is outside the bounded PoC. None of the local outputs is
  byte-identical to the public service.

The remaining backend question is unchanged:

> **Sejda's PDF SDK/engine is Java. The sejda.com web backend is not established.**

Supplying a legitimate web-backend artifact (repo, JAR/WAR/EAR, image,
migrations, or sanitized config) is still required to verify the real backend.
The assistant cannot obtain or fabricate one.
