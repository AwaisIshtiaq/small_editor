# RULES.md — Binding Engineering Rules

These rules govern EVERY line of code in this repository. They outrank convenience,
deadlines, and personal taste. Violations are bugs.

## 1. Ponytail (minimal-code discipline)

- Write the shortest code that fully solves the problem. No speculative abstractions.
- No feature flags, config layers, or "extension points" nobody asked for.
- Delete code instead of commenting it out. Dead code is debt.
- One tool = one handler = one branch in the task dispatcher. If adding a tool needs
  more than: registry entry + handler + form, the architecture is wrong.
- Prefer plain functions over classes. Prefer data over DSLs. Prefer `if` over cleverness.
- Dependencies are budgeted: each one must earn its bundle size. Current budget:
  - `@cantoo/pdf-lib` (server PDF engine, MIT, AES-256 capable)
  - `pdfjs-dist` (client-side render/inspect)
  - `fflate` (zip for multi-file downloads)
  - Everything else must be justified in writing before install.

## 2. Anti-slop (no fake anything)

- No placeholder data, no lorem ipsum, no dummy files, no "TODO" implementations.
- Every feature must actually perform its promised transformation on real bytes.
- No fake loading states, no fake success toasts, no disabled buttons labeled "coming soon".
- Error messages must state what failed and what to do next — never "something went wrong".
- UI must not imitate functionality it does not have (no grayed-out premium badges, no
  decorative dropdowns that do nothing).
- Text is written for users, not for search engines. No keyword stuffing.

## 3. Sejda task DNA (engineering fidelity)

The product mimics Sejda's server model, originally:

    upload-check → upload → POST /tasks → poll task → download result → TTL auto-delete

- One tool = one task type = one handler. The registry is the single source of truth.
- Params are validated server-side against the registry schema BEFORE a handler runs.
- Files live in a temp store with a TTL (~2h), then are deleted. Nothing persists.
- Rate limit: Sejda free tier = 3 tasks/hour. Governed by LIMITS_ENFORCED env flag
  (false during testing = unlimited; true restores Sejda behavior).
- Limits per job: 50 MB per file / 200 pages, enforced in tasks.ts when enabled.

## 4. Licensing

- 100% original code. No Sejda SDK (it is AGPL), no copied Sejda assets or text.
- Only MIT/Apache/BSD dependencies. `@cantoo/pdf-lib` is the MIT fork of pdf-lib —
  never import upstream `pdf-lib` (its newer versions changed licensing).

## 5. Verification before claims

- Server logic: smoke test must pass (all tools + error paths) before any "done" claim.
- UI: browser-verified with real files before any "done" claim. Lint-clean is not proof.
- Honest scope statements: OCR needs Tesseract, Office→PDF needs LibreOffice — if we
  don't have them, we don't fake them; we say so in the UI instead.
