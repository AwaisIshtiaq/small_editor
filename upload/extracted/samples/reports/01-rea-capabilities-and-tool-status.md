# 01 — REA capabilities and tool status

**Phase:** 1 (REA and tool discovery)
**Date:** 2026-10-24 UTC
**Status:** **COMPLETE WITH LIMITATIONS**

## 1. Is REA installed and connected?

**CONFIRMED: yes for the MCP tools used here; the environment is not fully healthy.**

The `reverse-engineer-anything` skill is installed at:

```
C:\Users\Dell\.agents\skills\reverse-engineer-anything
```

`npx -y rea-agents@latest doctor` exits `1` and reports:

```text
healthy: false
environment_healthy: false
scope:
  mode: audit-wide
  clients: []
  providers: []
  skill: false
  target: null
```

The 22 scope checks include:

| Check | Result | Meaning |
|---|---|---|
| `node` | OK, 26.12.1 | JS runtime available |
| `host` | OK, win32 x64 | platform supported |
| `hopper` | missing analysis engine | native/macOS analysis unavailable |
| `ghidra` | missing; `GHIDRA_INSTALL_DIR` unset | native analysis unavailable |
| `ida-registration` | missing | IDA provider unavailable |
| `jadx` | missing; `REA_JADX_MCP_JAR` unset | Android/Dalvik path unavailable |
| `kuna-installation` | missing | Kuna engine unavailable |
| `skill:identity` | config drift: “Installed REA skill identity is stale” | skill copy is stale |
| `registration:*` (13 clients) | config drift | registrations need `rea setup` |

Raw output: `reports/_raw/rea-doctor.txt`.

**Interpretation:** the doctor failures are about **native analysis engines and client registration drift**, not about the browser/CDP and JavaScript tools used in this investigation. Those tools were callable and returned Evidence. A `rea setup` would write configuration and install/refresh engines; it was **not** run because the mission requires approval before consequential changes, and because no native or Java **bytecode** artifact exists in the workspace to analyze. The public SDK source was reviewed with ordinary source tools.

## 2. Tools actually used

| Tool | Call | Evidence | Result |
|---|---|---|---|
| `tools.rea.list_browser_targets` | CDP `http://127.0.0.1:9333`, origin `https://www.sejda.com` | `ev_1facc738445ba7ee685c7d81c637068bd264ba7f5c65493874f2b083ccbab3d1` | One attached-unknown page: title “Sejda helps with your PDF tasks”, URL `https://www.sejda.com/`, target `6893E7752CD7323050226931434A57B0`; Chrome 155.0.8059.85, protocol 1.3 |
| `tools.rea.capture_browser_scenario` | homepage/menu/search scenarios from the earlier investigation | `ev_4073c716…`, `ev_d6c5e8b7…`, `ev_f97b3cdb…` | Observed page/menu actions; capture completeness is explicitly `incomplete` because event sections were dropped |
| `tools.rea.analyze_javascript_application` | `D:/small_editor/app` (directory, inert parse) | `ev_6be7d1b6…` | 5 JavaScript files parsed, 2,925,971 text bytes, 436,677 AST nodes, 591 findings, **0 modules**, 0 parse failures; graph coverage explicitly incomplete |
| `tools.rea.export_evidence_bundle` | `D:/small_editor/reports/evidence/rea-session.bundle.json` | bundle | 83,274,977 bytes, 5 records, 0 unknowns |

The JavaScript analysis response exceeded the 10 MiB MCP stdio budget, so it was retained and exported rather than truncated. This is a transport limit, not a failed analysis.

## 3. Browser observation capability

**CONFIRMED working:**

- Loopback CDP discovery on `127.0.0.1:9333`.
- Exact-origin filtering (`allowed_origins`) so unrelated tabs are excluded.
- Page title/URL/target ID and browser version were returned.
- Earlier scenario captures exercised real DOM actions (open menu, attempt to fill `#searchTools`) and produced structured results.
- The target page remained open across turns; the investigation did **not** need to spawn a new browser for every probe.

## 4. Native / Java capability

| Capability | Status | Consequence |
|---|---|---|
| `open_binary` for PE/ELF/Mach-O/archives | tool exposed; native engines missing | cannot decompile native code |
| Hopper / Ghidra / IDA | not configured | no native disassembly |
| JADX | not configured | no Android/Dalvik analysis |
| JEB Java decompiler (`decompile_jeb_item`) | tool exposed; **no JEB provider configured** | cannot decompile Java even if a class/JAR existed |
| `javap` | available with JDK 23 | could inspect class signatures if a class file existed |
| CFR / Vineflower | **not installed / not verified** | would need approval to install |
| Maven / Gradle | not installed | no build-level analysis |

**Important:** the absence of these engines is **not** why the sejda.com web backend was not recovered. There is **no Java web-backend artifact** in the workspace (`00-environment-and-project-inventory.md` §3). The official Sejda **SDK** was later reviewed externally and is Java, but it is a library, not the web backend (`19-official-sejda-sdk-review.md`). Tool installation would not create the missing web layer.

## 5. Evidence integrity and limitations

- The exported bundle is deterministic and byte-stable per REA; it contains 5 records and 0 unknowns.
- `capture_browser_scenario` reports `completeness.status: "incomplete"` for the captures; missing sections include `events` (and `action` for the failed fill). Therefore the captures support “this action happened and these steps ran”, not a complete causal event graph.
- `analyze_javascript_application` parsed JavaScript as **inert text**. It did not execute the bundle. Static paths do not prove runtime execution.
- The JS analysis includes vendored pdf.js; its 591 findings are not all application logic. This dossier relies on the actual local source for local-app claims, and on the Sejda claims ledger for remote claims.

## 6. Phase 1 conclusion

REA is **operational for browser, runtime and static JavaScript evidence**, which is exactly what the available site artifacts require. It is **not operational for native/Java bytecode**, and no Java **web-backend** artifact exists. The official SDK source was reviewed with ordinary source tools instead. The correct next step is not “install more engines”; it is “obtain a web-backend artifact or build an independent implementation”.
