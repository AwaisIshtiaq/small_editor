// Generates samples/sample.pdf — a deterministic 4-page document used for demos and tests.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  {
    title: "Small Editor — sample document",
    lines: [
      "The quick brown fox jumps over the lazy dog.",
      "Search is a first-class feature in this editor.",
      "Find the word merge on this page: merge.",
      "Merge PDF files without leaving the browser.",
      "",
      "Match case matters: Merge is not merge.",
    ],
  },
  {
    title: "Chapter 2 — Repeating text",
    lines: [
      "merge merge merge appears three times here.",
      "SEARCH is uppercase; search is lowercase.",
      "A second page keeps the find counter honest.",
      "Whole word matching should not match searcher.",
      "",
      "The lazy dog sleeps while the fox runs.",
    ],
  },
  {
    title: "Chapter 3 — Mixed content",
    lines: [
      "Numbers: 1, 2, 3, 42, 100.",
      "Punctuation: (parentheses), [brackets], {braces}.",
      "Unicode: café, naïve, Zürich, résumé.",
      "Hyphenated words: state-of-the-art, e-mail.",
      "",
      "End of page three.",
    ],
  },
  {
    title: "Chapter 4 — Last page",
    lines: [
      "Search once more to test wrap-around navigation.",
      "merge",
      "The quick brown fox returns for the finale.",
      "",
      "Thank you for reading.",
    ],
  },
];

const doc = await PDFDocument.create();
doc.setTitle("Small Editor sample");
doc.setAuthor("Small Editor");
doc.setSubject("Deterministic fixture for find/highlight demo");
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

for (const [index, pageSpec] of pages.entries()) {
  const page = doc.addPage([595.28, 841.89]); // A4
  page.drawText(pageSpec.title, { x: 60, y: 770, size: 20, font: bold, color: rgb(0.1, 0.1, 0.15) });
  page.drawText(`Page ${index + 1} of ${pages.length}`, { x: 60, y: 745, size: 10, font, color: rgb(0.45, 0.45, 0.5) });
  let y = 700;
  for (const line of pageSpec.lines) {
    if (line) page.drawText(line, { x: 60, y, size: 13, font, color: rgb(0.15, 0.15, 0.2) });
    y -= 32;
  }
}

const bytes = await doc.save();
await mkdir(resolve(root, "samples"), { recursive: true });
await writeFile(resolve(root, "samples", "sample.pdf"), bytes);
console.log(`samples/sample.pdf written (${bytes.length} bytes)`);
