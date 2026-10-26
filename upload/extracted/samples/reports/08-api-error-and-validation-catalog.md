# 08 — API error and validation catalog

**Phase:** 3 (errors/validation)
**Status:** **PARTIAL** — success paths observed; error paths mostly not exercised

## 1. Local `small_editor`

### 1.1 HTTP server errors

| Condition | Status | Body | Evidence |
|---|---|---|---|
| Missing file | `404` | `Not found` (`text/plain`) | `server.mjs`; local request |
| Path escapes root | `403` | `Forbidden` | `server.mjs` |
| Method other than GET/HEAD | `405` | `Method not allowed` + `Allow: GET, HEAD` | `server.mjs` |
| Malformed percent-encoding (e.g. `/%`) | **process exits** with `URIError: URI malformed`; client gets no response | Node stack trace in server log | safe local test on port 5199: `reports/_raw/server-5199.log` |
| Directory without `index.html` | `404` | `Not found` | `server.mjs` |

The malformed-URI behavior is a **local availability bug**, not a remote finding. It was verified on a temporary server on `127.0.0.1:5199`; the main server on 5173 was not affected. It is discussed in `16-security-and-quality-review.md`.

### 1.2 Client-side validation

| Input | Validation | Result |
|---|---|---|
| File picker/drop | name ends `.pdf` **or** MIME `application/pdf` | otherwise toast “Please choose a PDF file” |
| PDF parse | pdf.js `getDocument` rejection | toast “That file could not be read as a PDF” |
| Find query | trimming, optional case/word boundary | empty query clears highlights; no regex |
| Tool query | trimming, substring | empty/whitespace restores all rows |
| Sample fetch | `response.ok` | toast with HTTP status on failure |
| localStorage | `try/catch` | silent fallback |

No server-side validation exists because there is no server-side application.

## 2. Captured sejda.com

### 2.1 Observed responses

| Condition | Status | Body / headers | Notes |
|---|---|---|---|
| `POST /api/files/upload-check` with 3 KB PDF | `200` | `{"status":"ok"}`, `application/json;charset=utf-8`, `Server: cloudflare` | Success |
| `POST /api/files/upload` with same file | `200` | `{"id":"<uuid>-<suffix>"}`, `application/json;charset=utf-8` | Success |
| `GET /api/` (manual probe) | `404` | custom HTML 404 | No API index |
| `GET /search`, `/all-tools`, `/tools` | `404` | 404 | No separate search route in this scope |
| Plain `curl` to HTML/JS | `403` | Cloudflare block page + CF-RAY | Client fingerprint/WAF, not origin validation |
| Nonexistent page | `404` | custom HTML | No framework banner observed |

The 404 page is a **custom HTML page**, not a Spring Whitelabel page, Tomcat error page, or Jetty page.

### 2.1.1 Successful task responses and one client-contract trap

Seven logged-out task types completed successfully across two free-tier windows: `splitByPages`, `merge`, `headerFooter`, `pdfToImage`, `splitByBookmarks`, `alternateMix` and `encrypt` (report `22`). Each `POST /api/tasks` returned HTTP 200 with a bare JSON string task id; each `GET /api/tasks/{id}/change` returned `status: "Completed"` and result metadata. Window one carried `X-RateLimit-Remaining` values 2, 1 and 0 with waits 3599, 3260 and 3140 seconds; window two repeated 2, 1 and 0 with waits 3599, 3483 and 3443 seconds.

`resultFullUrlPattern` contains the **URL-encoded** placeholder `%7B%7Bfilename%7D%7D`. Substituting `resultFilename` returned the expected `application/zip` for the multi-file PDF-to-JPG and split-by-bookmarks results, and PDF for merge, alternateMix, header/footer and encrypt. The unresolved template returned HTTP 200 with `text/html` (289,508 bytes) for the first multi-file ZIP; the single-file PDFs still downloaded correctly with the unresolved template. The reason for the difference is **UNKNOWN**. This is a client-contract trap, not an observed error schema.

### 2.2 Not exercised / unknown

| Area | Status | Why |
|---|---|---|
| Upload too large | UNKNOWN | would require controlled size probes; not run |
| Wrong MIME/extension | UNKNOWN | not run |
| Malformed multipart | UNKNOWN | not run |
| Missing `uplid` / `_s` | UNKNOWN | not run |
| Encrypted PDF / wrong password | UNKNOWN | `/api/files/{id}/password` not exercised |
| Task deletion / invalid task id | UNKNOWN | `DELETE /api/tasks/{id}` not exercised |
| Rate limits (429) | UNKNOWN | no load testing |
| Auth failures (401/403 from origin) | UNKNOWN | no account session |
| Server exceptions (500) | UNKNOWN | not triggered |
| Validation message text | UNKNOWN | no error response captured |

No destructive or high-volume tests were run.

### 2.3 Validation inference

**POSSIBLE, not confirmed:** the client performs a pre-upload check (`upload-check`) before the multipart upload, which is consistent with a server-side size/type/quota check. The response only proves the check accepted a 3 KB PDF; it does not prove what the check validates.

**UNKNOWN:** whether limits are enforced at the edge (Cloudflare), the origin, the client, or all three.

## 3. Error-shape comparison

| Layer | Local | Sejda capture |
|---|---|---|
| 404 | plain text | custom HTML |
| 405 | plain text + `Allow` | not observed |
| 403 | plain text (path escape) | Cloudflare HTML |
| 500 | process crash on malformed URI | not observed |
| JSON errors | none (no JSON API) | not observed |
| Framework banners | none | none |

## 4. Phase 3 error conclusion

Success paths for two upload operations and seven task types are documented. Error and validation behavior is **not** documented beyond 404/403 observations; no claim about limits, auth failures, or 500 responses is supportable. The local server has one concrete malformed-URI crash that should be fixed before exposing it beyond localhost.
