# 09 — Backend language and artifact inventory

**Phase:** 4 (backend and compiled artifact recovery)
**Status:** **CONFIRMED for the local prototype (Node.js); CONFIRMED that the official Sejda SDK is Java; UNKNOWN/UNAVAILABLE for the sejda.com web backend**
**Date:** 2026-10-24 UTC

> **Update 2026-10-25:** an independent Java PoC now exists in `reconstructed-backend/` (report `21`). It is not Sejda source and does not change the Phase 4 findings below; it is a separate reconstruction using Apache PDFBox, not the Sejda SDK.

## 1. The direct answer

| Question | Answer | Confidence |
|---|---|---|
| Does the workspace contain a Java backend? | **No Sejda/Java backend at Phase 4; an independent Java PoC was added later (2026-10-25, report 21).** | **CONFIRMED** (Phase 4 search); **POC ADDED LATER** |
| Does it contain any backend source for sejda.com? | **No.** | **CONFIRMED** |
| Is the local prototype's backend Java? | **No — it is a zero-dependency Node.js static server.** | **CONFIRMED** (`server.mjs`) |
| Is sejda.com's **web backend** Java? | **Not established.** The official Sejda **SDK/PDF engine** is Java; the web/API/auth/data layer is not in that repository. | **SDK: CONFIRMED; web backend: UNKNOWN** |
| Can the original Java source be recovered here? | The **SDK source is public**; the original **web backend** source is not available. | **SDK: AVAILABLE; web backend: UNAVAILABLE** |

The distinction matters:

- A **Java runtime is installed on the analysis host** (OpenJDK 23.0.1, `javac` 23.0.1). That is not evidence that any server uses Java.
- The local prototype has a **Node.js** server, confirmed by source.
- The remote Sejda web backend was never obtained. Its public responses do not identify a language or framework.
- The official `torakiki/sejda` repository is a **Java PDF SDK/library**, not the sejda.com web application. Review: `19-official-sejda-sdk-review.md`.

## 2. Workspace search

**Scope:** the pre-PoC `D:\small_editor` tree, including `node_modules`, excluding `reports/` and exported evidence bundles. The independent `reconstructed-backend/` PoC was added on 2026-10-25, after this search.

**Patterns searched:**

```
*.java
pom.xml
build.gradle / build.gradle.kts
settings.gradle / settings.gradle.kts
*.jar / *.war / *.ear
application.properties / application.yml / application.yaml
Dockerfile / docker-compose.yml / docker-compose.yaml
```

**Result:** **zero matches in that pre-PoC scope.** A re-run today would find the independent PoC’s five Java source files and three Apache PDFBox JARs under `reconstructed-backend/`; those are not Sejda artifacts.

Raw: `reports/_raw/java-artifact-search.txt` (header followed immediately by `END`).

Also absent from the captured application scope at that time:

- `src/main/java`, `src/main/resources`, `WEB-INF`, `META-INF` (the later PoC has only `src/main/java`)
- Spring Boot configuration, Security config, JPA entities/repositories, controllers
- Flyway/Liquibase migrations
- Maven wrapper (`mvnw`), Gradle wrapper (`gradlew`)
- JVM launch scripts, backend logs, heap dumps
- Backend CI/CD workflows

## 3. Local backend (CONFIRMED: Node.js)

From `server.mjs`:

```js
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
```

- No framework (no Express/Fastify/Nest).
- No database driver, ORM, session store, auth library, template engine.
- No API routes; only static files and a `/` → `/app/` redirect.
- GET/HEAD only; everything else 405.
- Default bind: `127.0.0.1:5173`.
- `package.json` has `pdfjs-dist` as the only runtime dependency; `pdf-lib` is a dev dependency for the fixture.

**Verdict:** this is a static file server for a client-side app, not an application backend.

## 4. Remote Sejda web backend (UNKNOWN; SDK Java confirmed separately)

### 4.1 Observed, non-identifying facts

| Observation | Evidence | What it does and does not prove |
|---|---|---|
| `Server: cloudflare` on HTML/JS/API responses | `art_d2e5a61d…`, `art_47c57f36…` | Edge is Cloudflare; origin is hidden |
| `POST /api/files/upload-check` → `{"status":"ok"}` | `art_47c57f36…` | A JSON API exists; no framework identity |
| `POST /api/files/upload` → `{"id":"<uuid>-<suffix>"}` | `art_47c57f36…` | File upload exists; no language identity |
| No `Set-Cookie` on upload | `art_47c57f36…` | Nothing about server language |
| Cookies `clientId`, `_s`, `lang`; **no `JSESSIONID`** | `art_47c57f36…` | Absence of a servlet-container cookie is a bounded negative, not proof |
| No `X-Powered-By`, `X-Application-Context` | `art_d2e5a61d…` | Headers may be stripped at the edge |
| Custom HTML 404; no Spring Whitelabel / Tomcat / Jetty page | `art_d2e5a61d…` | A Java stack could still serve a custom 404 |
| `robots.txt` disallows `/api/` | `art_3af5eb63…` | API surface exists; not language-specific |

### 4.2 Why the **web backend** Java claim is unverified

The public evidence is **compatible** with Java/Spring Boot, but also compatible with Node, Python, Go, .NET, Ruby, or a reverse proxy in front of any of them. Cloudflare normalizes/strips headers. A custom 404 and cookie choices are application decisions.

There is **no Java-specific fingerprint** in the captured responses or bundles:

- no `JSESSIONID`
- no `X-Powered-By`
- no `X-Application-Context`
- no Tomcat/Jetty banner
- no Spring `Whitelabel Error Page`
- no stack trace, class name, package name, or `.jsp`/`.do`/`.actuator` path

**Therefore:** “the sejda.com web backend is Java” remains **reported, unverified** (C-0057, U10). It should not be repeated as a confirmed fact.

### 4.3 Official Sejda SDK review — Java engine CONFIRMED

On 2026-10-24 the official repository <https://github.com/torakiki/sejda> was reviewed at commit `98712cdba40949763ba2718962e162025ccfd910` (version `5.1.27-SNAPSHOT`). It was shallow-cloned to an isolated temporary directory; no code was executed.

**Confirmed:**

- 583 `.java` files, 9 Maven modules, Java `release 17`, CI on JDK 17/21.
- README: “Sejda SDK is a task oriented PDF editor SDK library written in Java.”
- `CONTRIBUTING.md`: “The only official and maintained Sejda repository is https://github.com/torakiki/sejda/”.
- License: AGPLv3 for 2.x and higher; Apache 2.0 for 1.x.
- `sejda.default.xml` registers 20 task mappings across 16 implementations (merge, split, extract, rotate, metadata, labels, transitions, PDF-to-image, alternate mix, unpack, add back pages).

**Bounded negative in the reviewed commit:**

| Pattern in all `*.java` files | Matches |
|---|---:|
| `org.springframework` | 0 |
| `javax.servlet` / `jakarta.servlet` | 0 |
| `RestController` / `RequestMapping` / `@Controller` / `HttpServlet` | 0 |
| `upload-check` | 0 |
| `/api/files` / `/api/tasks` | 0 |
| `public static void main` | 0 |

There is no web/API module, no HTTP controller, no database/auth/queue code, and no sejda.com upload endpoint. The repository is a **library**, not the web backend. The open-source task set is also smaller than the 44-tool web UI; the README describes a commercial PRO SDK/console with additional tasks.

**Revised conclusion:** Sejda's **PDF engine/SDK** is Java — **CONFIRMED**. Sejda's **web backend** language/framework — **UNKNOWN**. The SDK is legitimate evidence for Java in the processing layer, not for the HTTP/API/auth/data layer.

Detailed: `19-official-sejda-sdk-review.md`.

## 5. Local JVM tooling is not the blocker

| Tool | State | Could it help if a JAR/WAR appeared? |
|---|---|---|
| `javap` (JDK 23) | available | Yes — class/method signatures, constants |
| `jar` (JDK 23) | available | Yes — archive inventory |
| Maven | not installed | Only for source builds |
| Gradle | not installed | Only for source builds |
| CFR | not installed | Yes — decompilation (requires approval) |
| Vineflower | not installed | Yes — decompilation (requires approval) |
| REA JEB provider | not configured | Yes — Java decompilation, if configured |
| Docker daemon | **not running** (`docker images`/`ps` failed) | Could inspect a supplied image if started |

The blocker is not tooling. The blocker is the **absence of any backend artifact**.

## 6. Prioritized missing evidence

| Priority | Item | What it would unlock |
|---|---|---|
| P0 | **Web backend** Git repository or source archive | Controllers, services, repositories, config, tests; full traceability. The public SDK is already reviewed and does not contain this layer. |
| P0 | Legitimate **web application** JAR/WAR/EAR from the owner | `jar tf`, manifest, embedded dependencies, `javap`/CFR/Vineflower decompilation |
| P1 | Docker image supplied by the owner | Layered filesystem, entrypoint, config, dependency versions |
| P1 | Database schema/migrations (Flyway/Liquibase/SQL dump) | Actual tables, keys, indexes, retention |
| P1 | Sanitized `application.yml/properties`, Security config | Framework, datasource, auth, storage, queue |
| P2 | Authorized backend logs / error traces | Runtime fingerprints (only with authorization) |
| P2 | API specification or integration tests | Exact request/response/validation contracts |
| P2 | Authenticated account session | Auth, authorization, task lifecycle (only with authorization) |

## 7. What would change the verdict

The **web backend** claim becomes **CONFIRMED** only with one of:

1. A web/API module or controller/service/repository source in an official backend repository.
2. A JAR/WAR/EAR whose classes/manifest identify a Java web stack and the observed endpoints.
3. An authorized response that leaks a Java/Spring-specific marker or stack trace tied to the web layer.
4. A container image/entrypoint that runs a JVM and serves the sejda.com API.

None exists in this workspace. The official SDK source is already reviewed (`19`) and confirms the **engine**, not the web layer.

## 8. Phase 4 conclusion

**The official Sejda SDK/PDF engine is Java — CONFIRMED. The sejda.com web backend is not established — UNKNOWN.** At the time of the Phase 4 inventory, the only backend present was a **Node.js** static server; a separate Java PoC was added later in `reconstructed-backend/` (report `21`), not derived from Sejda source.

Any Java web backend created next would be an **independent reconstruction**, not recovered Sejda web source. See `17-reconstruction-proposal.md` and `19-official-sejda-sdk-review.md`.
