# sejda.com — unknowns and bounded negatives

Everything below is deliberately *not* claimed as behaviour. Each item records the boundary that was actually searched or exercised.

## U1. Why the tool-search field is hidden

- **Observation:** `#searchTools` exists on the homepage and on `/pdf-editor`, but its wrapper has an inline `style="display: none"`. Opening the menu does not change it. The client bundle never removes that inline style.
- **Bounded negative:** the stylesheet rule `@media (min-width:450px){.search-tools-wrap{display:block}}` cannot override an inline style, and no captured JS path removes it.
- **Unknown:** whether this is an expired experiment, a geo/`data-ipcountry` flag, a server-side feature flag, or a regression.
- **Would settle it:** compare responses across countries/accounts, or find the template branch that renders the inline style.

## U2. Editor find algorithm

- **Observed:** counts per text line, case-insensitive default, status format, cycling, single line highlight, replace-all-in-line.
- **Bounded negative:** literal grep of `pdf-editor.min.obfuscated.js` (394,992 bytes) found none of `searchStatus`, `findText`, `replaceMatchCase`, `searchReplaceTextPrompt`, `btn-replace-all`. The bundle resolves ids through an obfuscated string table.
- **Unknown:** tokenisation, line grouping rules, handling of rotated text, ligatures, hyphenation, multi-column layouts, and whether search is done on canvas OCR text or the text layer.
- **Would settle it:** run targeted probes with multi-column, rotated and ligature fixtures, or deobfuscate the bundle's string table.

## U3. Empty, whitespace and regex queries in the editor

- **Observation:** a probe sequence that included `""`, `"   "`, `"(parentheses)"`, `"."`, `"a.b"`, `"Café"` left the page unresponsive to `Runtime.evaluate` for 120 s.
- **Unknown:** which query caused the hang, whether it is an infinite loop, and whether regex metacharacters are interpreted literally.
- **Bounded negative:** no successful result was recorded for those queries; this is not a claim that the editor is broken.

## U4. “Include links”

- The checkbox exists with default `checked`, but the fixture PDF had no link annotations.
- **Unknown:** whether it searches `/Annots` URI text, link labels, or both.

## U5. Account-level personalisation

- Recents/pins were read from the shipped source (`localStorage`), not from a signed-in session.
- **Unknown:** whether pins sync to an account, whether server-side defaults differ for pro users, and whether incognito/localStorage failures silently degrade (the code wraps reads in `try/catch`).

## U6. Backend and API

- `robots.txt` disallows `/api/`, and `/api/` returns 404 to an unauthenticated in-page fetch.
- **Observed on 2026-10-25:** a logged-out split task completed the sequence `upload-check -> upload -> POST /api/tasks -> GET /api/tasks/{id}/change -> result page -> signed ZIP download` [C-0059–C-0063]. The task response exposed `X-RateLimit-Remaining: 2` and `X-RateLimit-Wait: 3599` [C-0062].
- **Still unknown:** processing queue/worker, storage backend, retention period, OCR provider, exact rate-limit scope, CSRF/origin policy beyond observed CORS headers, API authentication for non-browser clients, payment provider, failure/error bodies, and other task types.
- Not exercised: checkout, login, password reset, account pages, chunked upload above 5 MB, password-protected files, cancellation, task deletion, cloud-file import.

## U7. Search across locales

- Only the English homepage/editor were exercised.
- The sitemap shows 28 locale prefixes × 48 routes, but translated search placeholders, stemming and description text were not tested.
- **Unknown:** whether localized tool captions are also filtered by the same substring code (they should be, since the handler reads rendered text) and whether non-Latin queries behave differently.

## U8. “Every product” completeness

- 44 tool routes came from the All Tools panel; the sitemap has 42 of them, so the menu is the broader source.
- The blog sitemap (`https://www.sejda.com/blog/sitemap.xml`) was **not** crawled.
- Press, account and legal pages were not enumerated beyond the sitemap.
- **Unknown:** unlinked/experimental tools, retired products, and regional offers.

## U9. Cloudflare interference

- Plain `curl` receives 403 with a block page; all artifacts were captured through Chrome or the loaded page.
- **Unknown:** whether a browser with a different fingerprint receives different HTML (A/B variants), and whether the hidden search field is one such variant.

## U10. Backend language and “complete application”

- **Not obtained:** server source, JAR/WAR, build files, database schema, queue/storage config, deployment or infrastructure. The public client is not the complete application.
- **Observed:** a JSON API (`/api/files/upload-check`, `/api/files/upload`, `POST /api/tasks`, `GET /api/tasks/{id}/change`, signed result download, plus the client-only password/touch/cancel/delete references), custom HTML 404s, and `server: cloudflare`.
- **Not observed:** `JSESSIONID`, `X-Powered-By`, `X-Application-Context`, Tomcat/Jetty banners or a Spring `Whitelabel Error Page`; the upload/task/change responses set no cookie.
- **Reported, unverified:** that the **sejda.com web backend** is Java. The public evidence is compatible with Java but does not identify the runtime; other stacks would look the same behind Cloudflare. The 2026-10-25 bounded API pass did not add a Java/framework fingerprint.
- **External follow-up (2026-10-24):** the official <https://github.com/torakiki/sejda> repository was reviewed at commit `98712cd`. It is the **Java SDK/PDF engine**, not the sejda.com web backend: 583 Java files, 9 Maven modules, no web/API module, no Spring/servlet/controllers, no HTTP endpoints, no `main`, no DB/auth/queue code. This confirms **Java for the engine**, not for the sejda.com web service. See `reports/19-official-sejda-sdk-review.md`.
- **Would settle it:** a **web/API** JAR/WAR or server source in the workspace (REA can decompile it), a framework-leaking error/stack trace tied to the web layer, or an authenticated surface that exposes runtime headers.
