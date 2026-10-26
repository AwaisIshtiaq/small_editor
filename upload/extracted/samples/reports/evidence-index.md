# Evidence index

**Purpose:** map every important conclusion to a retained evidence record or hashed artifact.
**Rule:** a claim without evidence is labelled UNKNOWN, not asserted.

## 1. REA Evidence records

Full session bundle: `reports/evidence/rea-session.bundle.json`
**Size:** 83,274,977 bytes
**Records:** 5
**Unknowns:** 0
**Exported:** 2026-10-24

| Evidence ID | Operation | Confidence | Authority | Used for |
|---|---|---|---|---|
| `ev_1facc738445ba7ee685c7d81c637068bd264ba7f5c65493874f2b083ccbab3d1` | `list_browser_targets` | observed | external-service | One Sejda page at `https://www.sejda.com/`; Chrome 155.0.8059.85; target `6893E7752CD7323050226931434A57B0` |
| `ev_4073c716d01b38dc5040ccbe0058cec78174c9335aabf1d13d4179895993fade` | `capture_browser_scenario` | observed | controlled-replay | Homepage/menu actions; 3 steps, 2 actions, 4 events, 1,794 ms; completeness `incomplete` (missing events) |
| `ev_d6c5e8b75ee2dfbbab46d0bb9c0046a725a30cd23895f3e321deeea4a8aee25d` | `capture_browser_scenario` | observed | controlled-replay | Menu open action; 2 steps, 1 action, 4 events, 1,866 ms; completeness `incomplete` |
| `ev_f97b3cdb96a851f05a518827f8ef7ba89131ce926265e086b0bd47755953ad53` | `capture_browser_scenario` | observed | controlled-replay | Attempt to fill hidden `#searchTools`; 3 steps, 2 actions, 4 events, 8,774 ms; `incomplete` (missing action/events) |
| `ev_6be7d1b6ed3138aef67bba2b9f967a7c5891f839b9222fac50ba86d671f177b5` | `analyze_javascript_application` | derived | shipped-artifact | Static parse of `D:/small_editor/app`: 5 JS files, 2,925,971 text bytes, 436,677 AST nodes, 591 findings, 0 modules, 0 parse failures; graph coverage incomplete |

**Earlier bundle:** `site-re/evidence/sejda-search-2026-10-24.bundle.json` (352,751 bytes, 3 records: `ev_4073…`, `ev_d6c5…`, `ev_f97b…`).

### 1.1 Bounded-pass REA records (2026-10-25)

Full bundle: `reports/evidence/rea-bounded-pass.bundle.json`
**Size:** 6,347,689 bytes
**SHA-256:** `9fecd9a1d13504645a8c53c63a262ea968cf3cb41a1a34f984a2262a9680c006`
**Records:** 9
**Unknowns:** 0

| Evidence ID | Operation | Confidence | Used for |
|---|---|---|---|
| `ev_efdeaa8be5ce4e6717843f7307a3abe409e09bd3ca63c68394efa4739594023d` | `capture_browser_scenario` | observed | Nine tool routes, 18 DOM/screenshot steps, network/console/page-error capture; report `20` §2 |
| `ev_5c82b67985036413620fb174b3e6c5a0b60111dd08383158b02011fbe41f3ea6` | `analyze_web_bundle` | observed | Merge page: 2 scripts (803,543 B shared + 5,377 B page), 2 endpoint candidates; report `20` §2 |
| `ev_e19aa74767b556086aac9f64ea341903dac770bcf508088f127607ac7693ab07` | `analyze_web_bundle` | observed | Editor page: 3 scripts (803,543 B shared + 394,992 B editor + 327 B); report `20` §2 |
| `ev_fa24a90dad0b1834764bbaf85a4826cd88efdde93156ba72b718b8a495ff4703` | `capture_browser_scenario` | observed | Connect-mode navigation to `/merge-pdf` |
| `ev_c246eba88174b08271150d1a9902df974004aab7e938a74653108bc1f70134df` | `capture_browser_scenario` | observed | Connect-mode navigation to `/pdf-editor` |
| `ev_0631b2b35e99b095dba837004815fecdd76b2b0bf31c0fd0507d230b9ce7c690` | `capture_browser_scenario` | observed | Initial single-page `/merge-pdf` capture |
| `ev_5997f8e5b1fec7610b479dc836e85b250a5c173db7fcc6f1bfc9778032b1afe2`, `ev_bc1171b0c2406f3a3376eeb03919b4ded94270937c7ed6a2fecb5853e553aa5c`, `ev_cba66a84df2ff10de7a1116cc33c25d25e996bd4648df469cc5a009a64dc5d8b` | `list_browser_targets` | observed | CDP target discovery before/after connect-mode runs |

The upload → task → result flow used the same live Chrome target through a small CDP script (`reports/_raw/rea-upload-task.mjs`) because REA scenario actions do not expose a file-input setter. That flow is recorded as the hashed artifact `art_338ccde…`, not as an `ev_*` record. This is a tooling limitation, not an auth bypass: it drove the page's own `input.fileupload` and clicked its own buttons in a logged-out session.

### 1.1 REA limitations that affect claims

- Scenario captures are `incomplete`; they support “this action occurred” but not a complete causal event graph.
- JavaScript analysis is inert; it does not prove runtime execution.
- The JS graph includes vendored pdf.js; 591 findings are not all application code.
- The graph response exceeded the 10 MiB MCP stdio budget and was exported, not truncated.

## 1.2 External source evidence

| Evidence ID | Source | Commit / version | Used for |
|---|---|---|---|
| `repo_torakiki_sejda@98712cdba40949763ba2718962e162025ccfd910` | <https://github.com/torakiki/sejda> | `98712cd` / `5.1.27-SNAPSHOT` | Official Sejda SDK source review: Java engine confirmed; web backend absent. Report `19`. |

This is a **source repository**, not a REA `ev_*` record or a captured `art_*` artifact. The shallow clone was not retained; the commit hash makes the review reproducible. No code was executed.

## 2. Sejda claims ledger

`site-re/sites/sejda-com/claims.csv`

| Status | Rows |
|---|---:|
| observed | 56 |
| derived | 15 |
| unknown | 7 |
| **total** | **78** |

Every observed/derived row carries an `art_*` or `ev_*` ID. The 7 unknown rows are explicit gaps (editor algorithm, hidden search reason, Include links, account personalization, backend, empty/regex hang, payment/processing).

Key claim groups:

| Claims | Subject |
|---|---|
| C-0001–C-0020 | Homepage, All Tools menu, tool search, recents/pins |
| C-0021–C-0030 | Editor Find & Replace |
| C-0031–C-0043 | Sitemap, locales, pricing, Cloudflare, robots, routes, identity metas |
| C-0044–C-0046 | Bundle sizes, obfuscation, editor algorithm unknown |
| C-0047–C-0052 | Query hang, Include links, hidden field, payments/account, personalization, no search route |
| C-0053–C-0066 | API endpoints, upload/task/download lifecycle, rate limits, result ZIP, CORS/cookie observations, stale step-2 text, client-only paths, no Java fingerprint, web-backend Java claim unverified |
| C-0067–C-0073 | 44-tool structured matrix, merge/headerFooter/pdfToImage tasks, download-template trap, free-tier consumption, common payload fields |
| C-0074–C-0078 | splitByBookmarks section boundaries, alternateMix default order/payload, AES-256 encrypt result, second free-tier window, repeated download-template substitution and payload fields |

## 3. Hashed Sejda artifacts

Manifest: `site-re/sites/sejda-com/evidence-manifest.csv` — **40 rows / 39 unique artifacts**, each `art_<sha256>` with path/bytes/description. One screenshot hash (`art_e241abc4…`) is reused for `pdf-editor-1440.png` and `pdf-editor-toolbar.png`.

| Category | Key artifacts |
|---|---|
| HTML | `art_d3ea633b…` homepage, `art_e13a2c04…` editor, `art_c5ef10a4…` upgrade, `art_8316d6c6…` desktop, `art_2c04102d…` API, `art_f113e328…` workflows, `art_dbf8e31e…` developers, `art_a8114ca8…` help, `art_e36eddf3…` teachers |
| JS | `art_17dea15b…` shared bundle (803,543 B), `art_f83a8da3…` editor bundle (394,992 B) |
| CSS | `art_f3d5a8be…` site CSS (162,057 B) |
| Probe JSON | `art_9d3944df…` tool search, `art_8a99c539…` editor find, `art_d2e5a61d…` headers/404, `art_47c57f36…` upload, `art_39e1ea6c…` routes |
| Sitemap/robots | `art_8558ddab…` sitemap (3,734,859 B), `art_3af5eb63…` robots |
| Cloudflare | `art_27c8ec96…` 403 headers, `art_1d03506c…` 403 page |
| Screenshots | `art_3e7f5264…` menu 1440, `art_93e2631a…` menu 390, `art_cf706b43…` search merge, `art_068373d6…` find modal, `art_b0a086ba…` after replace, `art_421ffdca…` rebuild palette, `art_7a081294…` rebuild find |
| Rebuild captures | `art_aaa8642f…`, `art_840261f0…`, `art_4fb50480…`, `art_bb87a1e3…`, `art_68760302…`, `art_605a79ee…` |

The exact 64-hex IDs and byte sizes are in the manifest; do not rely on the abbreviated prefixes outside this table.

### 3.1 Bounded-pass artifacts

`reports/evidence/bounded-rea-manifest.csv` lists the new hashed artifacts. The main ones:

| Artifact | Path | Bytes | SHA-256 | Used for |
|---|---|---:|---|---|
| `art_338ccde339635828e237193dac4ee524010ece3ff5e25cb27427a8f56381facf` | `reports/_raw/rea-upload-task-network.json` | 20,325 | `338ccde339635828e237193dac4ee524010ece3ff5e25cb27427a8f56381facf` | Raw CDP upload/task/download trace; report `20` §3–4 |
| `art_20129ca52f9322205ebaaf86e62f0fd4f6165ed1b0f6c18f7a780c0d464591bd` | `reports/_raw/rea-upload-task-network.sanitized.json` | 20,444 | `20129ca52f9322205ebaaf86e62f0fd4f6165ed1b0f6c18f7a780c0d464591bd` | Redacted excerpt for sharing; signed token and ids replaced |
| `art_16a2bc53fc48fe3e17a7130fe1668beb3cf0517ad7dce834383f7688a9760180` | `reports/_raw/rea-split-result.zip` | 6,881 | `16a2bc53fc48fe3e17a7130fe1668beb3cf0517ad7dce834383f7688a9760180` | Downloaded result ZIP; 4 PDFs |
| `art_e1be8bc40a6f13efa70c4e26c8810182ba37a365349566577ada6a78d804eaa4` | `reports/_raw/rea-split-ready.png` | 61,839 | `e1be8bc40a6f13efa70c4e26c8810182ba37a365349566577ada6a78d804eaa4` | 1440×900 step-2 choice screenshot |
| `art_9e52d1d7986849c93cf0defd7df752658715cde0a7263ae78030b085a3f513c3` | `reports/_raw/rea-split-result.png` | 58,308 | `9e52d1d7986849c93cf0defd7df752658715cde0a7263ae78030b085a3f513c3` | 1440×900 result modal screenshot |
| `art_a6e80608394b902d6c530eb5e7a5143141379fc05588070505893d3a42745519` | `reports/_raw/rea-bounded-pass-summary.json` | 273,416 | `a6e80608394b902d6c530eb5e7a5143141379fc05588070505893d3a42745519` | Parsed page/network summary |

The shipped JS assets used for static endpoint analysis are in `reports/_raw/sejda-js/` (shared 803,543 B, editor 394,992 B, plus nine page scripts). Their SHA-256 values are in `reports/_raw/sejda-js/SHA256SUMS.txt`; shared/editor hashes match the existing manifest artifacts `art_17dea15…` and `art_f83a8da…`.

### 3.2 Independent backend PoC artifacts

Manifest: `reports/evidence/backend-poc-manifest.csv` — **28 rows / 28 unique hashes** for the Java source, fixture generator, scripts, Apache PDFBox jars, bookmark fixture, and the verification-run outputs. Full report: `reports/21-backend-poc.md`.

| Artifact | Path | Bytes | SHA-256 | Used for |
|---|---|---:|---|---|
| `art_942943ef…` | `reconstructed-backend/src/main/java/com/example/pdfpoc/Main.java` | 22,408 | `942943ef7246d61bc8d34a2e6c14e2dc3012efec69574123bde776fca0a074ab` | HTTP lifecycle, multi-file allowlist, content types |
| `art_4b0a82e2…` | `reconstructed-backend/src/main/java/com/example/pdfpoc/PdfService.java` | 42,531 | `4b0a82e2dd19b95d69b4af7c0f8213dc3d230c43b1783a1c66e9c65c4f3636ac` | 9 bounded PDFBox task types |
| `art_0d850f40…` | `reconstructed-backend/smoke.mjs` | 18,689 | `0d850f40a6cdc117d4eabcd34e8f53a0a076c69bca5070c417eb13efb8661772` | Smoke test: 9 types, ZIP/PDF/JPEG checks |
| `art_ac2c82df…` | `reconstructed-backend/lib/pdfbox-2.0.32.jar` | 2,794,870 | `ac2c82df0dd5fccc91ca691f3a1845fb0b06c57f183d2f4701570c1d842c37d7` | Apache PDFBox 2.0.32 |
| `art_20588968…` | `samples/sample-bookmarks.pdf` | 5,449 | `20588968ba9ee1b3dd5f75a8b23f13bf9fd5baade6830a4b3a6b2913e80643cd` | 4-page bookmark fixture (levels 1–2) |
| `art_84e64bf6…` | `reconstructed-backend/out/smoke-split.zip` | 4,377 | `84e64bf68e6a8d2fc9386e7756c85f96dc1b2cc0460b91448a798528dd041a8a` | Verification: 4 one-page PDFs |
| `art_f4fdcf48…` | `reconstructed-backend/out/smoke-merge.pdf` | 10,083 | `f4fdcf487b2dcd823258ff58587609477248efc8d71bb224fdd4cb33555dd331` | Verification: 8-page merge |
| `art_0d3d9f53…` | `reconstructed-backend/out/smoke-bookmarks.zip` | 3,806 | `0d3d9f53bb39d0f5b7c34366ebfd99c0d4c8f7d7a4a92d4b3134cd94be7ed597` | Verification: 3 bookmark sections |
| `art_23e8dc9e…` | `reconstructed-backend/out/smoke-by-size.zip` | 4,419 | `23e8dc9e2c886009c382f04d93e415cbea30e3607b06f5f972137676e7234c2e` | Verification: 4 size chunks |
| `art_3f8bb0a1…` | `reconstructed-backend/out/smoke-mix.pdf` | 8,187 | `3f8bb0a1e9bfa53a0e20f51bc7163345a98b982ea63e4bfa57463b1759ad6ad5` | Verification: alternateMix 8 pages |
| `art_0dcfa4d5…` | `reconstructed-backend/out/smoke-header-footer.pdf` | 5,916 | `0dcfa4d535b3ddf55b16f4761af55796f2b02de6d62f9417787b446a14d6f2ba` | Verification: extractable header text |
| `art_fd3158c3…` | `reconstructed-backend/out/smoke-images.zip` | 117,451 | `fd3158c37c142cefae9bf24109a585ed1ba5a63eb2bba7f7d4b61d888f09e973` | Verification: 4 JPEGs at 1240×1753 |

Output sizes/hashes are from one verification run; PDF timestamps/compression make them non-deterministic across runs. The manifest also includes the remaining smoke outputs and the `out/smoke-result.json` summary.

### 3.3 Static tool matrix

Manifest: `reports/evidence/static-tool-matrix-manifest.csv` — **142 rows / 142 unique SHA-256 hashes**. Coverage summary: `reports/22-tool-matrix-and-workflows.md` and `reports/coverage/coverage-build.json`.

| Artifact | Path | Bytes | SHA-256 | Used for |
|---|---|---:|---|---|
| `art_38616d1c…` | `reports/evidence/static-tool-matrix-manifest.csv` | 36,984 | `38616d1c10c1705e03a69921e18c1a5596041952716b254c2b1282578326c72a` | 44-tool HTML/JSON/PNG matrix |
| `reports/_raw/static-pass/summary.json` | 35-page capture summary | — | — | 35/35 captured, 0 errors, 0 challenges |
| `reports/_raw/static-pass/bundle-pages/summary.json` | 9-page bundle extraction summary | — | — | REA-bundle pages |
| `reports/coverage/tools.csv` | 44 tool routes, task IDs, fields, screenshots | — | — | authoritative tool matrix |
| `reports/coverage/routes.csv` | 55 known English routes | — | — | route inventory |
| `reports/coverage/locales.csv` | 28 localized locales, 1,344 sitemap routes | — | — | locale inventory; 0 sampled |
| `reports/coverage/coverage.csv` | coverage denominators and composite estimate | — | — | current **26.46%** heuristic |

The static matrix combines the 35-page CDP pass and the earlier 9-page
REA-bundle extraction: **44/44 tool routes** have DOM, parsed JSON, forms/file
inputs/task fields, a 1440×900 PNG, and a hash. The 44 tools include **43 task
pages** and **41 unique `data-task` values**; `/workflows` has no `data-task`.
Page screenshots are 1440×900 PNGs; HTML/JSON are sanitized structural
inventories, not full network captures.

### 3.4 Workflow pass

Manifest: `reports/evidence/workflow-pass-manifest.csv` — **54 rows / 53 unique hashes** (the two identical `sample.pdf` fixtures share a hash). Workflow report: `reports/22-tool-matrix-and-workflows.md`. Regenerate with `python reports/_raw/build-manifests.py` after report/coverage edits.

| Artifact | Path | Bytes | SHA-256 | Used for |
|---|---|---:|---|---|
| `reports/_raw/merge-task-network.json` | raw merge trace | 27,927 | `8a5e872ee8fc7ac4443aff4780b055cc33d7b5486223dd31cd23b8051d9feac5` | task `DCANA2XV-202610242358` |
| `reports/_raw/merge-result.pdf` | 8-page merge result | 5,342 | `fb856fdd724095f853b1c7a6bcb732e9ca0d3c69c66a3d22cd4a01c28d420e96` | merge output |
| `reports/_raw/header-footer-pdf-task-network.json` | raw header/footer trace | 31,892 | `166ad931e10f6ba1d5ac4669bf7b37e4b535ed998757ace8f430d9ad8bc057a5` | task `WWMHHDLK-202610250004` |
| `reports/_raw/header-footer-pdf-result.pdf` | 4-page header/footer result | 4,251 | `7dab51e38e9cdcdb1d3fc18da75520f59b8d00990606293b9a4409a3e2130d4b` | `Page 1`–`Page 4` extracted |
| `reports/_raw/pdf-to-jpg-task-network.json` | raw PDF-to-JPG trace | 21,250 | `be53344e70412288459c1570555737b77476e436495f8b14adcf90af1e8081ee` | task `HH3HAKHS-202610250006` |
| `reports/_raw/pdf-to-jpg-result.zip` | 4 JPGs, 150 dpi | 502,792 | `500183f8b7df341f07863e2d40d1a46baec083bcca4d824c61f6d0ada22bf80f` | 1240×1753 outputs |
| `reports/_raw/fix-pdf-to-jpg-download.mjs` | corrected download retry | — | — | `resultFilename` substituted for `%7B%7Bfilename%7D%7D` |
| `reports/_raw/split-pdf-by-outline-task-network.sanitized.json` | split-by-bookmarks trace | 36,755 | `ae0da5348e808277f0098e2ee023ab3b11b5aa51156b5d5b90b49423a5988fcb` | task `N0TVSXU0-202610250100` |
| `reports/_raw/split-pdf-by-outline-result.zip` | 3 section PDFs | 6,083 | `f15e8012d74322f086c886c8d992b43353ccf03ab41e3fed624fd603680fdff9` | page counts 1, 2, 1 |
| `reports/_raw/alternate-mix-pdf-task-network.sanitized.json` | alternate-mix trace | 44,106 | `1ac56e2979c6ba0722a04eb7fb1300489faf8599d9231ad2a636e4d64240f151` | task `JSOZYMJP-202610250102` |
| `reports/_raw/alternate-mix-pdf-result.pdf` | 8-page interleaved output | 5,285 | `51d13570296d82722eef4ecdb9d5d93494daaf08c21c3095f9e2bb8172e664fc` | default A1/B1 order |
| `reports/_raw/encrypt-pdf-task-network.sanitized.json` | AES-256 trace | 38,223 | `952572508c7a3d34c65af9e235911b1e638293641c12f08fac3204a162eb5578` | task `UZ1ZDEX2-202610250102` |
| `reports/_raw/encrypt-pdf-result.pdf` | 4-page encrypted output | 4,046 | `04274705e5183d92cfe48b6821c1ea84155bd84f69e0f7ba11ffca52b7483af1` | AESV3, 256-bit, R6 |
| `reports/_raw/followup-workflow-verification.json` | page-order/password/rate checks | 5,361 | `36c23b9622cdbe4bfe2ca5c54ba21b050c043f813434a0bd8a2da8fccc07164e` | independent verification summary |

Observed end-to-end task types: **7/41** (`splitByPages`, `merge`,
`headerFooter`, `pdfToImage`, `splitByBookmarks`, `alternateMix`, `encrypt`).
Representative workflow families: **5/6** (`split`, `combine`, `layout`,
`conversion`, `security`); `forms/sign` remains unexercised. Latest free-tier
state at capture time: **0 tasks remaining**, `X-RateLimit-Wait: 3443`; do not
bypass.

Raw traces contain signed URLs/tokens; sanitized copies and reports redact
them. Downloaded sizes differ from task metadata by 2–15 bytes; cause is
**UNKNOWN**.

## 4. Local source hashes

Raw: `reports/_raw/local-source-hashes.json`

| Path | Bytes | SHA-256 |
|---|---:|---|
| `package.json` | 435 | `ab6bcd77f7b0a53fb4b49440e6a727004b064723554e952fc3249e685f9c41e7` |
| `server.mjs` | 3,082 | `b71377a6903b04a37cd271fa707d26f758f437f0bae92ca4e9d71432b51f0d01` |
| `app/index.html` | 6,990 | `d585e4790395d6bf8a415644bacbb5f90f3e9edfff6cac75d367dd5d6a521bd6` |
| `app/css/app.css` | 17,036 | `02c12c22be04e671dcddc5f8624190365d41a2625bc05d369d08ce4d90d32972` |
| `app/js/app.js` | 34,660 | `406b8c856da87571793804f1e851b6e659c3874660703831a78262b0d2abd242` |
| `app/js/core.js` | 11,499 | `291d7453eaff3bab6f70c0778830a486a26812b4e94826f2c21da9fe1d39819c` |
| `app/js/tools-data.js` | 4,721 | `c9db2f659992b4e26cfed951fb30833e57fa1ff6655b1fb30dc1b9514402d923` |
| `samples/sample.pdf` | 2,924 | `5ef833b674aa0e691eb7b9b6a063402876500553997215eff905d786cf76d319` |
| `samples/sample-bookmarks.pdf` | 5,449 | `20588968ba9ee1b3dd5f75a8b23f13bf9fd5baade6830a4b3a6b2913e80643cd` |
| `scripts/browser-check.mjs` | 12,058 | `b0a9bf248cf7a69047fa76eceb3076fc3b25950937c69de87da7286f601c6065` |
| `test/core.test.mjs` | 6,963 | `807ab9829e67a72549392c1b45f2ecd1679e865dde8a3fdb650572912841d0ce` |

## 5. Probe and validation records

| File | Contents | Used for |
|---|---|---|
| `reports/_raw/environment.json` | Host/toolchain versions, disk | 00 §1 |
| `reports/_raw/java-artifact-search.txt` | Phase 4 zero-result search log (before the independent PoC) | 00 §3, 09 §2, 10 §1 |
| `reports/_raw/rea-doctor.txt` | REA health, 22 checks | 01 |
| `reports/_raw/local-headers.txt` | `GET /app/` headers | 15, 16 |
| `reports/_raw/server-5199.log` | Malformed-URI crash stack | 08, 16 F-01 |
| `reports/_raw/browser-check.txt` | 14/14 PASS | 04, 16, 18 |
| `reports/_raw/npm-audit.json` / `.err` | 0 vulnerabilities | 05, 16 |
| `reports/_raw/local-source-hashes.json` | Local SHA-256 | 04 |

## 6. Dossier report index

`reports/README.md` is the index. Detailed reports: `00`–`22`, plus `investigation-tracker.md` and this file.

## 7. Evidence boundaries

- No credentials, cookie values, private keys, or personal data are reproduced. The raw task trace contains a short-lived signed download token; the report and sanitized excerpt redact it.
- The 3 KB test fixture is not a private document.
- Cloudflare 403 artifacts are edge responses, not site behavior.
- Sejda capture describes one deterministic rendering (1440×900, en-US, UTC, light, reduced motion, service workers blocked), not all users. The upload/task flow used CDP file-input injection because REA actions lack `set_input_files`; it still drove the page’s own UI.
- “Not found in scope” is a bounded negative, not proof of universal absence.
- The external SDK review covers one official commit. It proves that commit is a Java library; it does not prove sejda.com runs that exact version, nor that its web/API/auth/data layer is Java.
