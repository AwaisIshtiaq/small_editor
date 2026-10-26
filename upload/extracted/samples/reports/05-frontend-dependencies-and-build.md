# 05 — Frontend dependencies and build

**Phase:** 2 (dependencies/build)
**Status:** **COMPLETE for the local prototype; PARTIAL for sejda.com**

## 1. Local `small_editor`

### 1.1 Package manifest

```json
{
  "name": "small-editor",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.mjs",
    "test": "node --test test/",
    "sample": "node scripts/make-sample.mjs"
  },
  "dependencies": { "pdfjs-dist": "^4.10.38" },
  "devDependencies": { "pdf-lib": "^1.17.1" }
}
```

- **Runtime dependency:** `pdfjs-dist` only. The browser load uses the vendored copy at `app/vendor/pdfjs/`, not a CDN or bundler.
- **Dev dependency:** `pdf-lib`, used only by `scripts/make-sample.mjs` to generate the fixture.
- **Test runner:** Node's built-in `node:test`; no Jest/Vitest/Playwright dependency.
- **Browser check:** custom CDP harness in `scripts/browser-check.mjs`; starts its own headless Chrome on port 9337 if `CDP` is not set.

### 1.2 Versions observed in the artifact

| Component | Version | Evidence |
|---|---|---|
| pdf.js | **4.10.38** | `app/vendor/pdfjs/pdf.mjs` exports `pdfjsVersion = "4.10.38"`; `apiVersion` and `version` also `4.10.38` |
| pdf-lib | `^1.17.1` (manifest) | `package.json`; not loaded by the app |
| Node runtime | 26.12.1 | host |

`pdf.mjs` contains a `//# sourceMappingURL=pdf.mjs.map` comment, but **the map file is not present** in the vendor directory. This does not affect execution; it only means the vendored library cannot be source-mapped from this copy.

### 1.3 Build and serving

- **No bundler, transpiler, CSS framework, or minifier.**
- Files are served as authored: `index.html` loads `./css/app.css` and `./js/app.js` as an ES module.
- `app.js` imports `../vendor/pdfjs/pdf.mjs` and `./core.js`, `./tools-data.js`.
- `server.mjs` is a zero-dependency static server:
  - `GET`/`HEAD` only; other methods → `405`.
  - `/` → `302 /app/`.
  - Directory paths serve `index.html`.
  - MIME map for html/js/mjs/css/json/pdf/svg/png/woff2/ftl/bcmap/pfb/ttf/txt.
  - Path traversal check using `resolve` + prefix; `Cache-Control: no-store`.
  - Binds `127.0.0.1:5173` by default.
- **No Dockerfile, CI workflow, or deployment manifest** in the workspace.

### 1.4 Dependency health

`npm audit --json` on 2026-10-24:

```text
vulnerabilities: 0 (info 0, low 0, moderate 0, high 0, critical 0)
dependencies: prod 2, dev 5, optional 12, total 18
```

Raw: `reports/_raw/npm-audit.json`. This is a registry audit of the declared tree, not a proof that the vendored pdf.js copy is current; it is version 4.10.38.

### 1.5 External requests

After page load, the app makes **no external requests**:

- No CDN scripts, fonts, images, analytics, or API calls in `app/index.html`.
- The only `fetch` in `app/js/app.js` is for the local sample PDF.
- File-open uses `File.arrayBuffer()`.
- No service worker, WebSocket, EventSource, `sendBeacon`, or IndexedDB.

## 2. Captured sejda.com

### 2.1 Bundles

| Artifact | Bytes | Role |
|---|---:|---|
| `libs-and-partials.real.js` | 803,543 | Shared jQuery-style code: header, mega-menu, **tool search**, upload helpers, recents/pins |
| `pdf-editor.min.js` | 394,992 | Editor application, obfuscated |
| `index.min.css` | 162,057 | Site CSS, including `.search-not-matching { opacity:.1 }` |
| `pdf-editor.html` | 289,503 | Editor markup |

Evidence: `site-re/sites/sejda-com/evidence-manifest.csv` (`art_17dea15b…`, `art_f83a8da3…`, `art_f3d5a8be…`, `art_e13a2c04…`).

### 2.2 What is known

- **CONFIRMED:** minified production bundles; jQuery-style `keyup` binding; no source maps found in the captured artifacts.
- **CONFIRMED:** the editor bundle is obfuscated; literal grep for the editor's DOM ids does not find them (C-0045).
- **CONFIRMED:** third-party/edge signals: Cloudflare challenge script; Google Sign-In client-id meta; Facebook `fb:app_id` meta; first-party analytics at `a.sejda.com`; `Raven.captureException` in the shared bundle (derived).
- **UNKNOWN:** frontend framework and version; exact jQuery version; build tool; whether the editor uses a framework; source map availability on the origin outside the captured set.

### 2.3 Third-party dependency table

| Party | Evidence | Status | Role |
|---|---|---|---|
| Cloudflare | `server: cloudflare`, CF-RAY, challenge script | observed | CDN/WAF/bot check |
| Google | `google-signin-client_id` meta | observed | Sign-In identity |
| Facebook | `fb:app_id` meta | observed | Facebook app identity |
| `a.sejda.com` | analytics script `pa-*.js` | observed | first-party analytics |
| Sentry/Raven | `Raven.captureException` in shared bundle | derived | client error reporting |
| Payment provider | not rendered on logged-out pages | unknown | checkout/billing |

No API keys, tokens, or secrets are reproduced. The Google client id and Facebook app id are public identifiers; even so, their values are omitted from this report.

## 3. Build/deployment differences

| Aspect | Local | Sejda capture |
|---|---|---|
| Build | none; direct files | minified/obfuscated production bundles |
| Module system | native ES modules | minified browser bundle |
| CSS | hand-written | minified site CSS |
| Server | Node static server | Cloudflare in front of unknown origin |
| CI/CD | none | unknown |
| Source maps | absent for vendored pdf.js | none found in capture |

## 4. Phase 2 dependency conclusion

The local app is deliberately dependency-light and buildless: **pdf.js is the only runtime library**. The Sejda frontend is a production bundle whose exact framework/build chain cannot be established from the captured, obfuscated artifacts. Neither target contains a Java dependency or backend build file.
