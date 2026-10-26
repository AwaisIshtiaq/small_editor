# 06 — API inventory

**Phase:** 3 (API discovery)
**Status:** **COMPLETE for the local server; OBSERVED SUBSET for sejda.com**
**Constraint:** Only ordinary, authorized workflows were used. No auth bypass, no hidden-endpoint enumeration, no conversion task.

## 1. Local `small_editor`: no application API

**CONFIRMED.** The local app is served by `server.mjs` and has **no JSON API, no upload endpoint, no auth, no database, no task queue**.

| Method | Path | Purpose | Response |
|---|---|---|---|
| GET/HEAD | `/` | Redirect | `302 Location: /app/` |
| GET/HEAD | `/app/` | App shell | `200 text/html` |
| GET/HEAD | `/app/*` | Static JS/CSS/assets | `200` with MIME type |
| GET/HEAD | `/samples/sample.pdf` | Fixture | `200 application/pdf` |
| GET/HEAD | any missing path | 404 | `404 text/plain` |
| POST/PUT/PATCH/DELETE | any | Method rejection | `405`, `Allow: GET, HEAD` |

All local “operations” are client-side:

- Upload → `File.arrayBuffer()` in the tab.
- PDF parse/render → pdf.js.
- Find → `core.js`.
- Export → Blob download.
- Recents/pins/theme → `localStorage`.

**There is no server-side API contract to document.**

## 2. Captured sejda.com: observed public subset

### 2.1 Endpoint table

| # | Method | Path | Purpose | Trigger | Observed response | Status |
|---|---|---|---|---|---|---|
| 1 | POST | `/api/files/upload-check` | Pre-upload check | Selecting a PDF for an editor/tool | `200 application/json;charset=utf-8` → `{"status":"ok"}` | **observed** |
| 2 | POST | `/api/files/upload?_s=4&uplid=<id>` | Upload file | After check | `200 application/json` → `{"id":"<uuid>-<suffix>"}` | **observed** |
| 3 | POST | `/api/files/{id}/password` | Submit password for encrypted file | Password prompt | not exercised | **client reference only** |
| 4 | DELETE | `/api/tasks/{id}` | Delete/cancel a task | Task UI | not exercised | **client reference only** |
| 5 | POST | `https://a.sejda.com/api/event` | First-party analytics event | Page/editor activity | `202 text/plain` body `ok` | **observed** |
| 6 | GET | `/api/` | Probe only (not a UI call) | Manual same-origin fetch | `404` | **observed** |

Endpoints 3–4 are literals/call sites in the shipped shared bundle and editor HTML (`art_17dea15b…`, `art_e13a2c04…`); their schemas and server behaviour were **not** exercised. They are listed to document the client's references, not as confirmed server behaviour.

### 2.2 Sanitized examples

**Upload check**

```http
POST /api/files/upload-check HTTP/1.1
Host: www.sejda.com
Origin: https://www.sejda.com
Content-Type: application/x-www-form-urlencoded
Cookie: clientId=…; _s=…; lang=…

uplid=<upload-id>
```

```http
HTTP/1.1 200 OK
Content-Type: application/json;charset=utf-8
Server: cloudflare
CF-Cache-Status: DYNAMIC

{"status":"ok"}
```

**Upload**

```http
POST /api/files/upload?_s=4&uplid=<upload-id> HTTP/1.1
Host: www.sejda.com
Origin: https://www.sejda.com
Content-Type: multipart/form-data; boundary=…

<3 KB PDF fixture>
```

```http
HTTP/1.1 200 OK
Content-Type: application/json;charset=utf-8
Server: cloudflare
CF-Cache-Status: DYNAMIC

{"id":"07a99d96-68d5-4fab-b8b8-cde9d0e61ddc-JOL2FYP0HJLU4V5P_2"}
```

The returned id format is `<uuid>-<suffix>`, where the suffix is server-generated. The example is the observed value from the probe; it is not a live credential.

**Analytics**

```http
POST https://a.sejda.com/api/event
→ 202 text/plain
ok
```

### 2.3 Request headers and cookies (redacted)

- No `Set-Cookie` was observed on the upload calls.
- Cookies present: `clientId` (persistent), `_s` (session), `lang` (persistent). All three were **non-HttpOnly** and `Secure=false` in the captured context.
- `Server: cloudflare` on all responses.
- `cf-cache-status: DYNAMIC`, `cf-ray` present.
- No `JSESSIONID`, `X-Powered-By`, `X-Application-Context`, Tomcat/Jetty banner, or Spring error page was observed (C-0056).
- Cookie **values** were deliberately not recorded or reproduced.

### 2.4 Triggering UI actions

| UI action | Call |
|---|---|
| Open `/pdf-editor` | Page load + analytics |
| Select a PDF (`input.fileupload`) | `upload-check` → `upload` |
| Upload encrypted PDF | client may call `/api/files/{id}/password` (not exercised) |
| Delete/cancel task | client may call `DELETE /api/tasks/{id}` (not exercised) |
| Tool search | **no API call** (class manipulation only) |
| Editor find | **no API call observed** |
| Recents/pins | `localStorage` only |

## 3. What remains unknown

| Question | Status | Would require |
|---|---|---|
| Request schema for upload-check beyond `uplid` | UNKNOWN | full request capture / server docs |
| Upload field names, size/type limits, accepted MIME types | UNKNOWN | controlled probes / docs |
| `upload` response semantics beyond `id` | UNKNOWN | task creation flow |
| Password endpoint request/response | UNKNOWN | encrypted-file flow |
| Task status/download endpoints | UNKNOWN | authenticated or ordinary task flow |
| Auth/authorization for uploads | UNKNOWN | account session |
| Rate limiting, retries, timeouts | UNKNOWN | controlled load or docs |
| File retention/expiry | UNKNOWN | docs or timed observation |
| Whether `/api/files/{id}` download exists | UNKNOWN | task completion |
| Backend language/framework | UNKNOWN | server artifact |

## 4. OpenAPI

Only operations 1 and 2 have enough evidence for a contract. See `07-api-contracts.yaml`. Operations 3–4 are recorded there as unverified client references, not as implemented operations.

## 5. Evidence

| Evidence | Supports |
|---|---|
| `art_47c57f36…` (`raw/upload-probe.json`) | Upload responses, bodies, cookie names/flags |
| `art_d2e5a61d…` (`raw/backend-probe.json`) | Headers, cookies, page probes, 404 |
| `art_39e1ea6c…` (`raw/routes-probe.json`) | `/api/` 404, `/search` etc. 404 |
| `art_17dea15b…` | Endpoint literals and call sites |
| `art_e13a2c04…` | Editor markup |
| C-0053–C-0056 | Claims ledger |

## 6. Phase 3 conclusion

The local app has **no API**. Sejda exposes a small public JSON surface for file upload plus analytics; that is enough to document a **reconstructed** upload contract, but not enough to describe the backend, task lifecycle, storage, auth, or processing engine.
