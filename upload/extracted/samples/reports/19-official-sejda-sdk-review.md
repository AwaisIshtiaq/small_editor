# 19 — Official Sejda SDK review

**Phase:** 4C (external source review)
**Status:** **CONFIRMED — Sejda's official PDF SDK is Java.** **The sejda.com web backend remains UNVERIFIED.**
**Date:** 2026-10-24 UTC
**Repository:** <https://github.com/torakiki/sejda>
**Reviewed commit:** `98712cdba40949763ba2718962e162025ccfd910` (`master`, 2026-10-17)
**Project version:** `5.1.27-SNAPSHOT`

> **Update 2026-10-25:** the approved independent PoC now exists in `reconstructed-backend/` (report `21`). It uses Apache PDFBox, not this SDK, and was not added to `small_editor`. The SDK review below is unchanged.

---

## 1. The decision in one table

| Question | Answer | Confidence | Basis |
|---|---|---|---|
| Is the official Sejda repository Java? | **Yes.** | **CONFIRMED** | 583 `.java` files, Maven `release 17`, JDK 17/21 CI |
| Is it the **Sejda SDK**? | **Yes.** | **CONFIRMED** | README calls it “a task oriented PDF editor SDK library written in Java” |
| Is it the **sejda.com web backend**? | **No.** | **CONFIRMED** (bounded negative) | No web/API module, no Spring/servlet/controllers, no HTTP endpoints, no `main`, no DB/auth |
| Does it prove the sejda.com web service is Java? | **No.** | **UNKNOWN** | The HTTP/API/auth/DB/queue layer is not in this repository |
| Does it make Java the likely PDF engine for sejda.com? | **Yes.** | **STRONGLY INFERRED** | Same vendor, same PDF tasks, README links the SDK to the sejda.com web interface |
| Is this the complete implementation of the 44-tool web app? | **No.** | **CONFIRMED** (bounded negative) | Open-source registry has 20 task mappings / 16 implementations; PRO and other services are separate |

**Final wording:** *“Sejda's PDF engine/SDK is Java. The sejda.com web backend is still unverified.”*

Do **not** shorten that to “the backend is Java.” The repository reviewed here is a library, not a web application.

---

## 2. What was reviewed

The repository was shallow-cloned to an isolated temporary directory. No Maven build, test, or application code was executed. Inspection used Git metadata, file inventory, Maven POM parsing, XML parsing, and text search.

### 2.1 Repository identity

| Property | Value |
|---|---|
| Official URL | <https://github.com/torakiki/sejda> |
| Official statement | `CONTRIBUTING.md`: “The only official and maintained Sejda repository is https://github.com/torakiki/sejda/” |
| Default branch | `master` |
| Reviewed commit | `98712cdba40949763ba2718962e162025ccfd910` |
| Commit date | 2026-10-17 |
| Version | `5.1.27-SNAPSHOT` |
| Tracked files | 829 |
| Java files | 583 |
| Maven modules | 9 |
| License | **AGPLv3** for 2.x and higher; Apache 2.0 for 1.x |
| Build target | Java `release 17`; CI on JDK 17 and 21 |

### 2.2 Modules

| Module | Role (from source layout) |
|---|---|
| `sejda-model` | Task parameters, validation, model types |
| `sejda-core` | Task registry, execution service, context, configuration |
| `sejda-sambox` | Task implementations on SAMBox, the maintainers' PDFBox fork |
| `sejda-conversion` | Parameter/adapter conversion, not Office-format conversion |
| `sejda-fonts` | Font resources |
| `sejda-image-writers` | Image output support |
| `sejda-distribution` | Packaging |
| `sejda-docs` | Documentation and IDE/checkstyle resources |
| `sejda-tests` | Test fixtures and helpers |

There is **no** `sejda-web`, `sejda-server`, `sejda-api`, or `sejda-console` module.

---

## 3. What the repository says about itself

From `README.md`:

> “Sejda SDK is a task oriented PDF editor SDK library written in Java.”

> “Sejda SDK open source — Is an open source Java library providing a set of PDF manipulation tasks”

> “Sejda SDK PRO — Is a commercial Java library built on top of the open source library and providing additional PDF manipulation tasks”

> “`sejda-console-pro` is a commercial command line tool that can be used directly from the terminal or from your own code.”

> “A web interface is available at https://sejda.com where the most commonly used tasks are available as online services”

> “Sejda SDK is the engine behind PDFsam Basic”

The README links the sejda.com web interface to the same task family, but it **does not** state that the web application, API, authentication, database, queue, or payment system is implemented in this repository. Those are separate concerns.

---

## 4. Structural findings

### 4.1 Java is confirmed

- 583 `.java` files under `src/main/java` and `src/test/java`.
- Root POM sets `<release>17</release>`.
- CI matrix: JDK 17 and 21 on Ubuntu, Windows, and macOS.
- Maven modules contain library code, not a web application.

### 4.2 No web backend is present

Bounded negative searches over **all** `*.java` files in the reviewed commit:

| Pattern | Matches |
|---|---:|
| `org.springframework` | 0 |
| `javax.servlet` | 0 |
| `jakarta.servlet` | 0 |
| `RestController` | 0 |
| `RequestMapping` | 0 |
| `@Controller` | 0 |
| `HttpServlet` | 0 |
| `upload-check` | 0 |
| `/api/files` | 0 |
| `/api/tasks` | 0 |
| `public static void main` | 0 |

Also absent: web/API modules, controllers, HTTP route definitions, database/JPA configuration, auth/session code, queue/worker configuration, and the observed sejda.com upload endpoints.

This is a **bounded negative for this commit**, not proof that sejda.com uses no Java. It proves that this repository is not the web backend.

### 4.3 Task coverage is a subset of the web UI

`sejda-core/src/main/resources/sejda.default.xml` registers **20 task mappings** across **16 implementation classes**:

| Task implementation | Parameter variant(s) |
|---|---|
| `RotateTask` | `RotateParameters` |
| `ViewerPreferencesTask` | `ViewerPreferencesParameters` |
| `AlternateMixTask` | `AlternateMixMultipleInputParameters` |
| `UnpackTask` | `UnpackParameters` |
| `MergeTask` | `MergeParameters` |
| `SplitByOutlineLevelTask` | `SplitByOutlineLevelParameters` |
| `SplitBySizeTask` | `SplitBySizeParameters` |
| `SplitByPageNumbersTask` | `SplitByPagesParameters`, `SplitByEveryXPagesParameters`, `SimpleSplitParameters` |
| `ExtractPagesTask` | `ExtractPagesParameters` |
| `ExtractByOutlineTask` | `ExtractByOutlineParameters` |
| `SetMetadataTask` | `SetMetadataParameters` |
| `SetPagesLabelTask` | `SetPagesLabelParameters` |
| `SetPagesTransitionTask` | `SetPagesTransitionParameters` |
| `PdfToSingleImageTask` | `PdfToSingleTiffParameters` |
| `PdfToMultipleImageTask` | `PdfToMultipleTiffParameters`, `PdfToJpegParameters`, `PdfToPngParameters` |
| `AddBackPagesTask` | `AddBackPagesParameters` |

The captured sejda.com UI exposes **44 tools**. The open-source SDK covers a meaningful subset (merge, split, extract, rotate, metadata, labels, transitions, PDF-to-image, alternate mix, unpack, add back pages). It does not contain an OCR module or an Office-conversion module, and the README says the PRO library adds tasks. Therefore this repository is not a complete implementation of the 44-tool web product.

---

## 5. What this changes in the dossier

| Previous statement | Revised statement |
|---|---|
| “Sejda backend is Java” — unverified | **Sejda SDK/PDF engine is Java — CONFIRMED.** **sejda.com web backend is UNKNOWN.** |
| “No Java artifact exists” | **No Sejda Java artifact** is in the workspace. The external official SDK is Java, but it is not the web backend and was not added to the workspace. A separate PoC now vendors Apache PDFBox, not the Sejda SDK. |
| “Phase 4B blocked” | Still true for the **web backend**. The **SDK source review** is now complete. |
| “Local backend is Node.js” | Unchanged and confirmed. |

The official SDK is legitimate evidence for Java in Sejda's PDF-processing layer. It is not evidence for the sejda.com HTTP/API/auth/data layer.

---

## 6. Licensing consequence

The repository is **AGPLv3** for 2.x and higher. AGPL is a strong network-copyleft license: if a modified version is offered as a network service, users may be entitled to the corresponding source. The README separately advertises a commercial **SDK PRO** and **console PRO**.

This is a product/legal decision, not a technical one. Before embedding this SDK in a hosted service, obtain legal review or a commercial license. Do not assume the AGPL code can be used in a closed hosted backend without obligations.

---

## 7. Final decision

1. **Do not claim “the sejda.com backend is Java” on the strength of this repository.** The repository is the Java **SDK**, not the web backend.
2. **Do claim “Sejda's PDF engine/SDK is Java.”** That is directly confirmed by the official repository.
3. **Do not add a Java backend to `small_editor` for this reason.** The local app is a client-side PDF reader with a Node static server. It needs no backend for its current features, and this SDK does not provide the reader UI or the web API.
4. **If a Sejda-like processing service is actually wanted**, treat it as a separate project: Java 17/21 + the SDK (or Apache PDFBox) for merge/split/extract/rotate/image output, with an explicit decision on AGPL vs commercial licensing. The approved PoC now exists in `reconstructed-backend/` and uses Apache PDFBox; the SDK is still not embedded.
5. **If the goal is only to verify sejda.com's web stack**, this repository does not settle it. A web/API artifact, a framework-leaking response, or an authorized container image would still be required.

**Bottom line:** this repository resolves the Java question for the **engine**, not for the **web backend**. The correct final description is:

> **Sejda's PDF SDK is Java (confirmed). The sejda.com web application/backend is not established (unknown).**

---

## 8. Reproducing the review

```bash
git clone --depth 1 https://github.com/torakiki/sejda.git
cd sejda
git rev-parse HEAD
git ls-files '*.java' | wc -l
python -c "import xml.etree.ElementTree as ET; ..."   # read Maven modules
rg -l -F 'org.springframework' --glob '*.java' .
rg -l -F 'RestController' --glob '*.java' .
rg -l -F 'upload-check' --glob '*.java' .
rg -l -F 'public static void main' --glob '*.java' .
cat sejda-core/src/main/resources/sejda.default.xml
```

No code from the repository was executed during this review.
