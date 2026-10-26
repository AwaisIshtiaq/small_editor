# 22 — 44-tool matrix and representative workflow pass

**Status:** Tool-page matrix **COMPLETE**; representative workflow pass **PARTIAL — 7/41 task types, 7/44 tool routes, 5/6 analytic families**
**Date:** 2026-10-25 UTC
**Target:** public `https://www.sejda.com`, logged out
**Environment:** Chrome 155.0.8059.85; 1440×900 at device scale 1; `en-US`; UTC; light; reduced motion; service workers bypassed; cache disabled
**Fixtures:** `samples/sample.pdf` and its identical copy `samples/sample-merge-b.pdf` — 2,924 bytes each, SHA-256 `5ef833b674aa0e691eb7b9b6a063402876500553997215eff905d786cf76d319`; `samples/sample-bookmarks.pdf` — 5,449 bytes, SHA-256 `20588968ba9ee1b3dd5f75a8b23f13bf9fd5baade6830a4b3a6b2913e80643cd`
**No account, payment, private document, auth bypass or rate-limit bypass was used.**

---

## 1. What changed

Two capture passes now cover all **44 public English tool routes**:

| Pass | Routes | Method | Result |
|---|---:|---|---|
| Static CDP page matrix | 35 | Navigate, render, capture DOM/JSON/PNG; no uploads or tasks | 35/35 captured, 0 errors, 0 challenges |
| Prior bounded REA pass | 9 | Existing bundle DOM/screenshots, re-parsed into the same schema | 9/9 parsed, 0 unknowns |

The 9 prior routes are `/split-pdf`, `/merge-pdf`, `/split-pdf-by-outline`, `/split-pdf-by-size`, `/alternate-mix-pdf`, `/extract-pdf-pages`, `/header-footer-pdf`, `/rotate-pdf-pages` and `/pdf-to-jpg`. The 35 new routes cover the remaining tools.

**CONFIRMED:** every tool page exposes a structured form or file workflow, including a file input, a task form, and (except `/workflows`) a `data-task` value. All 44 screenshots are 1440×900.

---

## 2. Authoritative inventory counts

The earlier shorthand “52 English routes” is the **sitemap count**, not the total known route count.

| Category | Count | Evidence |
|---|---:|---|
| Public English tool routes | **44** | `reports/coverage/tools.csv` |
| Tool routes with a `data-task` | **43** | `/workflows` is a builder and has no `data-task` |
| Unique `data-task` values | **41** | `coverage-build.json`; two pairs share: `edit` ×2, `headerFooter` ×2 |
| English sitemap routes | **52** | `sitemap.xml` |
| Tool routes in sitemap | 42 | 44 minus 2 menu-only routes |
| Menu-only tool routes | 2 | `/delete-pdf-annotations`, `/page-numbers-pdf` |
| Non-tool sitemap routes | 10 | home, desktop, developers, help, html-pdf-api, login, press, reset-password, teachers, upgrade |
| Extra known header route | 1 | `/account` (login-gated, absent from sitemap) |
| **Known unique English routes** | **55** | 44 tools + 10 non-tool sitemap + `/account` |
| Captured known unique routes | **51** | 44 tools + 7 non-tool pages |
| Localized routes | **1,344** | 28 locales × 48 routes |
| Localized non-English pages captured | **0** | localization sample not started |

The 4 uncaptured known routes are `/login`, `/reset-password`, `/press`, and `/account`.

### 2.1 Coverage snapshot

| Dimension | Covered | Total | Percent | Confidence |
|---|---:|---:|---:|---|
| English tool pages structured | 44 | 44 | 100.00% | CONFIRMED |
| English known unique routes captured | 51 | 55 | 92.73% | CONFIRMED |
| English sitemap routes captured | 49 | 52 | 94.23% | CONFIRMED |
| Unique task types exercised end to end | 7 | 41 | 17.07% | CONFIRMED |
| Tool workflows exercised | 7 | 44 | 15.91% | CONFIRMED |
| Representative workflow families exercised | 5 | 6 | 83.33% | ESTIMATE |
| Known processing API paths observed | 5 | 12 | 41.67% | CONFIRMED |
| Non-tool English pages captured | 7 | 11 | 63.64% | CONFIRMED |
| Non-English locales sampled | 0 | 28 | 0.00% | CONFIRMED |
| Localized route sample captured | 0 | 112 | 0.00% | CONFIRMED |
| Edge/error matrix executed | 0 | 8 | 0.00% | CONFIRMED |
| Account/payment surfaces exercised | 0 | 3 | 0.00% | BLOCKED |
| Web-backend internals verified | 0 | 7 | 0.00% | BLOCKED |
| SDK-mapped task types implemented in Java PoC | 9 | 9 | 100.00% | CONFIRMED locally |
| Observed task types implemented in Java PoC | 6 | 41 | 14.63% | CONFIRMED locally |
| **Composite public-behavior estimate** | — | — | **26.46%** | **ESTIMATE** |

The composite is an equal-weight heuristic across six public dimensions: tool pages 100, task types 17.07, API paths 41.67, locales 0, edge/error matrix 0, account/payment 0. It is **not** a single true percentage; inventory is complete while behavior is still early. The two PoC rows are local engineering metrics and are **not** part of the public-behavior composite. The observed-PoC row excludes `encrypt`, which is observed publicly but outside the bounded 9-type PoC.

The full machine-readable table is `reports/coverage/coverage.csv`; the route, tool and locale tables are `routes.csv`, `tools.csv` and `locales.csv`.

---

## 3. Representative workflow results

### 3.1 Split by pages — prior pass

- Route: `/split-pdf`; task type `splitByPages`.
- The 4-page fixture produced four one-page PDFs in a 6,881-byte ZIP.
- Task metadata reported 6,896 bytes; download was 6,881 bytes (15-byte difference, **UNKNOWN**).
- The step-2 cards displayed “12 pages / 12 docs” for the 4-page fixture; cause not established.
- This remains the only prior task; see report `20`.

### 3.2 Merge — `DCANA2XV-202610242358`

- Route: `/merge-pdf`; task type `merge`; two identical 4-page fixtures.
- The page auto-displays the file list; no separate `#step2Choices` container was present.
- Result: one 8-page PDF, **5,342 bytes**, SHA-256 `fb856fdd724095f853b1c7a6bcb732e9ca0d3c69c66a3d22cd4a01c28d420e96`.
- `pdf-lib` independently parsed **8 pages**.
- Task response was HTTP 200 with a bare JSON string id; `X-RateLimit-Remaining: 2`, `X-RateLimit-Wait: 3599`.
- Result screen: `reports/_raw/merge-result.png`.

Observed payload shape:

```json
{
  "type": "merge",
  "mode": "file",
  "outputFilename": "",
  "acroFormPolicy": "merge_renaming",
  "files": ["<upload-id>", "<upload-id>"],
  "uri": "/merge-pdf",
  "images": [],
  "rotations": [0, 0],
  "userAgent": "...",
  "cvts": "3.96",
  "pdfjs": "bebd506c3",
  "libsCache": "654",
  "consoleLogs": [],
  "traceId": "tr-...",
  "www": "www18.sejda.com"
}
```

### 3.3 Header/footer — `WWMHHDLK-202610250004`

- Route: `/header-footer-pdf`; task type `headerFooter`; one 4-page fixture.
- Defaults submitted: `Page [PAGE_ARABIC]`, `top-center`, Times New Roman, 10 pt, black, no added margins.
- Result: 4-page PDF, **4,251 bytes**, SHA-256 `7dab51e38e9cdcdb1d3fc18da75520f59b8d00990606293b9a4409a3e2130d4b`.
- Text extraction showed `Page 1`, `Page 2`, `Page 3`, `Page 4` in the page headers.
- Task metadata reported 4,256 bytes; download was 4,251 bytes (5-byte difference, **UNKNOWN**).
- Task response HTTP 200; `X-RateLimit-Remaining: 1`, `X-RateLimit-Wait: 3260`.
- Result screen: `reports/_raw/header-footer-pdf-result.png`.

Observed payload shape:

```json
{
  "type": "headerFooter",
  "outputFilenamePattern": "",
  "pattern": "Page [PAGE_ARABIC]",
  "hf-format-customize": ["Page", "[PAGE_ARABIC]", "Page", "[PAGE_ROMAN]", "Page", "[PAGE_ARABIC]", "of", "[TOTAL_PAGES_ARABIC]", "[BASE_NAME]", "Draft version"],
  "pageLocation": "top-center",
  "font": "times_roman",
  "fontSize": 10,
  "color": "#000000",
  "addMargins": false,
  "pages": "",
  "pageCountStartFrom": "",
  "files": ["<upload-id>"],
  "uri": "/header-footer-pdf"
}
```

### 3.4 PDF to JPG — `HH3HAKHS-202610250006`

- Route: `/pdf-to-jpg`; task type `pdfToImage`; one 4-page fixture.
- All pages selected implicitly: no page thumbnails selected, so the page’s own click handler sets `allPages=true`.
- Options: 150 dpi JPG, output pattern `[BASENAME]-[CURRENTPAGE]`.
- Result: ZIP with `sample-1.jpg`, `sample-2.jpg`, `sample-3.jpg`, `sample-4.jpg`; each **1240×1753 RGB** at 150 dpi.
- ZIP: **502,792 bytes**, SHA-256 `500183f8b7df341f07863e2d40d1a46baec083bcca4d824c61f6d0ada22bf80f`.
- Task metadata reported `resultFileSize: 502800`; download was 502,792 bytes (8-byte difference, **UNKNOWN**).
- Task response HTTP 200; `X-RateLimit-Remaining: 0`, `X-RateLimit-Wait: 3140`.
- Result screen: `reports/_raw/pdf-to-jpg-result.png`.

Observed payload shape:

```json
{
  "type": "pdfToImage",
  "pages": "",
  "allPages": true,
  "resolution": 150,
  "imageFormat": "jpg",
  "outputFilenamePattern": "[BASENAME]-[CURRENTPAGE]",
  "files": ["<upload-id>"],
  "uri": "/pdf-to-jpg"
}
```

---

### 3.5 Split by bookmarks — `N0TVSXU0-202610250100`

- Route: `/split-pdf-by-outline`; task type `splitByBookmarks`; one 4-page bookmark fixture.
- Submitted `bookmarksLevel=1`, `bookmarksExpression=Chapter`, and the default output pattern `[FILENUMBER]_[BOOKMARK_NAME]`; `includePageAfter` was unchecked and absent from the payload.
- Result: a 3-entry ZIP with `1_Chapter 1.pdf` (page 1), `2_Chapter 2.pdf` (pages 2–3) and `3_Chapter 3.pdf` (page 4). `pdf-lib` independently parsed page counts **1, 2, 1**.
- ZIP: **6,083 bytes**, SHA-256 `f15e8012d74322f086c886c8d992b43353ccf03ab41e3fed624fd603680fdff9`; task metadata reported 6,096 bytes (13-byte difference, **UNKNOWN**).
- Task response HTTP 200; `X-RateLimit-Remaining: 2`, `X-RateLimit-Wait: 3599`.
- Result screen: `reports/_raw/split-pdf-by-outline-result.png`.

Observed payload shape:

```json
{
  "type": "splitByBookmarks",
  "bookmarksLevel": "1",
  "bookmarksExpression": "Chapter",
  "outputFilenamePattern": "[FILENUMBER]_[BOOKMARK_NAME]",
  "files": ["<upload-id>"],
  "uri": "/split-pdf-by-outline",
  "userAgent": "...",
  "cvts": "0.13",
  "pdfjs": "bebd506c3",
  "libsCache": "654",
  "consoleLogs": [],
  "traceId": "tr-...",
  "www": "www22.sejda.com"
}
```

**CONFIRMED:** a level-1 bookmark starts its section at the bookmark page and the section ends immediately before the next bookmark page. The title filter `Chapter` matched all three level-1 entries. Level 2/3 and `includePageAfter` remain **UNOBSERVED**.

### 3.6 Alternate mix — `JSOZYMJP-202610250102`

- Route: `/alternate-mix-pdf`; task type `alternateMix`; two uploaded files, both 4-page fixtures with identical text but distinct upload ids.
- Default order was submitted: no reverse, step 1, no repeat.
- Result: one **8-page** PDF, **5,285 bytes**, SHA-256 `51d13570296d82722eef4ecdb9d5d93494daaf08c21c3095f9e2bb8172e664fc`; metadata reported 5,296 bytes (11-byte difference, **UNKNOWN**).
- Page text markers were `1,1,2,2,3,3,4,4`, matching A1, B1, A2, B2 … for two identical-content files. This is the default interleave, **CONFIRMED** for one observation.
- Task response HTTP 200; `X-RateLimit-Remaining: 1`, `X-RateLimit-Wait: 3483`.
- Result screen: `reports/_raw/alternate-mix-pdf-result.png`.

Observed payload shape:

```json
{
  "type": "alternateMix",
  "files": ["<upload-id-1>", "<upload-id-2>", null],
  "step": ["1", "1", "1"],
  "reverse": ["false", "false", "false"],
  "repeat": [false, false, false],
  "uri": "/alternate-mix-pdf",
  "userAgent": "...",
  "cvts": "...",
  "pdfjs": "bebd506c3",
  "libsCache": "654",
  "consoleLogs": [],
  "traceId": "tr-...",
  "www": "www22.sejda.com"
}
```

The third array slot was `null`; its purpose is not established, and it is not evidence of a third document. Non-default `step`, `reverse` and `repeat` behavior remains **UNOBSERVED**.

### 3.7 Encrypt — `UZ1ZDEX2-202610250102`

- Route: `/encrypt-pdf`; task type `encrypt`; one 4-page fixture.
- Submitted `encryptionAlgorithm=aes_256`, synthetic user/owner passwords, empty output pattern. No permission checkboxes were selected, so `permissions[]` was absent from the payload.
- Result: one 4-page encrypted PDF, **4,046 bytes**, SHA-256 `04274705e5183d92cfe48b6821c1ea84155bd84f69e0f7ba11ffca52b7483af1`; metadata reported 4,048 bytes (2-byte difference, **UNKNOWN**).
- Raw PDF structure: `/V 5`, `/R 6`, `/Length 256`, `/AESV3` — **AES-256, revision 6**.
- PDF.js without a password raised `PasswordException`; the synthetic user password opened 4 pages; a wrong password was rejected.
- Task response HTTP 200; `X-RateLimit-Remaining: 0`, `X-RateLimit-Wait: 3443`.
- Result screen: `reports/_raw/encrypt-pdf-result.png`.

Observed payload shape:

```json
{
  "type": "encrypt",
  "outputFilenamePattern": "",
  "userPassword": "[REDACTED SYNTHETIC TEST VALUE]",
  "ownerPassword": "[REDACTED SYNTHETIC TEST VALUE]",
  "encryptionAlgorithm": "aes_256",
  "files": ["<upload-id>"],
  "uri": "/encrypt-pdf",
  "userAgent": "...",
  "cvts": "0.14",
  "pdfjs": "bebd506c3",
  "libsCache": "654",
  "consoleLogs": [],
  "traceId": "tr-...",
  "www": "www22.sejda.com"
}
```

The exact permission bits produced when boxes are selected, and decrypt behavior, remain **UNOBSERVED**.

---

## 4. Download-template finding

`GET /api/tasks/{id}/change` returns:

```json
{
  "status": "Completed",
  "resultFilename": "sejda-VGN1V1.zip",
  "resultFileSize": 502800,
  "resultFullUrlPattern": "www.sejda.com/api/tasks/HH3HAKHS-202610250006/download/%7B%7Bfilename%7D%7D?s=...&d=true&_s=22",
  "resultItems": ["sample-1.jpg", "sample-2.jpg", "sample-3.jpg", "sample-4.jpg"],
  "warnings": []
}
```

**CONFIRMED:** the placeholder is URL-encoded as `%7B%7Bfilename%7D%7D`. Replacing it with `encodeURIComponent(resultFilename)` returned `application/zip` and the 502,792-byte ZIP.

**CONFIRMED (one observation):** the unresolved template returned `text/html` for this multi-file ZIP. The two single-file PDFs in this pass still downloaded correctly with the unresolved template. The reason for the difference is **UNKNOWN**; do not generalize without another observation. In the second window, substitution returned the expected ZIP and two PDFs; unresolved behavior was not retested.

**Recommendation for the reconstructed client:** always substitute both `{{filename}}` and `%7B%7Bfilename%7D%7D` with the encoded `resultFilename`, or request the concrete path directly. Treat the signed URL as a short-lived capability and redact it from shared reports.

The result page uses `#results-<task-id>` and a modal; the page’s underlying body text remains the pre-submit text, so the screenshot is the useful evidence for the result state.

---

## 5. Rate-limit state and remaining work

Two logged-out free-tier windows were used without clearing cookies, rotating
clients, or creating new identities:

| Window | Task | Type | Remaining after response | Wait |
|---|---|---|---:|---:|
| First | Merge | `merge` | 2 | 3599 s |
| First | Header/footer | `headerFooter` | 1 | 3260 s |
| First | PDF to JPG | `pdfToImage` | 0 | 3140 s |
| Second | Split by bookmarks | `splitByBookmarks` | 2 | 3599 s |
| Second | Alternate mix | `alternateMix` | 1 | 3483 s |
| Second | Encrypt | `encrypt` | 0 | 3443 s |

**At the last capture, 0 tasks remained and no further submission was attempted**
(`X-RateLimit-Wait: 3443`). The three second-window submissions were made only
after the prior recorded wait had elapsed; no task was submitted while the server
reported zero remaining. Treat the reset time as server-reported, not a guarantee.

Public workflows still unexercised, in priority order:

1. `splitBySize` — local implementation is greedy/approximate; public output
   boundaries remain unobserved.
2. `extractPages` — subset selection and output naming remain unobserved.
3. `rotatePages` — rotation angles and page selection remain unobserved.
4. Forms/sign (`fillSign`, `edit` form fields); `edit` is also used by
   `/pdf-forms`.
5. `decrypt` and the non-default encryption permission matrix.
6. Edge/error matrix: invalid PDF, encrypted input, chunked upload >5 MB,
   touch/expiry, cancel/delete, rate-limit body, signed-URL expiry, CORS/CSRF.
7. Localization sample and account/payment surfaces, both separately bounded.

The remaining representative family is **forms/sign**; security is now covered
by `encrypt`. The 5/6 family count is analytic, not a product metric.

---

## 6. Corrections to earlier shorthand

| Earlier shorthand | Corrected statement |
|---|---|
| “52 English routes” | 52 is the English **sitemap** count. There are **55 known unique English routes** after adding 2 menu-only tools and `/account`. |
| “43 workflows” | 43 is the number of tool **task pages**; there are **41 unique `data-task` values**, and 44 tool routes including the `/workflows` builder. |
| “1 workflow exercised” | Now **7 task types / 7 tool routes** exercised: `splitByPages`, `merge`, `headerFooter`, `pdfToImage`, `splitByBookmarks`, `alternateMix`, `encrypt`. |
| “Up to 43 workflows” | Use 41 unique task types for task-type coverage, or 44 tool routes for workflow-page coverage. Do not mix the denominators. |
| “12 pages / 12 docs” | Still unexplained stale display text in the split step-2 cards; not a server result. |

---

## 7. Evidence

Manifests:

- `reports/evidence/static-tool-matrix-manifest.csv` — 142 rows, 142 unique SHA-256 values (44 pages × HTML/JSON/PNG plus scripts/summaries/CSV).
- `reports/evidence/workflow-pass-manifest.csv` — 54 rows, 53 unique SHA-256 values (the two identical `sample.pdf` fixtures share a hash).

Key artifacts:

| Artifact | Path | Bytes | SHA-256 |
|---|---|---:|---|
| Merge trace | `reports/_raw/merge-task-network.json` | 27,927 | `8a5e872ee8fc7ac4443aff4780b055cc33d7b5486223dd31cd23b8051d9feac5` |
| Merge result | `reports/_raw/merge-result.pdf` | 5,342 | `fb856fdd724095f853b1c7a6bcb732e9ca0d3c69c66a3d22cd4a01c28d420e96` |
| Header/footer trace | `reports/_raw/header-footer-pdf-task-network.json` | 31,892 | `166ad931e10f6ba1d5ac4669bf7b37e4b535ed998757ace8f430d9ad8bc057a5` |
| Header/footer result | `reports/_raw/header-footer-pdf-result.pdf` | 4,251 | `7dab51e38e9cdcdb1d3fc18da75520f59b8d00990606293b9a4409a3e2130d4b` |
| PDF-to-JPG trace | `reports/_raw/pdf-to-jpg-task-network.json` | 21,250 | `be53344e70412288459c1570555737b77476e436495f8b14adcf90af1e8081ee` |
| PDF-to-JPG result ZIP | `reports/_raw/pdf-to-jpg-result.zip` | 502,792 | `500183f8b7df341f07863e2d40d1a46baec083bcca4d824c61f6d0ada22bf80f` |
| Split-by-bookmarks result ZIP | `reports/_raw/split-pdf-by-outline-result.zip` | 6,083 | `f15e8012d74322f086c886c8d992b43353ccf03ab41e3fed624fd603680fdff9` |
| Alternate-mix result | `reports/_raw/alternate-mix-pdf-result.pdf` | 5,285 | `51d13570296d82722eef4ecdb9d5d93494daaf08c21c3095f9e2bb8172e664fc` |
| Encrypt result | `reports/_raw/encrypt-pdf-result.pdf` | 4,046 | `04274705e5183d92cfe48b6821c1ea84155bd84f69e0f7ba11ffca52b7483af1` |
| Follow-up verification | `reports/_raw/followup-workflow-verification.json` | 5,361 | `36c23b9622cdbe4bfe2ca5c54ba21b050c043f813434a0bd8a2da8fccc07164e` |

Raw traces retain the short-lived signed download URL. Shared copies use `*.sanitized.json` and redact the token. The raw traces are **not** for publication as-is. The follow-up sanitized traces are `split-pdf-by-outline-task-network.sanitized.json`, `alternate-mix-pdf-task-network.sanitized.json` and `encrypt-pdf-task-network.sanitized.json`.

---

## 8. Backend status

Nothing in this pass changes the backend verdict:

- The web backend’s language, framework, auth, queue, storage, schema and payment provider remain **UNKNOWN**.
- No Java-specific runtime fingerprint appeared in any new response; `Server` remained `cloudflare` where visible.
- The Java PoC now implements **9 of 9** bounded SDK-mapped task types:
  `splitByPages`, `extractPages`, `merge`, `rotatePages`, `splitByBookmarks`,
  `splitBySize`, `alternateMix`, `headerFooter`, `pdfToImage`.
- Six are now verified against observed public behavior (`splitByPages`, `merge`,
  `headerFooter`, `pdfToImage`, `splitByBookmarks`, `alternateMix`); three remain
  local approximations inferred from static forms (`splitBySize`, `extractPages`,
  `rotatePages`).
- `encrypt` is now observed publicly but is **outside** the bounded nine-type
  PoC; it is not implemented there.
- The smoke test covers all nine bounded types, plus unsupported-type and negative
  cases.
- Full PoC verification and hashes: `reports/21-backend-poc.md`; source and
  run instructions: `reconstructed-backend/README.md`.

Further public workflows must wait for the free-tier window. Full 44-tool
reconstruction parity remains a P2 decision, not an automatic next step.
