# Small Editor

A premium PDF tool hub (landing page, navigation, all tool cards, guides, footer) that follows
the structure and services of sejda.com with an original design: own name, logo, palette,
background and motion.

## Quick start
Open `index.html` in any modern browser. There is no build step. Internet is only needed for Google Fonts
(falls back to system fonts offline).

## What is inside
```
small-editor/
├── index.html            the whole site (HTML + CSS + JS, animations embedded)  <- current: dark grey + orange
├── assets/
│   ├── logo.svg          Small Editor logo
│   ├── web.webp          Remotion render – cloud/server loop
│   └── desktop.webp      Remotion render – monitor loop
├── remotion/             Remotion project that produces the two WebP animations
├── themes/               earlier colour versions of the full page
│   ├── violet-amber.html
│   ├── yellow-silver.html
│   └── indigo-steel.html
├── docs/DESIGN.md        palette, type, page order, services, motion, history
└── skills/high-end-visual-design/   design skill used for the visual direction
```

## Change the colours
All colours are CSS variables at the very top of the `<style>` in `index.html`
(`--bg --bg2 --card --tx --mu --hair --v --a --bgi`). Two blocks exist: dark (default) and light
(`prefers-color-scheme: light` and `data-theme="light"`).
Also update: the logo gradient stops (`<linearGradient id="mgd">` in the nav symbol), the hero mock
colours, the category hue (`const COL=Array(10).fill(20)` and the numbers in `Gs=[...]`, hue 20 = orange),
the wave backgrounds (`%23FF5A09`, `%23ec7f37`), and re-render the Remotion animations in the new colours.

## Rename the brand
Search `index.html` for "Small Editor" and `smalleditor.app` (title, nav, footer, Web/Desktop cards).

## Re-render the animations
See `remotion/README.md`.

## Current limits
- Tool cards are UI only; clicking does nothing and no PDF is processed.
- Rating (4.5 / 1,874 reviews), "30+ tools" and the reviews count are placeholder content copied from the reference – replace with your own.
- Language list and footer links are placeholders.
- Light theme is automatic from the system setting; there is no on-page toggle.

## Suggested next steps
1. Make the PDF Editor real (pdf.js for rendering, pdf-lib for editing) running in the browser.
2. Wire client-side tools: merge, split, delete pages, rotate, extract pages, crop, page numbers, watermark, image to PDF, PDF to JPG.
3. Add a theme toggle and command-palette search.
4. Server tools (OCR, PDF to Word/Excel, repair) need a backend.

Design is inspired by the structure of sejda.com; no Sejda code, logo or illustrations are included.
