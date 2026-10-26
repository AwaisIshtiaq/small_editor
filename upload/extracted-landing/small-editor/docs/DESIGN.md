# Small Editor – design notes

## Current theme: Dark Grey + Orange
| Role | Dark theme | Light theme |
|---|---|---|
| Page background `--bg` | #232323 | #f6f2ee |
| Surface `--bg2` | #393939 | #ebe4de |
| Card `--card` | #2e2e2e | #ffffff |
| Text `--tx` | #f1ede9 | #393939 |
| Muted text `--mu` | #a69f98 | #6b645e |
| Highlight `--v` (Deep Orange) | #FF5A09 | #be4f0c |
| Second tone `--a` (Light Orange) | #ec7f37 | #d2661f |
| Burnt orange (logo end) | #be4f0c | – |
| Top gradient `--bgi` | grey fade | none |

Light theme follows the visitor's system setting (`prefers-color-scheme`).

## Type
Plus Jakarta Sans (UI) + Instrument Serif italic (accent words). Loaded from Google Fonts.

## Page order (follows sejda.com)
1. Floating glass navbar: logo, All Tools menu, Compress, Edit, Fill & Sign, Merge, Delete Pages, Crop | Pricing, Desktop, Log in, language globe
2. Hero with animated editing demo
3. Centered header: "We help with your PDF tasks" + "Edit a PDF document – it's free" + "or choose one of our 30+ PDF tools"
4. Most popular + one section per category (Merge, Split, Edit & Sign, Compress & Scans, Security, Convert from PDF, Convert to PDF, Others, Automate)
5. Rating (4.5, 1,874 Google reviews) with laurels
6. Works the way you work – Web and Desktop cards (Remotion animations)
7. How-To PDF Guides – nine guides, alternating tinted animated bands
8. Footer – Resources/API/Legal, all tools, 29 languages, contact

## Services (all present as cards)
Merge: Alternate & Mix, Merge, Visual Combine & Reorder, Organize
Split: Extract Pages, by pages / bookmarks / size / text, in half
Edit & Sign: PDF Editor, Fill & Sign, Create Forms, Delete Pages
Compress & Scans: Compress, Deskew, OCR
Security: Protect, Unlock, Watermark, Flatten
Convert from PDF: Excel, JPG, PowerPoint, Text, Word
Convert to PDF: HTML, JPG, Word
Others: Bates Numbering, Create Bookmarks, Crop, Edit Metadata, Extract Images, Flip, Grayscale,
Header & Footer, N-up, Page Numbers, Rename, Repair, Resize, Rotate, Remove annotations
Automate: Workflows

## Motion
- Hero demo: frame engine in `index.html` (30 fps clock, `interpolate()`, `spring()`, scenes), same model as Remotion
- Card illustrations: real Remotion renders (see `remotion/`)
- Guide bands: tint wipes in on scroll, hue/angle drift, morphing side shapes (frame-driven, paused when off-screen, off for reduced-motion)
- Scroll reveals: IntersectionObserver

## Design skill
`skills/high-end-visual-design` – glass double-bezel cards, pill buttons with nested arrow circle,
custom cubic-bezier(.32,.72,0,1) easing, floating nav.

## Experiment history
violet + amber -> yellow/silver/slate -> indigo steel -> dark grey + orange (current).
A green forest palette was tried and discarded. Earlier versions are in `themes/`.
