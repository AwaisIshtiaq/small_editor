# site-re — website / webapp reverse-engineering notes

Everything produced for a site lives here. One folder per site: `sites/<slug>/`.

## Layout

```
site-re/
  README.md              this file: method, rules, current status
  _template/
    inventory.md         structure + features + products template
    claims.csv           claim ledger (every statement -> evidence or unknown)
  evidence/              exported REA Evidence bundles  (ev_*.json, byte-stable)
  captures/              (legacy) screenshots shared across sites
  sites/<slug>/
    target.md            URL, scope, capture environment, date, coverage
    inventory.md         filled from _template/inventory.md
    claims.csv           filled from _template/claims.csv
    unknowns.md          bounded negatives + open questions
    report.md            narrative analysis with code excerpts and mapping
    evidence-manifest.csv byte artifacts: art_<sha256>, path, bytes, description
    raw/                 browser-fetched HTML/JS/CSS, probe JSON, hashes
    captures/            screenshots for this site
    tools/               CDP helpers used to collect evidence
```

## Rules used when filling these files

- No statement enters `inventory.md` without a row in `claims.csv`.
- `claims.csv.status` is one of: `observed` | `derived` | `inferred` | `unknown`.
- Every `observed`/`derived` row carries at least one `evidence_id`.
- Evidence id forms:
  - `ev_` + 64 hex — REA Evidence record, exported under `evidence/`.
  - `art_` + 64 hex — byte artifact captured through the browser or CDP; SHA-256 listed in
    `sites/<slug>/evidence-manifest.csv`. Tables may abbreviate as `art_<12 hex>…`; prefixes
    are unique and resolve in the manifest.
  - `cap_` — a probe record stored under `raw/` (for observations that were not produced by
    REA and are too stateful to hash as a single page artifact).
- Multiple evidence ids in one row are separated by ` ; `.
- Bounded negatives are written as "not found in <scope>" — never "does not exist".
- A capture describes **one deterministic rendering** (viewport, locale, timezone,
  colour scheme, reduced-motion, service workers), not "the site".
- Login-gated, server-side, and personalized behaviour stays `unknown` unless a
  declared scenario actually exercised it.
- Interventions (forcing a hidden element visible, uploading a fixture, overriding a viewport)
  must be named in `scope_or_limitation` and in `report.md`.
- Note how each artifact was obtained. Plain `curl` may be blocked by an edge provider; a
  browser-fetched artifact is still an artifact, not a claim about what a different client sees.

## Status

- 2026-10-22: scaffold created. No site analysed yet. No REA evidence in session.
- 2026-10-24: **sejda.com** analysed.
  - Two distinct search surfaces: the “All Tools” substring filter (dims to 10%) and the
    editor’s Find & Replace (line-level counting, replace-in-line).
  - 44 tools, 11 named groups, 52 English routes, 28 locales, 3 web plans, 2 desktop plans,
    7 API tiers.
  - Key negative: the tools search input is `display:none` in the captured render; reason
    unknown.
  - Backend: public JSON API observed; Java claim **not verified** (no `JSESSIONID`,
    framework header or server source). See `sites/sejda-com/report.md` §4.
  - Evidence: 3 retained REA records (`ev_*`), 40 hashed artifacts (`art_*`), including five probe JSONs.
  - Rebuild: `D:\small_editor` — local-first PDF reader with a Sejda-parity tool palette and
    occurrence-level document find. 16 unit tests + 14 browser checks.
