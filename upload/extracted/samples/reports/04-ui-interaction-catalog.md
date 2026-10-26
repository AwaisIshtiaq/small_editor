# 04 — UI interaction catalog

**Phase:** 2 (interaction analysis)
**Status:** **COMPLETE for the local prototype; OBSERVED SUBSET for sejda.com**

## 1. Local `small_editor`

### 1.1 Interaction table

| # | Trigger | Behaviour | State/effect | Network |
|---|---|---|---|---|
| 1 | Click **Open PDF** / drop a file / `#dropOpenBtn` | Accepts `.pdf` or `application/pdf`; reads `File.arrayBuffer()` | Loads pdf.js document, resets viewer | none |
| 2 | Click **Try the sample PDF** / `#sample` hash | `fetch("../../samples/sample.pdf")` | Loads 4-page fixture | GET sample only |
| 3 | `Ctrl K` / click **All tools** | Opens modal palette; focuses `#toolSearch`; `aria-expanded=true` | `state.paletteOpen=true` | none |
| 4 | Type in `#toolSearch` | Trims query; case-insensitive substring over title + description + category + keywords | Every row stays; non-matches get `.is-dim` (`opacity:.1`) | none |
| 5 | Empty/whitespace query | Clears dim classes | All 20 rows full opacity | none |
| 6 | First live result below fold | Scrolls it into view without reordering | Scroll position only | none |
| 7 | `Enter` in palette | Runs first non-dimmed command, closes palette | Command side effect | depends on command |
| 8 | `Tab` / `Shift Tab` | Cycles palette controls; focus is trapped | Focus only | none |
| 9 | Click pin button | Toggles pin; writes `smallEditor.pinnedTools`; moves chip | Pins/recents state | none |
| 10 | Click recent chip | Runs command, records recent (cap 12) | localStorage | none |
| 11 | `Ctrl F` / `/` / **Find** | Opens find bar; focuses `#findInput` | `state.query` reset/kept | none |
| 12 | Type in `#findInput` | Debounced **90 ms** occurrence search over all indexed pages | `state.matches`, `state.index`; all hits painted | none |
| 13 | `Enter` / **Next** | `stepIndex(+1)`; wraps after last | Current hit moves; scrolls only if outside comfortable band | none |
| 14 | `Shift Enter` / **Previous** | `stepIndex(-1)`; wraps at start | Current hit moves | none |
| 15 | **Aa** | Toggles match case; re-runs search | `state.matchCase` | none |
| 16 | **ab|** | Toggles whole-word boundary; re-runs search | `state.wholeWord` | none |
| 17 | Toggle dim (command) | Non-current hits dimmed at 10% or full strength | `smallEditor.dimMatches` | none |
| 18 | Zoom in/out / fit width | Re-renders pages at new scale | `state.scale`, `state.fit` | none |
| 19 | First/last page | Scrolls viewer to page | scroll only | none |
| 20 | Export text | Builds a `.txt` Blob and downloads it | `URL.createObjectURL` + revoke | none |
| 21 | Copy page text | `navigator.clipboard.writeText` | clipboard | none |
| 22 | Toggle theme | Switches `data-theme`; persists | `smallEditor.theme` | none |
| 23 | Print | `window.print()` | browser dialog | none |
| 24 | Shortcuts/About | Opens static `<dialog>` | static HTML | none |
| 25 | `Esc` | Closes palette first, then find | focus restore | none |

### 1.2 Verified runtime results

From `reports/_raw/browser-check.txt` (14/14 passed):

| Check | Result |
|---|---|
| Sample loads | `sample.pdf`, 4 pages, 4 indexed, 0 errors |
| Find “merge” | `1 / 9`; 9 hits; 1 current; pages 1,2,4 |
| Navigation wrap | after 9 nexts: `1 / 9` |
| Match case | 7 matches, `aria-pressed=true` |
| Whole word + phrase | “quick” 2 matches; “quick brown” 2 matches |
| Palette “zoom” | 20 rows, 17 dimmed, dim opacity `0.1`, first live result scrolled into view |
| Pin | localStorage first id `zoom-in`; chip “Zoom in”; pressed true |
| Escape | palette closes, then find closes |
| Console | no errors/exceptions |

### 1.3 Local search semantics (CONFIRMED from source)

**Tool palette**

```js
// app/js/core.js (paraphrased control flow)
const hay = `${tool.title} ${tool.description} ${tool.category} ${tool.keywords.join(" ")}`.toLowerCase();
return hay.includes(query.trim().toLowerCase());
```

- No ranking, no result count, no removal, no network.
- Deliberate difference from Sejda: query is trimmed before matching. Sejda's blank check trims but `indexOf` does not, so a leading space matches nothing there.
- Deliberate addition: scroll first live result into view.

**Document find**

- Default case-insensitive; optional Match case; optional whole-word boundary.
- Counts **every occurrence**, not lines. Sejda's editor counts matching lines.
- Paints every hit; one `.current`; navigation wraps.
- `MAX_HIGHLIGHTS = 1500` to bound DOM cost.

## 2. Captured sejda.com

### 2.1 Tool search interaction

| Step | Observed |
|---|---|
| Open menu | Click `a.more-tasks`; panel opens in ~75 ms; 49 anchors, 12 rows, 11 groups, 6 columns |
| Focus search | `#searchTools` exists (`type=search`, placeholder “Type to search”) but is inside a wrapper with inline `display:none` in the captured render |
| Fill via Playwright | REA fill timed out after 8 s; element is not considered fillable (C-0008) |
| Intervention | Probe forced the hidden input visible; dispatched `keyup` events as the shipped handler expects |
| “merge” | 2 anchors un-dimmed: the Recent clone + the main Merge entry |
| “pdf” / “PDF” | 37 each (case-insensitive) |
| “delete” | 1 |
| “image” | 9 |
| “sign” | 3 |
| “xyzzy” | 0 |
| Two spaces | all 49 un-dimmed (trim reset branch) |
| Non-match style | `.search-not-matching` → `opacity:.1`; links remain in place and clickable |
| Network | **none** in the handler; no count, no ranking, no empty state |

Source-level handler (derived): binds `keyup`, lowercases with `toLowerCase`, tests `indexOf` against rendered text and `title`/`data-original-title`; adds the class to all anchors then removes it from matches. See `art_17dea15b…` and `claims.csv` C-0009–C-0014.

### 2.2 Recents/pins interaction

| Action | Derived behaviour |
|---|---|
| Run a tool | `Sejda.RememberedTools("prevUsedTools").add(id)`; dedupe, move to front, cap 12 |
| Pin | Removes id from recents, adds to `pinnedTools` |
| Unpin | Re-adds id to front of recents |
| Strip composition | pins → recents → five defaults; dedupe; cap 13 |
| Defaults | `compress-pdf`, `pdf-editor`, `extract-pdf-pages`, `merge-pdf`, `crop-pdf` |
| Persistence | `localStorage` under `prevUsedTools` / `pinnedTools` |

### 2.3 Editor Find & Replace interaction

| Action | Observed |
|---|---|
| Open | Load a PDF → toolbar text group caret → “Find & Replace” |
| Query “merge” (case off) | `Found 3 matches on page 1`; fixture page 1 has 5 occurrences on 3 lines |
| Query “merge” (case on) | `Found 2 matches on page 1` |
| Query “Merge” (case off/on) | 3 / 2 |
| Page 2 “merge merge merge” | `Found 1 match on page 2` — line-level, not occurrence-level |
| Cycling | Page order, wraps to page 1 after last |
| Highlight | One `.find-replace-highlight` spanning the matched line |
| Replace | `Replaced match 1 on page 1`; rewrites **every occurrence in that line** |
| Include links | Present, default checked; fixture had no links, so effect unknown |
| Empty/regex queries | Probe caused a 120 s unresponsive page; cause unknown (U3) |

### 2.4 API calls triggered by UI

| UI action | API |
|---|---|
| Tool search | **none** |
| Recents/pins | none (localStorage) |
| Upload a PDF | `POST /api/files/upload-check`, then `POST /api/files/upload` |
| Password-protected file | `POST /api/files/{id}/password` (client reference) |
| Delete task | `DELETE /api/tasks/{id}` (client reference) |
| Find & Replace | **none observed**; runs in the editor |

## 3. Interaction differences (deliberate)

| Area | Sejda | Local rebuild |
|---|---|---|
| Tool search result | Dim to 10%, no reorder | Same, plus trim and scroll-first-into-view |
| Document find | Line-level count, one line highlight | Occurrence-level, all hits, one current |
| Replace | Implemented, replaces all in line | **Not implemented** (reader only, documented) |
| Upload | Server upload endpoints | Local file read only |
| Accounts | Login/account surfaces exist | None |
| Recents/pins | localStorage, 12/13 caps | Same idea, own keys and 20 commands |

## 4. Evidence

- Local source: `app/js/app.js` (`406b8c85…`), `app/js/core.js` (`291d7453…`), `app/index.html` (`d585e479…`).
- Runtime: `reports/_raw/browser-check.txt` (14/14), `reports/_raw/local-headers.txt`.
- Sejda: `ev_4073c716…`, `ev_d6c5e8b7…`, `ev_f97b3cdb…`, `art_9d3944df…`, `art_8a99c539…`, `art_068373d6…`, `art_b0a086ba…`.
- Claims: `site-re/sites/sejda-com/claims.csv` C-0002–C-0030.
