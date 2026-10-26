# Application investigation dossier

**Target of record:** the artifacts present in `D:\small_editor` on **2026-10-25**.
**Status:** Phase 0–3 complete for the locally available artifacts; Phase 4 **partial — the official Sejda SDK is confirmed Java, and the public 44-tool/7-task-type pass is complete, but the sejda.com web backend remains blocked/unverified**; Phases 5–9 are therefore partial or conceptual; Phase 11 is a verified independent PoC with 9 bounded task types.

## The one-paragraph answer

There are **two workspace targets**, plus an external follow-up:

1. `D:\small_editor` — a complete, independently written **local-first PDF reader** (vanilla ES modules + pdf.js + a zero-dependency **Node.js** static server). Its source is fully present. It is *not* the Sejda application; its own backend is **Node.js**, and the separate reconstructed PoC is not part of it.
2. `site-re/sites/sejda-com/` — captured **public frontend artifacts** of sejda.com (HTML, minified JS, CSS, screenshots, API probes). The server-side web application was never obtained. The claim that the **sejda.com web backend** is Java is **reported but unverified**; no Sejda web-backend `.java`, `pom.xml`, Gradle file, JAR, WAR, EAR, Spring config, database migration or backend log exists in the workspace; the only Java sources/JARs are the separate, non-Sejda PoC under `reconstructed-backend/`.
3. **External follow-up:** the official <https://github.com/torakiki/sejda> repository was reviewed at commit `98712cd`. It is the **Sejda SDK/PDF engine**, written in Java (583 Java files, 9 Maven modules, Java 17, AGPLv3). It is **not** the sejda.com web backend: it has no web/API module, Spring/servlet/controllers, HTTP endpoints, `main`, database, auth or queue code. This confirms the **engine** is Java, not the **web backend**.

No original Sejda **web-backend** source code was recovered, and none can be recovered from the public client alone. What can be documented is the observed public contract, the complete local prototype, and the official SDK source. A verified independent backend PoC lives in `reconstructed-backend/`; it is separate from the local app and does not use the Sejda SDK. The design rationale is in `17-reconstruction-proposal.md`.

## Read in this order

| # | Report | What it settles |
|---|---|---|
| 00 | [Environment and project inventory](00-environment-and-project-inventory.md) | What is actually installed and present |
| 01 | [REA capabilities and tool status](01-rea-capabilities-and-tool-status.md) | What REA can and cannot do here |
| 02 | [Frontend architecture](02-frontend-architecture.md) | Local app and captured Sejda frontend |
| 03 | [Page and component inventory](03-page-and-component-inventory.md) | Every page/component in scope |
| 04 | [UI interaction catalog](04-ui-interaction-catalog.md) | What each interaction does and what it calls |
| 05 | [Frontend dependencies and build](05-frontend-dependencies-and-build.md) | Frameworks, libraries, build/deploy |
| 06 | [API inventory](06-api-inventory.md) | Local: none. Sejda: observed public subset |
| 07 | [API contracts (OpenAPI)](07-api-contracts.yaml) | Reconstructed contract for observed operations |
| 08 | [API errors and validation](08-api-error-and-validation-catalog.md) | Observed errors and unknowns |
| 09 | [Backend language and artifact inventory](09-backend-language-and-artifact-inventory.md) | **Node confirmed locally; no Sejda Java web backend (PoC separate)** |
| 10 | [Java source and bytecode analysis](10-java-source-and-bytecode-analysis.md) | **SDK reviewed; web-backend bytecode blocked** |
| 11 | [Database and data model](11-database-and-data-model.md) | Local: none. Sejda: conceptual only |
| 12 | [Authentication and authorization](12-authentication-and-authorization.md) | Local: none. Sejda: logged-out observations only |
| 13 | [File processing and workers](13-file-processing-and-worker-architecture.md) | Client-side locally; Sejda upload only |
| 14 | [Payments and external integrations](14-payments-and-external-integrations.md) | Pricing observed; provider unknown |
| 15 | [Deployment and infrastructure](15-deployment-and-infrastructure.md) | Local static server; Sejda behind Cloudflare |
| 16 | [Security and quality review](16-security-and-quality-review.md) | Concrete local findings, no live exploitation |
| 17 | [Reconstruction proposal](17-reconstruction-proposal.md) | What an independent Java backend would need |
| 18 | [Final application dossier](18-final-application-dossier.md) | Executive summary and all conclusions |
| 19 | [Official Sejda SDK review](19-official-sejda-sdk-review.md) | **SDK/engine is Java; web backend is not in the repo** |
| 20 | [Bounded REA pass](20-bounded-rea-pass.md) | **Nine tool pages and the full upload → task → result lifecycle observed** |
| 21 | [Independent backend PoC](21-backend-poc.md) | **Java + Apache PDFBox PoC verified; 9 bounded task types; no Sejda SDK** |
| 22 | [Tool matrix and workflows](22-tool-matrix-and-workflows.md) | **44/44 tools structured; 7/41 task types and 5/6 workflow families observed** |
| — | [Investigation tracker](investigation-tracker.md) | Phase-by-phase status and gaps |
| — | [Evidence index](evidence-index.md) | Every `ev_*` / `art_*` / local hash used |

## Status vocabulary

| Label | Meaning |
|---|---|
| **CONFIRMED** | Directly supported by source, configuration, a hashed artifact, or an observed response. |
| **STRONGLY INFERRED** | Supported by multiple independent observations, but not directly proven. |
| **POSSIBLE** | Plausible; evidence is incomplete. |
| **UNKNOWN** | No sufficient evidence either way. |
| **UNAVAILABLE** | The required artifact or access does not exist in this scope. |
| **N/A** | The question does not apply to the available target. |
| **BLOCKED** | The phase cannot proceed without missing evidence. |

## Evidence rules

- Sejda claims are backed by `site-re/sites/sejda-com/claims.csv` (**78 rows: 56 observed, 15 derived, 7 unknown**), the original `evidence-manifest.csv` (40 rows / 39 unique SHA-256 values), the bounded-pass manifest `reports/evidence/bounded-rea-manifest.csv` (13 rows), the static tool matrix `reports/evidence/static-tool-matrix-manifest.csv` (142 rows / 142 unique hashes), the workflow pass `reports/evidence/workflow-pass-manifest.csv` (54 rows / 53 unique hashes), and the backend PoC manifest `reports/evidence/backend-poc-manifest.csv` (**28 rows / 28 unique hashes**).
- REA records used in this dossier: the original five (`ev_1facc738…`, `ev_4073c716…`, `ev_d6c5e8b7…`, `ev_f97b3cdb…`, `ev_6be7d1b6…`) plus nine bounded-pass records in `reports/evidence/rea-bounded-pass.bundle.json` (6,347,689 bytes). The original bundle is `reports/evidence/rea-session.bundle.json` (83,274,977 bytes, 5 records).
- Local source files are hashed in `reports/_raw/local-source-hashes.json`; they are **source**, not decompiled output.
- External SDK evidence: official `torakiki/sejda` at commit `98712cdba40949763ba2718962e162025ccfd910`, reviewed by shallow clone. The clone is not retained; the commit and report `19` make it reproducible.
- Bounded negatives are written as “not found in <scope>”, never “does not exist”.
- No credentials, cookie values, private keys or personal data are reproduced. The raw task trace contains a short-lived signed URL; the report and sanitized excerpt redact it.

## Bottom line

| Question | Answer | Confidence |
|---|---|---|
| Is the complete frontend present? | Local prototype: **yes**. Sejda: **no** — only captured public bundles/HTML. | CONFIRMED |
| Is the complete web backend present? | **No.** | CONFIRMED (workspace search) |
| Is the backend Java? | Local prototype: **no, Node.js**. Sejda **web backend: unverified**. Sejda **SDK/PDF engine: Java (confirmed)**. | CONFIRMED locally / SDK CONFIRMED / web UNKNOWN |
| Can the original Java source be recovered? | The **Sejda web backend** source is unavailable. The **SDK source** is public and was reviewed. | UNAVAILABLE (web) / AVAILABLE (SDK) |
| Can an equivalent backend be built? | **Yes, as an independent implementation**; a PoC now exists in `reconstructed-backend/` with 9 bounded task types. | CONFIRMED (PoC) |
