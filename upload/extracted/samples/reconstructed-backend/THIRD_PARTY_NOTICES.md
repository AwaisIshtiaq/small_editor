# Third-party notices

This PoC vendors three unmodified jars in `lib/` for local build/run convenience.

| Component | Version | License | Source | SHA-256 |
|---|---|---|---|---|
| Apache PDFBox | 2.0.32 | Apache License 2.0 | <https://pdfbox.apache.org/> | `ac2c82df0dd5fccc91ca691f3a1845fb0b06c57f183d2f4701570c1d842c37d7` |
| Apache FontBox | 2.0.32 | Apache License 2.0 | <https://pdfbox.apache.org/> | `057983e9d4cabb9d649d286a5ae507a1d8e13b66744fd9432b3a0b3d04180fc3` |
| Apache Commons Logging | 1.2 | Apache License 2.0 | <https://commons.apache.org/proper/commons-logging/> | `daddea1ea0be0f56978ab3006b8ac92834afeefbd9b7e4e6316fca57df0fa636` |

The jars are unmodified. Their own `META-INF` license/notice files are retained
inside the archives. Apache License 2.0 text: <https://www.apache.org/licenses/LICENSE-2.0>.

The Sejda SDK is **not** included and is **not** used by this PoC. The observed
sejda.com HTTP contract is documented separately in
`../reports/20-bounded-rea-pass.md`; it is a behavioural reference, not a
dependency.
