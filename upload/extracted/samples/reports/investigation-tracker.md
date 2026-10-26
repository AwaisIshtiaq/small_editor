# Investigation tracker

**Target:** `D:\small_editor` (local prototype + captured sejda.com frontend)
**Started:** 2026-10-24 UTC
**Last updated:** 2026-10-25 UTC

| Phase | Status | Evidence collected | Files created | Missing dependencies / gaps | Next action |
|---|---|---|---|---|---|
| 0 — Environment | **COMPLETE** | host/toolchain JSON, disk, Java 23, Node 26, no Git repo, no Sejda web-backend artifacts (pre-PoC) | `00-environment-and-project-inventory.md`, `_raw/environment.json`, `_raw/java-artifact-search.txt` | none | — |
| 1 — REA discovery | **COMPLETE WITH LIMITATIONS** | doctor output; 5 REA records; browser target; JS graph | `01-rea-capabilities-and-tool-status.md`, `_raw/rea-doctor.txt` | native engines missing; skill/registration drift; no JEB | optional `rea setup` after approval |
| 2 — Frontend | **PARTIAL** | full local source; Sejda bundles/HTML/CSS; no source maps | `02`, `03`, `04`, `05` | Sejda editor obfuscated; framework unknown | obtain editor source/maps or deobfuscate with approval |
| 3 — API discovery | **PARTIAL — 44 TOOLS STRUCTURED; 7 TASK TYPES OBSERVED** | local: none; Sejda: upload-check, upload, task submit, task change, signed download + analytics; 44/44 tool routes statically structured; 7/41 task types end-to-end; 5/6 workflow families | `06`, `07`, `08`, `20`, `22` | 34 task types, 7 client API paths, chunked/password/cancel, auth/limits details | supply docs or use later free-tier windows |
| 4 — Java backend/artifacts | **PARTIAL — SDK CONFIRMED / WEB BACKEND BLOCKED** | official `torakiki/sejda` SDK: 583 Java files, 9 Maven modules, Java 17; no web/API layer; workspace has zero web-backend artifacts | `09`, `10`, `19` | **no sejda.com web-backend artifact** | supply web repo/module/JAR/WAR/image |
| 5 — Database/data model | **N/A local; CONCEPTUAL remote** | no DB locally; opaque ids only | `11` | no schema/migrations/DB access | supply migrations or authorized schema |
| 6 — Auth/authz | **N/A local; PARTIAL remote** | login UI, cookies, anonymous upload | `12` | no account session; no authz tests | authorized test account |
| 7 — File processing/workers | **COMPLETE local; SEVEN PUBLIC TASK TYPES OBSERVED remote** | client-side pdf.js pipeline; split, split-by-bookmarks, merge, alternate-mix, header/footer, PDF-to-JPG and encrypt tasks each produced downloadable/verifiable results; task submit/poll/download observed | `13`, `20`, `22` | queue/worker/storage/retention internals unknown | supply architecture docs or authorized infra evidence |
| 8 — Payments/integrations | **N/A local; PARTIAL remote** | pricing, analytics, identity metas | `14` | payment provider/checkout/webhooks unknown | sandbox checkout + backend config |
| 9 — Deployment/infra | **COMPLETE local; EDGE-ONLY remote** | Node server; Cloudflare headers | `15` | origin/hosting/DB/queue unknown | architecture docs or authorized infra inventory |
| 10 — Security/quality | **COMPLETE local; LIMITED remote** | malformed-URI crash, headers, symlink analysis, tests, audit | `16` | no remote exploitation; no auth tests | fix F-01/F-02/F-03 after approval |
| 11 — Reconstruction | **POC VERIFIED — 9 BOUNDED TASK TYPES** | confirmed vs assumed contract; architecture; test plan; `reconstructed-backend/`; 9/9 task types pass smoke; 6 observed end-to-end, 3 inferred from static forms; public `encrypt` is outside the bounded PoC | `17`, `21` | Maven is not installed; PoC uses a JDK HTTP server + Apache PDFBox; the 3 inferred types are approximations, and the observed types are not byte-identical | decide production framework/licensing |
| 12 — Final dossier | **COMPLETE** | links, confidence, missing evidence, commands | `18`, `19`, `20`, `21`, `22`, `README`, `evidence-index`, this tracker | inherits web-layer Phase 4 block; full 44-tool parity is P2 | decide next action |

## Status definitions

- **COMPLETE** — the applicable investigation was actually performed for the available artifacts.
- **PARTIAL** — some applicable questions were answered; others lack evidence.
- **BLOCKED / UNAVAILABLE** — required evidence does not exist in scope.
- **N/A** — the question does not apply to the available target.
- **PROPOSAL ONLY** — design work, no implementation.

## Key unresolved questions

1. Is there a Java backend artifact anywhere outside this workspace? **The official Sejda SDK is Java and was reviewed; no sejda.com web-backend artifact was obtained.**
2. Does sejda.com use Java? **The SDK/PDF engine is Java (confirmed). The web backend is unverified.**
3. What database/queue/storage does sejda.com use? **Unknown.**
4. What is the editor's exact find algorithm? **Runtime-observed only; static code obfuscated.**
5. Why is `#searchTools` hidden? **Unknown.**
6. Should an independent Java backend be built? **Approved; an independent PoC exists in `reconstructed-backend/` using Apache PDFBox, not the Sejda SDK.**

## Change log

| Date | Change |
|---|---|
| 2026-10-24 | Created `reports/` dossier; exported REA bundle; ran environment, Java-artifact, test, audit, header, malformed-URI, and browser-check probes; wrote reports 00–18, tracker, evidence index. No application code modified. |
| 2026-10-24 | Reviewed official `torakiki/sejda` at commit `98712cd`: confirmed the Java SDK/PDF engine; confirmed it is not the sejda.com web backend; added report `19` and revised `09`, `18`, `README`, tracker, evidence index. No code executed or application code modified. |
| 2026-10-25 | Ran the bounded public REA pass: captured nine tool pages, analyzed the shared/editor bundles, and exercised one logged-out split task through upload, task submit, status polling and signed ZIP download. Added claims C-0058–C-0066 and report `20`. No auth/paywall bypass. |
| 2026-10-25 | Completed the 44-tool static matrix (142 manifest rows), exercised merge, header/footer and PDF-to-JPG end-to-end, added claims C-0067–C-0073 and report `22`; updated coverage to 4/41 task types / 4/44 workflows / 25.24% composite. |
| 2026-10-25 | Implemented five previously unimplemented bounded task types in the independent PoC (`splitByBookmarks`, `splitBySize`, `alternateMix`, `headerFooter`, `pdfToImage`); added a bookmark fixture and expanded smoke coverage to 9/9 types. At that point the five inferred types were `splitByBookmarks`, `splitBySize`, `alternateMix`, `extractPages` and `rotatePages`; the next pass moved the first and third to observed. |
| 2026-10-25 | After the first free-tier wait elapsed, exercised `splitByBookmarks` (level 1, title filter), `alternateMix` (default interleave) and `encrypt` (AES-256) end to end using the same logged-out session. Added claims C-0074–C-0078; updated coverage to 7/41 task types, 7/44 tool routes, 5/6 families and 26.46% composite. `splitByBookmarks` and `alternateMix` moved from inferred to observed; `encrypt` is outside the bounded PoC. |
