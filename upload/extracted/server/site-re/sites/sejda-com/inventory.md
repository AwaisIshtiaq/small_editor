# sejda.com — inventory

Target: https://www.sejda.com/ · Captured: 2026-10-24 · Environment: Chrome 155 headless, 1440×900, en-US, UTC, light, reduced motion, service workers blocked
Coverage: 52 English routes enumerated from a 1,396-URL sitemap; 49 rendered tool anchors (44 unique); 3 web plans; 2 desktop plans; 7 API tiers
Evidence bundle: `site-re/evidence/sejda-search-2026-10-24.bundle.json` · Artifact hashes: `evidence-manifest.csv`

## 1. Identity

| Field | Value | Status | Evidence |
|---|---|---|---|
| Product name | Sejda / Sejda PDF Desktop | observed | `art_d3ea633b…` (title/brand) |
| Site type | Marketing site + server-backed web app (PDF tools, editor, workflows) | observed | `ev_4073c716…` |
| Rendering model | Server-rendered HTML + jQuery-style widgets; shared bundle `libs-and-partials.min.js`; page bundle `pdf-editor.min.obfuscated.js` | derived | `art_17dea15b…`, `art_f83a8da3…` |
| Primary origin | `https://www.sejda.com` | observed | `ev_4073c716…` |
| Secondary origin | `https://a.sejda.com` (analytics script `pa-*.js`) | observed | `art_d3ea633b…` |
| Edge | Cloudflare (`server: cloudflare`, CF-RAY) | observed | `art_27c8ec96…` (403 headers), `art_d3ea633b…` |
| Locales | 28 locale prefixes, 48 routes each, `hreflang` set on homepage | observed | `art_d3ea633b…`, `art_8558ddab…` |
| robots.txt | `Disallow: /api/`, crawl-delay 10, sitemap references | observed | `art_3af5eb63…` |

## 2. Structure (English routes)

52 non-localised URLs in `sitemap.xml`; the two menu routes `/delete-pdf-annotations` and `/page-numbers-pdf` are **not** in the sitemap (bounded negative).

```
/                    /login              /reset-password
/upgrade             /account*           /desktop
/developers          /html-pdf-api       /workflows
/help                /press              /teachers
```

`*` `/account` is linked from the header but is login-gated and was not opened.

All 44 tool routes are listed in §4.1.

Localisation: `<link rel="alternate" hreflang="…">` for en, fr, de, ro, nl, no, it, pt, es, pl, sv, fi, ja, id, hu, th, vi, tr, ko, cs, zh-Hans, zh-Hant, ar, ru, hi, he, uk, el, da (`art_d3ea633b…`).

## 3. Features

| # | Feature | Entry point | What it visibly does | Status | Evidence |
|---|---|---|---|---|---|
| F1 | “All Tools” mega-menu | header `a.more-tasks` (hoverIntent + click) | Opens a six-column catalogue of 44 tools in 11 named groups; clones 5 popular tools into “Recent”; Escape/backdrop/× closes; scrolls to top | observed | `ev_4073c716…`, `ev_d6c5e8b7…`, `art_9d3944df…` |
| F2 | Tool search field | `#searchTools` inside the menu, placeholder “Type to search” | On every `keyup`: lowercase the query, add `.search-not-matching` to every tool link, then remove the class from links whose text or title contains the query. No fetch, no ranking, no result count. | observed (exercised) + derived (source) | `art_17dea15b…`, `art_9d3944df…`, `art_cf706b43…` |
| F3 | Dimming instead of hiding | CSS for the above | Non-matching links get `opacity:.1`; they stay in place and remain clickable; an empty/whitespace query clears the class | observed | `art_f3d5a8be…` (rule), `art_cf706b43…` (screenshot) |
| F4 | Recents + pins | `Sejda.RememberedTools("prevUsedTools" / "pinnedTools")` | localStorage lists; pin moves an id from recents to pins; strip = pins → recents → defaults, deduped, capped 13; recents capped 12 | derived (source) | `art_17dea15b…` |
| F5 | Editor Find & Replace | Editor toolbar → text group caret → “Find & Replace” | Modal with Find, Replace, Match case, Include links; Find / Replace / Replace all; status line; highlight over the matched line; page-order cycling with wrap | observed (runtime) | `art_8a99c539…`, `art_068373d6…`, `art_b0a086ba…` |
| F6 | Document upload | `input.fileupload` on tool pages | Accepts `.pdf`; a 4-page fixture loaded into the editor during the probe | observed | `art_950ee478…` |
| F7 | Pricing | `/upgrade`, `/desktop` | Three web cards, two desktop cards, 20% volume discount for 10 users | observed | `art_c5ef10a4…`, `art_8316d6c6…` |
| F8 | API pricing | `/html-pdf-api` | Seven monthly tiers + self-hosted/on-premise option | observed | `art_2c04102d…` |
| F9 | Workflows (beta) | `/workflows` | Chains PDF tasks; labelled BETA | observed | `art_f113e328…` |
| F10 | Login / account | `/login` | Google Sign-In button + email/password form | observed (UI only) | `art_d3ea633b…` |

Search-specific detail, including a line-by-line reading of the shipped handler, is in `report.md`.

## 4. Products / services

### 4.1 Tools (44 unique routes, 49 anchors including 5 Recent clones)

All rows: status `observed` in the All Tools DOM; evidence `art_9d3944df…` + `ev_4073c716…`. Descriptions are rendered text, trimmed.

| # | Tool | Route | Group | Rendered description |
|---|---|---|---|---|
| 1 | Compress | `./compress-pdf` | Compress | Reduce the size of your PDF |
| 2 | Edit | `./pdf-editor` | Edit & Sign | Edit PDF files for free. Fill & sign PDF. Add text, links, images and shapes. Edit existing PDF text. Annotate PDF |
| 3 | Extract Pages | `./extract-pdf-pages` | Split | Get a new document containing only the desired pages |
| 4 | Merge | `./merge-pdf` | Merge | Combine multiple PDFs and images into one |
| 5 | Crop | `./crop-pdf` | Other | Trim PDF margins, change PDF page size |
| 6 | Alternate & Mix | `./alternate-mix-pdf` | Merge | Mixes pages from 2 or more documents, alternating between them |
| 7 | Organize | `./organize-pdf` | Merge | Arrange and reorder PDF pages |
| 8 | Split by pages | `./split-pdf` | Split | Split specific page ranges or extract every page into a separate document |
| 9 | Split by bookmarks | `./split-pdf-by-outline` | Split | Extract chapters to separate documents based on the bookmarks in the table of contents |
| 10 | Split in half | `./split-pdf-down-the-middle` | Split | Split two page layout scans, A3 to double A4 or A4 to double A5 |
| 11 | Split by size | `./split-pdf-by-size` | Split | Get multiple smaller documents with specific file sizes |
| 12 | Split by text | `./split-pdf-by-text` | Split | Extract separate documents when specific text changes from page to page |
| 13 | Fill & Sign | `./sign-pdf` | Edit & Sign | Add signature to PDF. Fill out PDF forms |
| 14 | Create Forms | `./pdf-forms` | Edit & Sign | Free PDF forms creator. Make existing PDF documents fillable |
| 15 | Delete Pages | `./delete-pdf-pages` | Edit & Sign | Remove pages from a PDF document |
| 16 | Protect | `./encrypt-pdf` | Security | Protect file with password and permissions |
| 17 | Unlock | `./unlock-pdf` | Security | Remove restrictions and password from PDF files |
| 18 | Watermark | `./watermark-pdf` | Security | Add image or text watermark to PDF documents |
| 19 | Flatten | `./flatten-pdf` | Security | Makes fillable PDFs read-only. Print & scan in one step |
| 20 | PDF to Excel | `./pdf-to-excel` | Convert from PDF | Convert PDF to Excel or CSV online for free. Extract table data from PDF |
| 21 | PDF to JPG | `./pdf-to-jpg` | Convert from PDF | Get PDF pages converted to JPG, PNG or TIFF images |
| 22 | PDF to PowerPoint | `./pdf-to-ppt` | Convert from PDF | Convert PDF to PowerPoint online |
| 23 | PDF to Text | `./extract-text-from-pdf` | Convert from PDF | Copies all text from the PDF document and extracts it to a separate text file |
| 24 | PDF to Word | `./pdf-to-word` | Convert from PDF | Convert from PDF to DOC online |
| 25 | HTML to PDF | `./html-to-pdf` | Convert to PDF | Convert web pages or HTML files to PDF documents |
| 26 | JPG to PDF | `./jpg-to-pdf` | Convert to PDF | Convert Images to PDF |
| 27 | Word to PDF | `./word-to-pdf` | Convert to PDF | Creates a PDF document from Microsoft Word .docx |
| 28 | Bates Numbering | `./bates-numbering-pdf` | Other | Bates stamp multiple files at once |
| 29 | Create Bookmarks | `./pdf-bookmarks` | Other | Create PDF Bookmarks |
| 30 | Edit Metadata | `./edit-pdf-metadata` | Other | Change PDF Author, Title, Keywords, Subject and other metadata fields |
| 31 | Extract Images | `./extract-images-from-pdf` | Other | Extract images from PDF |
| 32 | Flip | `./flip-pdf` | Other | Mirror pages horizontally or vertically |
| 33 | Grayscale | `./grayscale-pdf` | Other | Make a PDF text and images grayscale |
| 34 | Header & Footer | `./header-footer-pdf` | Other | Apply page numbers or text labels to PDF files |
| 35 | N-up | `./n-up-pdf` | Other | Print multiple pages per sheet per paper. A5 plan as 4-up on A3 or A4 2-up on A3 |
| 36 | Page Numbers | `./page-numbers-pdf` | Other | Add PDF page numbers |
| 37 | Rename | `./rename-pdf` | Other | Change document filename based on text from the PDF pages |
| 38 | Repair | `./repair-pdf` | Other | Recover data from a corrupted or damaged PDF document |
| 39 | Resize | `./resize-pdf` | Other | Add page margins and padding, Change PDF page size |
| 40 | Rotate | `./rotate-pdf-pages` | Other | Rotate and save PDF pages permanently |
| 41 | Remove annotations | `./delete-pdf-annotations` | Other | Batch remove highlights, strikeouts or any other annotations from a PDF document |
| 42 | Deskew | `./deskew-pdf` | Scans | Automatically straighten and deskew scanned PDF pages |
| 43 | OCR | `./ocr-pdf` | Scans | Convert PDF scans to searchable text and PDFs. Extract text from scans |
| 44 | Workflows | `./workflows` | Automate | Execute series of tasks on PDF documents. Configure tool chains to process PDFs |

### 4.2 Web plans (`/upgrade`, rendered)

| Plan | Price | Term | Billing | Desktop access | Evidence |
|---|---|---|---|---|---|
| Web Week Pass | $5 per user | 7 days | one-time | No | `art_c5ef10a4…` |
| Web Monthly | $7.50 per user / month | monthly | recurring | No | `art_c5ef10a4…` |
| Desktop + Web Annual | $63 per user / year (“save 30% over monthly”) | yearly | recurring | Yes | `art_c5ef10a4…` |
| Free tier | $0 | — | “No signup required. Limited usage and features” | — | `art_c5ef10a4…` |

All paid web cards show “20% volume discount for 10 users”.

### 4.3 Desktop plans (`/desktop`, rendered)

| Plan | Price | Term | Includes | Evidence |
|---|---|---|---|---|
| Desktop Week Pass | $7.95 per user | 7 days | Desktop + Web for 7 days | `art_8316d6c6…` |
| Desktop + Web Annual | $63 per user / year | yearly | Desktop + Web for a year | `art_8316d6c6…` |
| Business | “Find the perfect version for your business” | — | team section, no price rendered in capture | `art_8316d6c6…` |

### 4.4 Other services

| Service | What is rendered | Evidence |
|---|---|---|
| HTML to PDF API | 7 monthly tiers: $12/200, $24/300, $48/600, $96/1200, $192/2400, $384/4800, $768/9600; unlimited document size (∞); self-hosted/on-premise option; custom plan on request | `art_2c04102d…` |
| Developers | API docs entry point | `art_dbf8e31e…` |
| Workflows | BETA task chains | `art_f113e328…` |
| Teachers | “Sejda Free For Education” | `art_e36eddf3…` |
| Help | “Help & Knowledge Base” | `art_a8114ca8…` |
| Press | press page in sitemap | `art_8558ddab…` |

## 5. Network / API surface

| Endpoint | Method | Resource | Called from | Status | Evidence |
|---|---|---|---|---|---|
| `/api/*` | — | product/API backend | robots.txt disallows crawling | unknown | `art_3af5eb63…` |
| `a.sejda.com/js/pa-*.js` | GET | analytics | every page | observed (loaded) | `art_d3ea633b…` |
| `/cdn-cgi/challenge-platform/scripts/jsd/main.js` | GET | Cloudflare bot check | inline bootstrap | observed (inline script) | `art_d3ea633b…` |

Not observed: any XHR/fetch on `keyup` in the tool search. The shipped handler only manipulates classes and contains no network call. Status: **derived from source**, not a network-capture claim.

## 6. JS / CSS bundles

| Bundle | Bytes | Role | Evidence |
|---|---:|---|---|
| `/cache/654/js/libs-and-partials.min.js` | 803,543 | jQuery plugins, header, mega-menu + **tool search**, upload helpers, recents/pins | `art_17dea15b…` |
| `/js/pages/pdf-editor.min.obfuscated.js?v=525` | 394,992 | Editor application, obfuscated | `art_f83a8da3…` |
| `/css/index.min.css?v=409` | 162,057 | Site CSS incl. `.search-not-matching{opacity:.1}` | `art_f3d5a8be…` |
| inline Cloudflare bootstrap | ~1 KB | challenge iframe | observed | `art_d3ea633b…` |

## 7. Data & third parties

| Party | Purpose | How observed | Status | Evidence |
|---|---|---|---|---|
| Cloudflare | CDN/WAF + challenge platform | response headers, inline script | observed | 403 headers; `art_d3ea633b…` |
| Google | Sign-In (`google-signin-client_id` meta) | homepage head | observed | `art_d3ea633b…` |
| Facebook | `fb:app_id` meta | homepage head | observed | `art_d3ea633b…` |
| Sentry/Raven | error reporting (`Raven.captureException` in bundle) | bundle source | derived | `art_17dea15b…` |
| a.sejda.com | first-party analytics | script tag + resource timing | observed | `art_d3ea633b…` |
| Payment provider | not rendered on inspected logged-out pages | — | unknown | — |

## 8. Unknowns

See `unknowns.md`.
