# 16 — Security and quality review

**Phase:** 10 (defensive review)
**Status:** **COMPLETE for the local prototype; LIMITED OBSERVATIONAL REVIEW for sejda.com**
**Constraint:** No exploitation of the remote service. The one malformed-URI test was run against a temporary **local** server on `127.0.0.1:5199`.

## 1. Scope

| Target | What was reviewed |
|---|---|
| Local `small_editor` | `server.mjs`, `app/index.html`, `app/js/app.js`, `app/js/core.js`, `app/js/tools-data.js`, `package.json`, tests, response headers |
| Captured sejda.com | Public response headers, upload probe, 404/403 behavior, client bundle references, cookie flags; **no auth bypass or destructive test** |

Not reviewed: private server code, databases, cloud configuration, payment flows, or authenticated surfaces.

## 2. Local findings

### F-01 — Malformed percent-encoding crashes the server

| Field | Value |
|---|---|
| **Severity** | **Medium** (local availability; becomes higher if exposed beyond loopback) |
| **Confidence** | **CONFIRMED** |
| **Location** | `server.mjs:29`, `resolveRequestPath` |
| **Evidence** | `reports/_raw/server-5199.log`; temp server on `127.0.0.1:5199`; request `GET /%` → no HTTP response, process exits |
| **Cause** | `decodeURIComponent(urlPath.split("?")[0])` throws `URIError: URI malformed`; the call is outside any `try/catch` |
| **Impact** | A single malformed URL terminates the Node process; denial of service for all local users of that server |
| **Safe reproduction** | Start `PORT=5199 node server.mjs`; request `/%` with `curl --path-as-is`; observe exit |
| **Fix** | Wrap decode in `try/catch` and return `400 Bad Request`; optionally use `new URL(request.url, "http://localhost")` and validate |
| **Status** | Not fixed (no application changes without approval) |

### F-02 — Missing defensive response headers

| Field | Value |
|---|---|
| **Severity** | **Low** (local prototype; higher if hosted) |
| **Confidence** | **CONFIRMED** |
| **Evidence** | `reports/_raw/local-headers.txt`; `GET /app/` returns only `Content-Type`, `Content-Length`, `Cache-Control` |
| **Missing** | `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, HSTS (HTTP only) |
| **Impact** | No defense-in-depth against framing, injection, or referrer leakage; the app does not currently render untrusted HTML |
| **Fix** | Add a strict CSP (`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; worker-src 'self' blob:`), `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Permissions-Policy` minimal |
| **Note** | File responses set `X-Content-Type-Options: nosniff` and COOP; the directory-index response does not. Make headers consistent. |

### F-03 — Symlink escape is possible in the static root

| Field | Value |
|---|---|
| **Severity** | **Low** (requires write access to the served tree) |
| **Confidence** | **POSSIBLE** (code review; no symlink test) |
| **Location** | `server.mjs:28–34`, `48–91` |
| **Cause** | The prefix check is performed on the resolved path string, then `statSync`/`createReadStream` follow symlinks |
| **Impact** | A symlink inside the root pointing outside could be served, bypassing the string prefix check |
| **Fix** | Resolve with `realpathSync` and verify the real path remains under the real root before opening |
| **Status** | Not fixed |

### F-04 — No authentication is a design choice, but binding matters

| Field | Value |
|---|---|
| **Severity** | **Informational** (default loopback) / **High** if changed to `0.0.0.0` without controls |
| **Confidence** | **CONFIRMED** |
| **Evidence** | `HOST || "127.0.0.1"`; no auth, no accounts, no CSRF |
| **Impact** | Anyone who can reach the port can read served files and use the app; the app also has no server-side data |
| **Fix** | Keep loopback default; if exposing, add a reverse proxy with auth/TLS and review file-serving scope |

### F-05 — `innerHTML` usage is static, not user-controlled

| Field | Value |
|---|---|
| **Severity** | **Informational** |
| **Confidence** | **CONFIRMED** |
| **Evidence** | `app.js` sets `infoBody.innerHTML = entry.html` from the static `INFO` object; `pin.innerHTML = pinIcon` static SVG |
| **Impact** | No XSS sink from PDF text, file names, or localStorage was found; PDF text is rendered to canvas/overlay with text/position data, not HTML |
| **Caveat** | Future changes must not route user data into `innerHTML`; use `textContent` as the current tool rows do |

### F-06 — Untrusted PDF parsing in the browser

| Field | Value |
|---|---|
| **Severity** | **Low** (client-side, current pdf.js) |
| **Confidence** | **CONFIRMED** (design) / **UNKNOWN** (specific vulnerabilities) |
| **Evidence** | `pdfjs.getDocument({ data })` on user files |
| **Impact** | A malicious PDF is parsed by pdf.js in the tab; a pdf.js vulnerability could affect the tab |
| **Mitigation** | Keep pdf.js updated; `npm audit` reports 0 known vulnerabilities in the declared tree, but the vendored version is 4.10.38 and should be tracked |
| **Note** | No file is uploaded, which reduces server-side exposure |

### F-07 — No server-side request-body handling

| Field | Value |
|---|---|
| **Severity** | **Informational** |
| **Confidence** | **CONFIRMED** |
| **Evidence** | `server.mjs` only handles GET/HEAD; no `request.on('data')` |
| **Impact** | No upload/body parser attack surface; also no upload feature |

### F-08 — Dependency and test posture

| Field | Value |
|---|---|
| **Severity** | **Informational** |
| **Confidence** | **CONFIRMED** |
| **Evidence** | `npm audit`: 0 vulnerabilities; `npm test`: 16/16; `node scripts/browser-check.mjs`: 14/14 |
| **Gaps** | No linter, formatter check, coverage threshold, CI, SAST, or dependency-update automation |
| **Fix** | Add CI running tests/audit; pin/update pdf.js; add a lint/format check |

## 3. Captured sejda.com observations

These are **observations**, not vulnerability findings.

| Observation | Evidence | Assessment |
|---|---|---|
| Anonymous upload accepted a 3 KB PDF | `art_47c57f36…` | Product behavior; abuse/rate-limit controls unknown |
| `clientId`, `_s`, `lang` cookies are non-HttpOnly, `Secure=false` in capture | `art_47c57f36…` | Worth reviewing in the real HTTPS context; capture cannot prove production flags |
| No `Set-Cookie` on upload | `art_47c57f36…` | No session established by the upload call |
| No `JSESSIONID` / framework banner | `art_d2e5a61d…` | Not evidence of “no Java”; headers can be stripped |
| Custom HTML 404 | `art_d2e5a61d…` | No stack trace or framework page exposed |
| Cloudflare 403 to plain curl | `art_27c8ec96…`, `art_1d03506c…` | Edge/WAF behavior; not bypassed |
| `x-frame-options: SAMEORIGIN`, `permissions-policy: interest-cohort=()` | `art_d2e5a61d…` | Some defensive headers present |
| CSP not observed in captured header set | `art_d2e5a61d…` | Bounded negative; do not claim “no CSP” for all pages |
| Upload endpoint is in `robots.txt` disallow | `art_3af5eb63…` | Crawling restriction; not access control |

### 3.1 What was deliberately not done

- No authentication bypass, credential stuffing, or privilege escalation.
- No hidden/admin endpoint enumeration.
- No malicious PDF, oversized file, or malformed multipart upload.
- No rate-limit or load test.
- No exploitation of the anonymous upload beyond one 3 KB fixture.
- No attempt to access server files or private infrastructure.

## 4. Quality review

| Area | Local | Sejda capture |
|---|---|---|
| Unit tests | 16/16 pass (`reports/_raw/…` not captured for unit run; command output in session) | none available |
| Browser tests | 14/14 pass (`reports/_raw/browser-check.txt`) | none |
| Coverage | not measured | not measurable |
| Lint/format | none | unknown |
| CI | none | unknown |
| Dependency audit | 0 known | not audited (vendored/remote) |
| Error handling | toasts + console; malformed URI gap | custom 404; error bodies unknown |
| Accessibility | skip link, labels, `aria-live`, focus trap, `aria-pressed`; no automated audit | not assessed |
| Secrets | none found in local source | public IDs redacted; no secrets reproduced |

## 5. Recommendations

1. **Fix F-01** (decode guard) before serving beyond localhost.
2. **Add F-02 headers** and make them consistent for directory and file responses.
3. **Resolve symlinks** with `realpath` (F-03).
4. **Keep loopback default** and document it (F-04).
5. **Add CI** for tests + `npm audit` (F-08).
6. **Track pdf.js upgrades** (F-06).
7. For Sejda: review cookie flags, upload abuse controls, and CSP in the real deployment; no conclusion can be drawn from the public capture alone.

## 6. Phase 10 conclusion

The local prototype has **one concrete availability bug** (malformed URI crash), **missing hardening headers**, and a **possible symlink escape**; no XSS sink from user data was found. The remote surface shows an anonymous upload and standard edge behavior; no remote vulnerability was exploited or confirmed. The **web-backend** Java claim remains unrelated to these findings; the official SDK/PDF engine is separately confirmed Java.
