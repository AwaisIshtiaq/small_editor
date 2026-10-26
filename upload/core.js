/**
 * Small Editor — search core.
 *
 * Pure functions only: no DOM, no pdf.js. Everything the UI needs to decide
 * *what matches* and *where it is* lives here, so it can be unit tested and
 * reused from a worker.
 *
 * Two search surfaces, modelled on Sejda.com's observed behaviour:
 *   1. Tool search  — incremental, case-insensitive substring filter that dims
 *      non-matching entries to 10% opacity instead of hiding them.
 *   2. Document find — case-insensitive by default, optional match case,
 *      whole-word and occurrence navigation, with per-line geometry so the
 *      viewer can draw highlight boxes.
 */

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

export const DIM_OPACITY = 0.1; // observed on sejda.com: .search-not-matching

/** Lowercase without locale surprises (Sejda uses plain String#toLowerCase). */
export function fold(value) {
  return String(value ?? "").toLowerCase();
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

export function isWordChar(ch) {
  return typeof ch === "string" && ch.length > 0 && WORD_CHAR.test(ch);
}

/* ------------------------------------------------------------------ */
/* Tool search                                                         */
/* ------------------------------------------------------------------ */

/**
 * Build the haystack for one tool. Sejda matches against the link's rendered
 * text (caption + description) and its tooltip title; we add explicit
 * keywords and category so "redact" can find "Remove annotations".
 */
export function toolHaystack(tool) {
  return fold(
    [
      tool.title,
      tool.description,
      tool.category,
      ...(tool.keywords ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Sejda-compatible incremental filter.
 *
 * - empty (or whitespace-only) query -> everything matches
 * - otherwise a case-insensitive substring test
 * - non-matches are returned, not removed: the UI dims them
 *
 * @returns {{tool: object, matching: boolean}[]} same order as `tools`
 */
export function filterTools(tools, query) {
  const needle = fold(query).trim();
  return tools.map((tool) => ({
    tool,
    matching: needle.length === 0 || toolHaystack(tool).includes(needle),
  }));
}

export function matchingTools(tools, query) {
  return filterTools(tools, query)
    .filter((row) => row.matching)
    .map((row) => row.tool);
}

/* ------------------------------------------------------------------ */
/* Recents + pins (Sejda's RememberedTools)                            */
/* ------------------------------------------------------------------ */

export const RECENT_LIMIT = 12;
export const PALETTE_LIMIT = 13;

/** Move `id` to the front of a recents list, de-duplicated and bounded. */
export function pushRecent(recent, id, limit = RECENT_LIMIT) {
  if (!id) return recent.slice(0, limit);
  return [id, ...recent.filter((item) => item !== id)].slice(0, limit);
}

/**
 * Toggle a pin. Pinning removes the id from recents; unpinning re-adds it to
 * the front of recents — the same bookkeeping Sejda performs.
 */
export function togglePin({ pinned, recent }, id) {
  if (!id) return { pinned, recent };
  if (pinned.includes(id)) {
    return {
      pinned: pinned.filter((item) => item !== id),
      recent: pushRecent(recent, id),
    };
  }
  return {
    pinned: [id, ...pinned.filter((item) => item !== id)],
    recent: recent.filter((item) => item !== id),
  };
}

/**
 * Compose the palette's "Recent / pinned" strip: pins, then recents, then
 * defaults, de-duplicated, capped at 13 entries.
 */
export function paletteEntries({ pinned = [], recent = [], defaults = [], limit = PALETTE_LIMIT }) {
  const merged = [...pinned, ...recent, ...defaults];
  const seen = new Set();
  const out = [];
  for (const id of merged) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === limit) break;
  }
  return out;
}

/** Order a tool list by an id list, dropping unknown ids. */
export function orderByIds(ids, tools) {
  const byId = new Map(tools.map((tool) => [tool.id, tool]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Document text model                                                 */
/* ------------------------------------------------------------------ */

/**
 * Group raw pdf.js text items into visual lines.
 *
 * A line stores:
 *   text      concatenated string (single space inserted for visual gaps)
 *   segments  [{ start, end, x, baselineY, width, size }] mapping character
 *             offsets back to positioned glyph runs, so a match can be drawn.
 *
 * Items are expected in pdf.js `getTextContent()` shape:
 *   { str, transform: [a,b,c,d,e,f], width, height }
 *
 * Rotated/skewed runs are kept but their geometry is approximate; the caller
 * receives `approximate: true` on those segments.
 */
export function buildLines(items) {
  const usable = (items ?? []).filter((item) => item && typeof item.str === "string" && item.str.length > 0);
  const sorted = [...usable].sort((a, b) => {
    const ay = a.transform?.[5] ?? 0;
    const by = b.transform?.[5] ?? 0;
    if (Math.abs(ay - by) > 0.01) return by - ay;
    return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });

  const lines = [];
  let current = null;

  for (const item of sorted) {
    const [a, b, c, d, e, f] = item.transform ?? [1, 0, 0, 1, 0, 0];
    const size = Math.hypot(c, d) || Math.abs(d) || item.height || 10;
    const width = Number.isFinite(item.width) ? item.width : 0;
    const x = e;
    const y = f;
    const rotated = Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3;

    const sameLine =
      current &&
      Math.abs(current.baselineY - y) <= Math.max(1.5, size * 0.35) &&
      x >= current.endX - Math.max(1.5, size * 0.35) &&
      x <= current.endX + size * 30;

    if (!sameLine) {
      current = {
        text: "",
        baselineY: y,
        size,
        startX: x,
        endX: x + width,
        segments: [],
        approximate: false,
      };
      lines.push(current);
    } else {
      const gap = x - current.endX;
      if (current.text.length > 0 && gap > size * 0.18) current.text += " ";
    }

    const start = current.text.length;
    current.text += item.str;
    const end = current.text.length;

    current.segments.push({
      start,
      end,
      x,
      baselineY: y,
      width,
      size,
      approximate: rotated,
    });
    current.approximate = current.approximate || rotated;
    current.endX = Math.max(current.endX, x + width);
    current.size = Math.max(current.size, size);
    current.endY = Math.min(current.baselineY, y);
  }

  return lines;
}

/** One page = its lines plus the page height (PDF units) for coordinate flips. */
export function buildPageModel(pageNumber, items, pageHeight, pageWidth) {
  return { pageNumber, pageHeight, pageWidth, lines: buildLines(items) };
}

/* ------------------------------------------------------------------ */
/* Document search                                                     */
/* ------------------------------------------------------------------ */

/**
 * Find occurrences of `query` inside a page model.
 *
 * Returns matches in reading order with absolute character offsets and the
 * rectangles (PDF coordinate space) needed to paint them.
 *
 * @param {object} pageModel
 * @param {string} query
 * @param {{matchCase?: boolean, wholeWord?: boolean}} options
 */
export function findInPage(pageModel, query, options = {}) {
  const { matchCase = false, wholeWord = false } = options;
  const raw = String(query ?? "");
  if (!raw.length) return [];

  const needle = matchCase ? raw : fold(raw);
  const matches = [];

  for (const line of pageModel.lines) {
    const hay = matchCase ? line.text : fold(line.text);
    let from = 0;
    for (;;) {
      const index = hay.indexOf(needle, from);
      if (index < 0) break;
      const end = index + raw.length;
      const before = index > 0 ? line.text[index - 1] : "";
      const after = end < line.text.length ? line.text[end] : "";
      if (!wholeWord || (!isWordChar(before) && !isWordChar(after))) {
        matches.push({
          pageNumber: pageModel.pageNumber,
          start: index,
          end,
          text: line.text.slice(index, end),
          line,
          rects: geometryForRange(line, index, end),
        });
      }
      from = index + Math.max(1, needle.length);
    }
  }

  return matches;
}

/**
 * Search every page model. Result order is page order, then reading order
 * inside the page (lines were built top-to-bottom).
 */
export function findInDocument(pageModels, query, options = {}) {
  return pageModels.flatMap((page) => findInPage(page, query, options));
}

/** Map a [start,end) character range inside a line to positioned rectangles. */
export function geometryForRange(line, start, end) {
  const rects = [];
  for (const segment of line.segments) {
    const overlapStart = Math.max(start, segment.start);
    const overlapEnd = Math.min(end, segment.end);
    if (overlapEnd <= overlapStart) continue;

    const length = segment.end - segment.start || 1;
    const fx = (overlapStart - segment.start) / length;
    const fw = (overlapEnd - overlapStart) / length;
    rects.push({
      x: segment.x + segment.width * fx,
      baselineY: segment.baselineY,
      width: Math.max(0.6, segment.width * fw),
      size: segment.size,
      approximate: segment.approximate,
    });
  }
  return rects;
}

/**
 * Convert a PDF-space rect to CSS coordinates for a page rendered at `scale`.
 * PDF space has its origin bottom-left; CSS has it top-left.
 */
export function rectToCss(rect, pageHeight, scale) {
  const height = rect.size * 0.92;
  return {
    left: rect.x * scale,
    top: (pageHeight - rect.baselineY - rect.size * 0.8) * scale,
    width: rect.width * scale,
    height: Math.max(2, height * scale),
  };
}

/* ------------------------------------------------------------------ */
/* Navigation + counts                                                 */
/* ------------------------------------------------------------------ */

/** Wrap-around next/previous index. Returns -1 for an empty set. */
export function stepIndex(current, total, direction = 1) {
  if (total <= 0) return -1;
  if (current < 0) return direction >= 0 ? 0 : total - 1;
  return (current + direction + total) % total;
}

/**
 * "Found 3 matches on page 2" phrasing, with page-scoped counts like Sejda.
 * When `matches` span several pages the label also mentions the range.
 */
export function describeMatches(matches, index) {
  if (!matches || matches.length === 0) return "No matches";
  const current = matches[Math.max(0, Math.min(index, matches.length - 1))];
  const onPage = matches.filter((match) => match.pageNumber === current.pageNumber).length;
  const pageLabel = `page ${current.pageNumber}`;
  const prefix = `${index + 1} of ${matches.length}`;
  return `${prefix} · ${onPage} on ${pageLabel}`;
}

/** Group matches by page (used for per-page counts and minimap ticks). */
export function countByPage(matches) {
  const counts = new Map();
  for (const match of matches) {
    counts.set(match.pageNumber, (counts.get(match.pageNumber) ?? 0) + 1);
  }
  return counts;
}
