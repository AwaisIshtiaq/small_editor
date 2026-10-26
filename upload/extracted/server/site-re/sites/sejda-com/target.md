# sejda.com — target

| Field | Value |
|---|---|
| URL | https://www.sejda.com/ |
| Also inspected | /pdf-editor, /upgrade, /desktop, /workflows, /html-pdf-api, /developers, /help, /teachers |
| Scope | Public, logged-out web surfaces. Search: (a) “All Tools” search, (b) editor Find & Replace. |
| Out of scope | Logged-in account area, checkout, server source/runtime, `/api/` crawling (robots-disallowed), non-English locales |
| Captured | 2026-10-23 → 2026-10-24 |
| Browser | Chrome 155.0.8059.85 (headless via CDP), Windows, 1440×900, en-US, UTC, light, reduced motion, service workers blocked |
| Edge | Cloudflare in front of the origin (`Server: cloudflare`) |
| Backend | Not obtained. Public JSON contract observed (`/api/files/upload-check`, `/api/files/upload`); Java reported by requester but **unverified** (`report.md` §4) |
| REA | `site-re/evidence/sejda-search-2026-10-24.bundle.json` |
| Static artifacts | `site-re/sites/sejda-com/raw/` (SHA-256 in `evidence-manifest.csv`) |
| Screenshots | `site-re/sites/sejda-com/captures/` |

## Coverage

- **Sitemap**: 1,396 URLs = 28 locales × 48 routes + 52 English routes (`raw/sitemap.xml`).
- **All Tools panel**: 49 rendered anchors = 44 unique tool routes + 5 cloned “Recent” entries.
- **Products/prices captured**: 3 upgrade cards, 2 desktop cards, 7 HTML→PDF API tiers, free teachers programme, workflows (beta), self-hosted API option.
- **Search surfaces**: site tool search (static + runtime) and editor document find (runtime, with a 4-page fixture).

## Evidence notation

- `ev_<64 hex>` — REA Evidence record (bundled above).
- `art_<64 hex>` — byte artifact captured through the browser; hash in `evidence-manifest.csv`. Tables may abbreviate these as `art_<12 hex>…`; prefixes are unique and resolve in the manifest.
- `cap_<name>` — manually driven CDP probe recorded in `raw/*-observations.json` / `raw/probe-search.json`.

## Deliberate limitations

- Cloudflare returns **403** to plain `curl` on HTML and JS; every artifact here was fetched **through the already-loaded browser** or with REA. The 403 pages are kept only as `raw/home.html` (not used as evidence).
- The tool-search input is present but `display:none` in the captured server HTML; the filter was exercised by removing that inline style (recorded as an intervention in `raw/probe-search.json`). Whether real users see it depends on an unknown server-side/AB condition.
- The editor find behaviour is observed, not read from source: its implementation is inside an obfuscated bundle where the DOM ids do not appear as strings.
