# 00 — Environment and project inventory

**Phase:** 0 (environment discovery)
**Date:** 2026-10-24 UTC
**Workspace:** `D:\small_editor`
**Status:** **COMPLETE**

## 1. Host and toolchain

| Item | Value | How established |
|---|---|---|
| OS | Windows 10.0.26300, AMD64 | `platform.platform()` / `platform.machine()` |
| Shell used | Git Bash (`bash`) on Windows | command execution |
| Working directory | `D:\small_editor` | `pwd` |
| Disk (D:) | 419.4 GB total, 348.4 GB free | `shutil.disk_usage('D:/')` |
| Python | 3.11.9 | `sys.version` |
| Node.js | 26.12.1 | `node --version` |
| npm | 11.21.0 | `npm --version` |
| Java runtime | OpenJDK **23.0.1** (`java version "23.0.1" 2024-10-15`) | `java -version` |
| Java compiler | `javac 23.0.1` | `javac -version` |
| Maven | **not installed** (`mvn` not recognized) | `mvn -v` |
| Gradle | **not installed** (`gradle` not recognized) | `gradle -v` |
| Git | 2.47.0.windows.2 | `git --version` |
| Git repository | **none** (`fatal: not a git repository`) | `git rev-parse --is-inside-work-tree` |
| Docker | 29.8.2, build 7fc2dff | `docker --version` |
| OpenCode | v2.0.24 | `opencode --version` |
| Chrome used for captures | Chrome 155.0.8059.85, headless via CDP | REA `ev_1facc738…` |

Raw record: `reports/_raw/environment.json`.

> Java is installed **on the analysis host**. That says nothing about any server runtime. It only means a JAR/WAR could be inspected here if one existed.

## 2. What the workspace contains

```
D:\small_editor\
  app\                     complete local frontend (HTML/CSS/ES modules)
    index.html
    css\app.css
    js\app.js
    js\core.js
    js\tools-data.js
    vendor\pdfjs\          pdf.js 4.10.38 + worker + cmaps + fonts
  samples\sample.pdf       deterministic 4-page fixture
  scripts\                 fixture generator + 14-check browser harness
  test\core.test.mjs       16 unit tests
  server.mjs               zero-dependency Node static server
  package.json             pdfjs-dist dependency; pdf-lib dev dependency
  README.md                product/behaviour README
  site-re\                 reverse-engineering ledger for sejda.com
    sites\sejda-com\       claims, inventory, report, unknowns, raw, captures
    evidence\              exported REA bundles
  reports\                 this dossier (new; no application code changed)
```

### 2.1 Local application type

**CONFIRMED: frontend-only local prototype with a Node.js static file server.**

- `package.json` has no server framework, no database driver, no auth package, no test framework beyond `node:test`.
- `server.mjs` imports only `node:http`, `node:fs`, `node:path` and `node:url`.
- The PDF is parsed in the tab by pdf.js; there is no upload route.
- There is no `.env`, no database file, no migration directory, no container definition, no CI configuration.

### 2.2 Sejda capture type

**CONFIRMED: public-frontend capture, not an application source tree.**

- `site-re/sites/sejda-com/raw/` contains browser-fetched HTML, minified JS, CSS, screenshots and probe JSON.
- The editor bundle is obfuscated (394,992 bytes) and the shared bundle is minified (803,543 bytes).
- No source maps were found in the captured Sejda artifacts (`find … -iname '*.map'` returned nothing).
- No server source, JAR, WAR, class file, database schema or runtime log was obtained.

## 3. Java/backend artifact search

**Search scope:** all of `D:\small_editor`, including `node_modules`, excluding `reports/` and exported evidence bundles.

**Patterns:** `*.java`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `settings.gradle`, `settings.gradle.kts`, `*.jar`, `*.war`, `*.ear`, `application.properties`, `application.yml`, `application.yaml`, `Dockerfile`, `docker-compose.yml`, `docker-compose.yaml`.

**Result: zero matches.**

Raw record: `reports/_raw/java-artifact-search.txt`. The file contains the header and `END` with no paths between them.

This is the decisive Phase 4 finding: **there is no Java web-backend artifact in the workspace to decompile, inspect, or execute.** The JDK installation is not evidence of a Java backend. The official Sejda **SDK** was later reviewed as external public source; it is a Java library, not the web backend (`19-official-sejda-sdk-review.md`).

## 4. Changes made during Phase 0

- Created `reports/` and `reports/_raw/`.
- Exported the current REA session bundle to `reports/evidence/rea-session.bundle.json`.
- Ran read-only environment, file, header, unit-test and browser-check commands.
- **No application source, configuration, sample or build artifact was modified.**

## 5. Evidence

| Evidence | Supports |
|---|---|
| `reports/_raw/environment.json` | Host/toolchain values in §1 |
| `reports/_raw/java-artifact-search.txt` | Zero Java/backend artifacts in scope |
| `reports/_raw/local-source-hashes.json` | SHA-256 of the local source files |
| `reports/_raw/local-headers.txt` | Local server response headers |
| `reports/_raw/rea-doctor.txt` | REA environment health |
| `ev_6be7d1b6…` | REA parsed the local `app/` directory as an inert JS application graph |
| `site-re/sites/sejda-com/evidence-manifest.csv` | 40 manifest rows / 39 unique hashed Sejda artifacts |

## 6. Commands (reproducible core)

```bash
cd D:/small_editor
node --version && npm --version
java -version && javac -version
mvn -v; gradle -v; docker --version; git --version; opencode --version
npx -y rea-agents@latest doctor
find . -type f \( -iname '*.java' -o -iname 'pom.xml' -o -iname 'build.gradle*' \
  -o -iname '*.jar' -o -iname '*.war' -o -iname '*.ear' \) -not -path './reports/*'
npm test
node scripts/browser-check.mjs
```

## 7. Phase 0 conclusion

The workspace is **not** a Java application repository. It is a complete local JavaScript prototype plus a partial public-frontend capture of a remote site. Any Java **web-backend** analysis must wait for a JAR/WAR/EAR, backend source archive, container image, or authorized server artifact. The public Sejda SDK source has been reviewed separately and is not that web backend.
