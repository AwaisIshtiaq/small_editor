# 10 — Java source and bytecode analysis

**Phase:** 4B (Java analysis)
**Status:** **PARTIAL — official SDK source reviewed; sejda.com web backend BLOCKED**
**Date:** 2026-10-24 UTC; updated 2026-10-25 UTC

> **Update 2026-10-25:** an independent Java PoC now exists in
> `reconstructed-backend/` (5 Java source files, 3 Apache PDFBox jars). It is
> **not** Sejda source, not a web-backend artifact, and was added after this
> Phase 4 search. The zero-result statements below apply to the captured
> Sejda/application scope at the time of the search.

## 1. Result

There is **no Sejda Java source, class file, JAR, WAR, EAR, Maven build,
Gradle build, Spring configuration, or JVM log** in the captured scope. The
search is recorded in:

- `reports/_raw/java-artifact-search.txt` — zero matches for `*.java`, `pom.xml`, `build.gradle*`, `*.jar`, `*.war`, `*.ear`, `application.*`, `Dockerfile`, `docker-compose.*`.
- `reports/00-environment-and-project-inventory.md` §3.

**No decompilation was performed because there was nothing to decompile.** No Java findings are reported, because inventing them would violate the evidence rules.

### 1.1 External official SDK source review

The official public repository <https://github.com/torakiki/sejda> was reviewed at commit `98712cdba40949763ba2718962e162025ccfd910` (`5.1.27-SNAPSHOT`). It was shallow-cloned to an isolated temporary directory; no code was executed.

- **583 Java files**, 9 Maven modules, Java `release 17`, CI on JDK 17/21.
- README calls it “a task oriented PDF editor SDK library written in Java.”
- `sejda.default.xml` registers 20 task mappings across 16 implementations.
- **No web/API layer:** zero Spring/servlet/controller matches, zero HTTP endpoint matches, zero `public static void main`, no DB/auth/queue code, no `sejda-web`/`sejda-server`/`sejda-api` module.
- License: AGPLv3 for 2.x+; a commercial SDK PRO is separate.

This confirms the **PDF engine/SDK is Java**, not the sejda.com **web backend**. Detailed: `19-official-sejda-sdk-review.md`.

## 2. What was checked

| Check | Result |
|---|---|
| `*.java` anywhere in the pre-PoC workspace / Sejda captures | none; independent PoC added later under `reconstructed-backend/` |
| `pom.xml` / Maven wrapper | none |
| `build.gradle` / `settings.gradle` / Gradle wrapper | none |
| `*.class` / `*.jar` / `*.war` / `*.ear` in Sejda captures | none; independent PoC has PDFBox jars only |
| `src/main/java` / `WEB-INF` / `META-INF` | none |
| `application.properties` / `application.yml` / `application.yaml` | none |
| Spring Security / JPA / Hibernate config | none |
| Flyway / Liquibase migrations | none |
| Docker image / Compose file | none; Docker daemon not running |
| Backend logs / heap dumps / launch scripts | none |

`rg -n "JSESSIONID|X-Powered-By|X-Application-Context|Whitelabel|Tomcat|Jetty|Spring"` over the captured Sejda response records found **no** such markers. (The only “java” substring hits were `text/javascript` / `application/javascript` MIME types.)

## 3. Why the configured tools cannot change this

`npx -y rea-agents@latest doctor` reports missing Hopper, Ghidra, IDA, JADX and Kuna, and no JEB provider. Even if all were installed:

- `javap` can inspect a `.class` file — but there is no `.class` file.
- CFR/Vineflower can decompile a JAR — but there is no JAR.
- REA's `decompile_jeb_item` can decompile Java — but there is no class/method and no JEB provider.

Tool installation would only be justified **after** an artifact is supplied.

## 4. If a JAR/WAR/EAR is supplied

The analysis would proceed in an isolated directory, treating the artifact as untrusted:

1. **Identify provenance** — who supplied it, version, checksum, authorization.
2. **Inventory without executing** — `jar tf`, `unzip -l`, manifest, `META-INF/`, `WEB-INF/`, dependency JARs, class count, resource count.
3. **Separate application classes from third-party dependencies** — package prefixes, `BOOT-INF/lib`, `WEB-INF/lib`.
4. **Inspect metadata** — `META-INF/MANIFEST.MF`, `pom.properties`, `spring.factories`, `application.*` (sanitized), `logback*`, `web.xml` if present.
5. **Inspect bytecode** — `javap -p -c` for selected classes; identify controllers, services, repositories, entities, filters, schedulers.
6. **Decompile** — CFR or Vineflower into a separate output directory, preserving originals; record tool version and failures.
7. **Map features** — endpoint → controller → service → repository → entity; auth filters; file storage; task/queue; payments; external clients.
8. **Compare with observed contract** — reconcile `/api/files/upload-check`, `/api/files/upload`, `/api/files/{id}/password`, `/api/tasks/{id}`.
9. **Report gaps** — obfuscated/stripped code, missing resources, dynamic classloading, generated code.

### Caveats to state in any future report

- Decompiled code is **not original source**: comments, original variable names, formatting, and some build metadata are lost.
- Bytecode may be optimized/inlined; decompilers can fail on modern language features.
- A JAR can contain multiple applications or shaded dependencies; provenance matters.
- Static analysis does not prove runtime behavior; runtime claims require execution in an authorized environment.
- Do not execute an unknown JAR merely to inspect it.

## 5. If backend source is supplied

Read the actual source and produce:

- package/class inventory
- controllers and route mappings
- DTOs and validation
- services and transactions
- repositories/entities and schema
- security configuration and authorization rules
- exception handling
- scheduled/background work
- external clients (storage, queue, payments, email)
- configuration and profiles (secrets redacted)
- tests and build/packaging

## 6. Phase 4B conclusion

**The official Sejda SDK source review is complete: the PDF engine is Java.** The sejda.com **web backend** still has no source, bytecode, or container artifact in scope, so that part remains **BLOCKED**, not “complete”.

The next action is to obtain an authorized **web/API** artifact (repository, module, JAR/WAR/EAR, or image), or to approve an independent implementation. Using the public SDK for a new service requires an AGPLv3/commercial licensing decision.
