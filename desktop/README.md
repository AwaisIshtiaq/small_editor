# Small Editor Desktop

Electron shell around the same engine that powers the web app. The packaged
app bundles the Next.js standalone server, spawns it on `127.0.0.1:3847`, and
renders it in a sandboxed window. Files are processed locally and expire from
the temp store after ~2h.

## Dev run

```bash
# from the repo root — build the standalone server first
bun run build
cd desktop && npm install && npm start
```

## Produce installers

```bash
cd desktop && npm run dist
# Linux: AppImage + deb    Windows: NSIS .exe    macOS: .dmg
```

`electron-builder` copies `.next/standalone`, `.next/static` and `public/`
into the package via `extraResources`. OCR (Tesseract) and Office
(LibreOffice) conversions rely on system binaries on Linux builds — install
`tesseract-ocr` and `libreoffice` on target systems, or point
`SMALL_EDITOR_*` env vars at bundled binaries.
