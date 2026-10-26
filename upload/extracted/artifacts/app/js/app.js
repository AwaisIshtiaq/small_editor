import * as pdfjs from "../vendor/pdfjs/pdf.mjs";
import {
  buildPageModel,
  filterTools,
  findInDocument,
  paletteEntries,
  pushRecent,
  rectToCss,
  stepIndex,
  togglePin,
} from "./core.js";
import { DEFAULT_PINNED, DEFAULT_RECENT, TOOLS, toolById } from "./tools-data.js";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.mjs", import.meta.url).href;

const MAX_HIGHLIGHTS = 1500;
const STORE_KEYS = {
  pinned: "smallEditor.pinnedTools",
  recent: "smallEditor.recentTools",
  theme: "smallEditor.theme",
  dim: "smallEditor.dimMatches",
};

const $ = (id) => document.getElementById(id);
const els = {
  toolsBtn: $("toolsBtn"),
  findBtn: $("findBtn"),
  openBtn: $("openBtn"),
  fileInput: $("fileInput"),
  dropzone: $("dropzone"),
  dropOpenBtn: $("dropOpenBtn"),
  sampleBtn: $("sampleBtn"),
  viewer: $("viewer"),
  pages: $("pages"),
  docName: $("docName"),
  docMeta: $("docMeta"),
  findBar: $("findBar"),
  findInput: $("findInput"),
  findCount: $("findCount"),
  findMeta: $("findMeta"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  caseBtn: $("caseBtn"),
  wordBtn: $("wordBtn"),
  closeFind: $("closeFind"),
  palette: $("palette"),
  toolSearch: $("toolSearch"),
  toolSearchClear: $("toolSearchClear"),
  recentStrip: $("recentStrip"),
  paletteBody: $("paletteBody"),
  suggestBtn: $("suggestBtn"),
  toast: $("toast"),
  infoDialog: $("infoDialog"),
  infoTitle: $("infoTitle"),
  infoBody: $("infoBody"),
};

const state = {
  pdf: null,
  fileName: "",
  fileSize: 0,
  pages: [],
  indexed: 0,
  scale: 1.2,
  fit: true,
  matches: [],
  index: -1,
  query: "",
  matchCase: false,
  wholeWord: false,
  dimMatches: true,
  paletteOpen: false,
  observer: null,
  searchTimer: 0,
  toastTimer: 0,
  loadToken: 0,
};

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — recents are a nice-to-have */
  }
}

let paletteState = {
  pinned: readJson(STORE_KEYS.pinned, DEFAULT_PINNED),
  recent: readJson(STORE_KEYS.recent, DEFAULT_RECENT),
};

function toast(message, ms = 2600) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, ms);
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  writeJson(STORE_KEYS.theme, theme);
}

applyTheme(readJson(STORE_KEYS.theme, "light"));
state.dimMatches = readJson(STORE_KEYS.dim, false);
document.body.classList.toggle("dim-matches", state.dimMatches);

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

const pinIcon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
    <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z" />
    <path d="M12 15v5" />
  </svg>`;

function buildToolRow(tool) {
  const row = document.createElement("div");
  row.className = "tool-row";
  row.dataset.toolId = tool.id;

  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "tool-hit";
  hit.dataset.command = tool.id;

  const title = document.createElement("span");
  title.className = "tool-title";
  title.textContent = tool.title;

  const desc = document.createElement("span");
  desc.className = "tool-desc";
  desc.textContent = tool.description;

  hit.append(title, desc);

  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = "pin-btn";
  pin.dataset.pin = tool.id;
  pin.setAttribute("aria-label", `Pin ${tool.title}`);
  pin.setAttribute("aria-pressed", String(paletteState.pinned.includes(tool.id)));
  pin.title = "Pin to Recent";
  pin.innerHTML = pinIcon;

  row.append(hit, pin);
  return row;
}

function renderPalette() {
  // Recent strip: pins, then recents, then defaults (Sejda's 13-slot strip).
  els.recentStrip.replaceChildren();
  const entries = paletteEntries({
    pinned: paletteState.pinned,
    recent: paletteState.recent,
    defaults: DEFAULT_PINNED,
  });

  for (const id of entries) {
    const tool = toolById(id);
    if (!tool) continue;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.command = id;
    chip.dataset.toolId = id;
    if (paletteState.pinned.includes(id)) {
      const dot = document.createElement("span");
      dot.className = "pin-dot";
      chip.append(dot);
    }
    chip.append(document.createTextNode(tool.title));
    els.recentStrip.append(chip);
  }

  // Grouped catalogue.
  els.paletteBody.replaceChildren();
  const groups = new Map();
  for (const tool of TOOLS) {
    if (!groups.has(tool.category)) groups.set(tool.category, []);
    groups.get(tool.category).push(tool);
  }

  for (const [category, tools] of groups) {
    const section = document.createElement("section");
    section.className = "palette-group";
    section.dataset.group = category;

    const heading = document.createElement("h3");
    heading.className = "palette-heading";
    heading.textContent = category;

    const items = document.createElement("div");
    items.className = "palette-items";
    for (const tool of tools) items.append(buildToolRow(tool));

    section.append(heading, items);
    els.paletteBody.append(section);
  }

  applyPaletteFilter();
}

function applyPaletteFilter() {
  const query = els.toolSearch.value;
  const rows = filterTools(TOOLS, query);
  const matching = new Set(rows.filter((row) => row.matching).map((row) => row.tool.id));

  for (const node of els.palette.querySelectorAll("[data-tool-id]")) {
    node.classList.toggle("is-dim", !matching.has(node.dataset.toolId));
  }

  // Keep group headings + order stable (like Sejda, they are never hidden).
  els.toolSearchClear.hidden = query.length === 0;

  // Small usability addition over Sejda: if the first live result is below
  // the fold, bring it into view without reordering the catalogue.
  if (query.trim()) {
    const firstMatch = els.palette.querySelector(".tool-row:not(.is-dim)");
    const scroller = els.palette.querySelector(".palette-scroll");
    if (firstMatch && scroller) {
      const rowRect = firstMatch.getBoundingClientRect();
      const boxRect = scroller.getBoundingClientRect();
      if (rowRect.bottom > boxRect.bottom) {
        scroller.scrollTop += rowRect.bottom - boxRect.bottom + 8;
      } else if (rowRect.top < boxRect.top) {
        scroller.scrollTop -= boxRect.top - rowRect.top + 8;
      }
    }
  }
}

function openPalette() {
  if (state.paletteOpen) return;
  state.paletteOpen = true;
  els.palette.hidden = false;
  els.toolsBtn.setAttribute("aria-expanded", "true");
  renderPalette();
  els.toolSearch.value = "";
  applyPaletteFilter();
  requestAnimationFrame(() => {
    els.toolSearch.focus();
    els.toolSearch.select();
  });
}

function closePalette({ restoreFocus = true } = {}) {
  if (!state.paletteOpen) return;
  state.paletteOpen = false;
  els.palette.hidden = true;
  els.toolsBtn.setAttribute("aria-expanded", "false");
  if (restoreFocus) els.toolsBtn.focus();
}

function togglePalette() {
  state.paletteOpen ? closePalette() : openPalette();
}

function rememberTool(id) {
  paletteState.recent = pushRecent(paletteState.recent, id);
  writeJson(STORE_KEYS.recent, paletteState.recent);
}

/* ------------------------------------------------------------------ */
/* Info dialog                                                         */
/* ------------------------------------------------------------------ */

const INFO = {
  shortcuts: {
    title: "Keyboard shortcuts",
    html: `
      <p>Everything works without the mouse, and nothing is sent over the network.</p>
      <table>
        <tr><td>Open / close tools</td><td><kbd>Ctrl</kbd> <kbd>K</kbd></td></tr>
        <tr><td>Find in document</td><td><kbd>Ctrl</kbd> <kbd>F</kbd></td></tr>
        <tr><td>Next / previous match</td><td><kbd>Enter</kbd> / <kbd>Shift</kbd> <kbd>Enter</kbd></td></tr>
        <tr><td>Close find or palette</td><td><kbd>Esc</kbd></td></tr>
        <tr><td>Run first palette result</td><td><kbd>Enter</kbd></td></tr>
        <tr><td>Move between palette results</td><td><kbd>Tab</kbd> / <kbd>Shift</kbd> <kbd>Tab</kbd></td></tr>
      </table>`,
  },
  about: {
    title: "About Small Editor",
    html: `
      <p><strong>Small Editor</strong> is a local-first PDF reader with two search surfaces:</p>
      <ul>
        <li><strong>Tool search</strong> — opens with <kbd>Ctrl K</kbd>. It filters commands by caption,
        description and keywords. Non-matching entries stay in place at 10% opacity, the same
        treatment Sejda.com applies in its “All Tools” panel.</li>
        <li><strong>Find in document</strong> — opens with <kbd>Ctrl F</kbd>. Matching is
        case-insensitive by default, counts every occurrence, highlights all hits and lets you
        cycle with wrap-around.</li>
      </ul>
      <p>The PDF is parsed by pdf.js in this tab. There is no upload endpoint, no account and
      no analytics.</p>
      <h3>Where the ideas came from</h3>
      <p>The interaction model was derived from the shipped sejda.com JavaScript (tool filter)
      and an observed Find &amp; Replace session in the Sejda editor. See
      <code>site-re/sites/sejda-com/</code> for the evidence ledger.</p>`,
  },
};

function showInfo(kind) {
  const entry = INFO[kind];
  if (!entry) return;
  els.infoTitle.textContent = entry.title;
  els.infoBody.innerHTML = entry.html;
  els.infoDialog.showModal();
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

const commands = {
  "open-file": () => els.fileInput.click(),
  "open-sample": () => loadSample(),
  find: () => openFind(),
  "find-next": () => moveMatch(1),
  "find-previous": () => moveMatch(-1),
  "match-case": () => toggleFindOption("matchCase"),
  "whole-word": () => toggleFindOption("wholeWord"),
  "clear-search": () => clearSearch({ close: true }),
  "download-text": () => downloadText(),
  "copy-text": () => copyPageText(),
  "zoom-in": () => setZoom(state.scale + 0.15, false),
  "zoom-out": () => setZoom(state.scale - 0.15, false),
  "fit-width": () => setZoom(fitScale(), true),
  "first-page": () => scrollToPage(0),
  "last-page": () => scrollToPage(state.pages.length - 1),
  "toggle-dim": () => {
    state.dimMatches = !state.dimMatches;
    document.body.classList.toggle("dim-matches", state.dimMatches);
    writeJson(STORE_KEYS.dim, state.dimMatches);
    toast(state.dimMatches ? "Non-current hits dimmed to 10%" : "All hits shown at full strength");
  },
  "toggle-theme": () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    toast(next === "dark" ? "Dark theme" : "Light theme");
  },
  print: () => window.print(),
  shortcuts: () => showInfo("shortcuts"),
  about: () => showInfo("about"),
};

function runCommand(id) {
  const command = commands[id];
  if (!command) return;
  rememberTool(id);
  command();
}

function runFromEvent(event) {
  const command = event.target.closest("[data-command]");
  if (!command) return;
  event.preventDefault();
  const id = command.dataset.command;
  if (state.paletteOpen) closePalette({ restoreFocus: false });
  runCommand(id);
}

/* ------------------------------------------------------------------ */
/* PDF loading + rendering                                             */
/* ------------------------------------------------------------------ */

function cleanup() {
  state.observer?.disconnect();
  state.observer = null;
  for (const entry of state.pages) {
    try {
      entry.page.cleanup?.();
    } catch {
      /* ignore */
    }
  }
  state.pages = [];
  state.pdf?.destroy?.();
  state.pdf = null;
  state.matches = [];
  state.index = -1;
  state.indexed = 0;
  els.pages.replaceChildren();
}

async function loadSample() {
  try {
    const response = await fetch(new URL("../../samples/sample.pdf", import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = new Uint8Array(await response.arrayBuffer());
    await loadPdf(data, "sample.pdf");
  } catch (error) {
    toast(`Could not load the sample PDF (${error.message})`);
  }
}

async function openFile(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    toast("Please choose a PDF file");
    return;
  }
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    await loadPdf(data, file.name);
  } catch (error) {
    console.error(error);
    toast("That file could not be read as a PDF");
  }
}

async function loadPdf(bytes, fileName) {
  const token = ++state.loadToken;
  cleanup();
  els.docName.textContent = fileName || "document.pdf";
  els.docMeta.textContent = "Loading…";
  els.dropzone.hidden = true;
  els.viewer.hidden = false;
  els.findCount.textContent = "Open a PDF";

  let task;
  try {
    task = pdfjs.getDocument({
      data: bytes.slice(),
      cMapUrl: new URL("../vendor/pdfjs/cmaps/", import.meta.url).href,
      cMapPacked: true,
      standardFontDataUrl: new URL("../vendor/pdfjs/standard_fonts/", import.meta.url).href,
    });
    state.pdf = await task.promise;
  } catch (error) {
    console.error(error);
    cleanup();
    els.viewer.hidden = true;
    els.dropzone.hidden = false;
    els.docName.textContent = "No document";
    els.docMeta.textContent = "";
    toast(
      /password/i.test(String(error?.message))
        ? "This PDF is password protected"
        : "This PDF could not be opened",
    );
    return;
  }

  if (token !== state.loadToken) return;

  state.fileName = fileName || "document.pdf";
  state.fileSize = bytes.length;
  els.docMeta.textContent = `${state.pdf.numPages} page${state.pdf.numPages === 1 ? "" : "s"} · ${formatBytes(
    bytes.length,
  )} · local`;

  state.pages = [];
  for (let number = 1; number <= state.pdf.numPages; number += 1) {
    const page = await state.pdf.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const wrapper = document.createElement("div");
    wrapper.className = "pdf-page";
    wrapper.dataset.pageNumber = String(number);
    wrapper.style.width = `${base.width * state.scale}px`;
    wrapper.style.height = `${base.height * state.scale}px`;

    const canvas = document.createElement("canvas");
    const overlay = document.createElement("div");
    overlay.className = "hit-layer";
    wrapper.append(canvas, overlay);
    els.pages.append(wrapper);

    state.pages.push({
      number,
      page,
      base,
      wrapper,
      canvas,
      overlay,
      model: null,
      rendered: false,
      rendering: false,
      renderScale: 0,
    });
  }

  state.scale = fitScale();
  applyScaleToWrappers();
  observePages();
  await ensureRender(state.pages[0]);

  // Extract text for every page, in order, without blocking the first render.
  for (const entry of state.pages) {
    try {
      const content = await entry.page.getTextContent();
      entry.model = buildPageModel(entry.number, content.items, entry.base.height, entry.base.width);
    } catch {
      entry.model = buildPageModel(entry.number, [], entry.base.height, entry.base.width);
    }
    state.indexed += 1;
    if (token !== state.loadToken) return;
  }

  if (els.findInput.value.trim()) runSearch({ focus: false });
  else els.findCount.textContent = "Type to search";
}

function fitScale() {
  const first = state.pages[0];
  if (!first) return 1.2;
  const available = Math.max(320, els.viewer.clientWidth - 56);
  return Math.min(2.4, Math.max(0.5, available / first.base.width));
}

function applyScaleToWrappers() {
  for (const entry of state.pages) {
    entry.wrapper.style.width = `${entry.base.width * state.scale}px`;
    entry.wrapper.style.height = `${entry.base.height * state.scale}px`;
  }
}

function setZoom(nextScale, fit, announce = true) {
  const clamped = Math.min(3.5, Math.max(0.35, nextScale));
  if (Math.abs(clamped - state.scale) < 0.001 && fit === state.fit) return;
  state.scale = clamped;
  state.fit = fit;
  applyScaleToWrappers();
  for (const entry of state.pages) {
    entry.rendered = false;
    entry.renderScale = 0;
    entry.canvas.width = 0;
    entry.canvas.height = 0;
  }
  observePages();
  for (const entry of state.pages) {
    if (isNearViewport(entry)) ensureRender(entry);
  }
  paintHighlights();
  if (announce) {
    const pct = Math.round((state.scale / fitScale()) * 100);
    toast(`Zoom ${pct}%`);
  }
}

function observePages() {
  state.observer?.disconnect();
  state.observer = new IntersectionObserver(
    (entries) => {
      for (const observed of entries) {
        if (!observed.isIntersecting) continue;
        const entry = state.pages.find((page) => page.wrapper === observed.target);
        if (entry) ensureRender(entry);
      }
    },
    { root: els.viewer, rootMargin: "300px 0px" },
  );
  for (const entry of state.pages) state.observer.observe(entry.wrapper);
}

function isNearViewport(entry) {
  const rect = entry.wrapper.getBoundingClientRect();
  const margin = 400;
  return rect.bottom > -margin && rect.top < window.innerHeight + margin;
}

async function ensureRender(entry) {
  if (!entry || entry.rendering) return;
  if (entry.rendered && entry.renderScale === state.scale) return;
  entry.rendering = true;
  try {
    const viewport = entry.page.getViewport({ scale: state.scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    entry.canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
    entry.canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
    entry.canvas.style.width = `${viewport.width}px`;
    entry.canvas.style.height = `${viewport.height}px`;

    const context = entry.canvas.getContext("2d", { alpha: false });
    await entry.page.render({
      canvasContext: context,
      viewport,
      transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      background: "#ffffff",
    }).promise;

    entry.rendered = true;
    entry.renderScale = state.scale;
  } catch (error) {
    console.error("render failed", entry.number, error);
  } finally {
    entry.rendering = false;
  }
}

function scrollViewerTo(entry, offset) {
  const pageTop = entry.wrapper.getBoundingClientRect().top - els.viewer.getBoundingClientRect().top + els.viewer.scrollTop;
  els.viewer.scrollTo({ top: Math.max(0, pageTop - offset), behavior: "smooth" });
}

function pageEntry(pageNumber) {
  return state.pages.find((entry) => entry.number === pageNumber) ?? null;
}

function scrollToPage(index) {
  const entry = state.pages[Math.max(0, Math.min(index, state.pages.length - 1))];
  if (!entry) return;
  ensureRender(entry);
  scrollViewerTo(entry, 20);
}

/* ------------------------------------------------------------------ */
/* Find in document                                                    */
/* ------------------------------------------------------------------ */

function openFind() {
  if (state.paletteOpen) closePalette({ restoreFocus: false });
  els.findBar.hidden = false;
  els.findInput.focus();
  els.findInput.select();
  if (!state.pdf) {
    els.findCount.textContent = "Open a PDF";
    els.findMeta.textContent = "";
    els.findMeta.classList.remove("visible");
  } else if (state.query) {
    runSearch();
  } else if (state.pdf) {
    els.findCount.textContent = "Type to search";
  }
}

function closeFind() {
  els.findBar.hidden = true;
  els.findInput.blur();
}

function clearSearch({ close = false } = {}) {
  els.findInput.value = "";
  state.query = "";
  state.matches = [];
  state.index = -1;
  clearHighlights();
  els.findCount.textContent = state.pdf ? "Type to search" : "Open a PDF";
  els.findMeta.textContent = "";
  els.findMeta.classList.remove("visible");
  els.findInput.focus();
  if (close) closeFind();
}

function scheduleSearch() {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => runSearch(), 90);
}

function runSearch({ focus = true } = {}) {
  const query = els.findInput.value;
  state.query = query;

  if (!state.pdf) {
    els.findCount.textContent = "Open a PDF";
    return;
  }

  if (!query.trim()) {
    state.matches = [];
    state.index = -1;
    clearHighlights();
    els.findCount.textContent = "Type to search";
    els.findMeta.textContent = "";
    els.findMeta.classList.remove("visible");
    return;
  }

  if (state.indexed < state.pages.length) {
    els.findCount.textContent = "Indexing…";
    return;
  }

  const models = state.pages.map((entry) => entry.model).filter(Boolean);
  state.matches = findInDocument(models, query, {
    matchCase: state.matchCase,
    wholeWord: state.wholeWord,
  });
  state.index = state.matches.length > 0 ? 0 : -1;

  paintHighlights();
  updateFindStatus();

  if (state.matches.length > 0) {
    if (focus) focusMatch();
  } else if (query.length > 0) {
    els.findMeta.textContent = "Check “Match case” or turn off “Whole word” to widen the search.";
    els.findMeta.classList.add("visible");
  }
}

function updateFindStatus() {
  if (!state.matches.length) {
    els.findCount.textContent = "No matches";
    els.findMeta.classList.add("visible");
    return;
  }

  const match = state.matches[state.index];
  els.findCount.textContent = `${state.index + 1} / ${state.matches.length}`;
  const onPage = state.matches.filter((item) => item.pageNumber === match.pageNumber).length;
  const pages = new Set(state.matches.map((item) => item.pageNumber)).size;
  els.findMeta.textContent = `${onPage} on page ${match.pageNumber} · ${state.matches.length} match${
    state.matches.length === 1 ? "" : "es"
  } across ${pages} page${pages === 1 ? "" : "s"}`;
  els.findMeta.classList.add("visible");
}

function clearHighlights() {
  for (const entry of state.pages) entry.overlay.replaceChildren();
}

function paintHighlights() {
  clearHighlights();
  if (!state.matches.length) return;

  const capped = state.matches.slice(0, MAX_HIGHLIGHTS);
  const fragmentByPage = new Map();

  capped.forEach((match, matchIndex) => {
    const entry = pageEntry(match.pageNumber);
    if (!entry) return;
    if (!fragmentByPage.has(entry.number)) fragmentByPage.set(entry.number, document.createDocumentFragment());
    const fragment = fragmentByPage.get(entry.number);

    for (const rect of match.rects) {
      const box = rectToCss(rect, entry.base.height, state.scale);
      const hit = document.createElement("div");
      hit.className = "hit";
      hit.dataset.match = String(matchIndex);
      if (matchIndex === state.index) hit.classList.add("current");
      hit.style.left = `${box.left}px`;
      hit.style.top = `${box.top}px`;
      hit.style.width = `${box.width}px`;
      hit.style.height = `${box.height}px`;
      fragment.append(hit);
    }
  });

  for (const [pageNumber, fragment] of fragmentByPage) {
    pageEntry(pageNumber)?.overlay.append(fragment);
  }

  if (state.matches.length > MAX_HIGHLIGHTS) {
    toast(`Showing the first ${MAX_HIGHLIGHTS} of ${state.matches.length} matches`, 3200);
  }
}

function setCurrent(index, { scroll = true } = {}) {
  if (!state.matches.length) return;
  const previous = state.index;
  state.index = index;

  if (previous >= 0) {
    for (const node of els.pages.querySelectorAll(`.hit[data-match="${previous}"]`)) {
      node.classList.remove("current");
    }
  }
  for (const node of els.pages.querySelectorAll(`.hit[data-match="${index}"]`)) {
    node.classList.add("current");
  }

  updateFindStatus();
  if (scroll) focusMatch();
}

function focusMatch() {
  const match = state.matches[state.index];
  if (!match) return;
  const entry = pageEntry(match.pageNumber);
  if (!entry) return;

  ensureRender(entry).then(() => {
    const rect = match.rects[0];
    if (!rect) return;
    const box = rectToCss(rect, entry.base.height, state.scale);
    const viewerTop = els.viewer.getBoundingClientRect().top;
    const pageTopViewport = entry.wrapper.getBoundingClientRect().top - viewerTop;
    const matchTop = pageTopViewport + box.top;

    // Don't scroll when the hit is already comfortably inside the viewport —
    // this keeps the page header visible for matches near the top of a page.
    const bandTop = 72;
    const bandBottom = els.viewer.clientHeight * 0.72;
    if (matchTop >= bandTop && matchTop <= bandBottom) return;

    const pageTop = pageTopViewport + els.viewer.scrollTop;
    const target = pageTop + box.top - els.viewer.clientHeight * 0.34;
    els.viewer.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  });
}

function moveMatch(direction) {
  if (!state.matches.length) {
    if (state.pdf && els.findInput.value.trim()) runSearch();
    return;
  }
  setCurrent(stepIndex(state.index, state.matches.length, direction));
}

function toggleFindOption(option) {
  const next = !state[option];
  state[option] = next;
  const button = option === "matchCase" ? els.caseBtn : els.wordBtn;
  button.setAttribute("aria-pressed", String(next));
  if (state.pdf && els.findInput.value.trim()) runSearch();
}

/* ------------------------------------------------------------------ */
/* Text export helpers                                                 */
/* ------------------------------------------------------------------ */

function documentText() {
  return state.pages
    .map((entry) => {
      const body = entry.model?.lines.map((line) => line.text).join("\n") ?? "";
      return `--- page ${entry.number} ---\n${body}`;
    })
    .join("\n\n");
}

function downloadText() {
  if (!state.pdf) return toast("Open a PDF first");
  const blob = new Blob([documentText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.fileName.replace(/\.pdf$/i, "")}.txt`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Text exported");
}

function currentPageNumber() {
  if (state.matches.length && state.index >= 0) return state.matches[state.index].pageNumber;
  const viewerRect = els.viewer.getBoundingClientRect();
  let best = 1;
  let bestDistance = Infinity;
  for (const entry of state.pages) {
    const rect = entry.wrapper.getBoundingClientRect();
    const distance = Math.abs(rect.top - viewerRect.top - 60);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry.number;
    }
  }
  return best;
}

async function copyPageText() {
  if (!state.pdf) return toast("Open a PDF first");
  const entry = pageEntry(currentPageNumber());
  const text = entry?.model?.lines.map((line) => line.text).join("\n") ?? "";
  try {
    await navigator.clipboard.writeText(text);
    toast(`Page ${entry.number} text copied`);
  } catch {
    toast("Clipboard permission was denied");
  }
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

els.toolsBtn.addEventListener("click", togglePalette);
els.findBtn.addEventListener("click", openFind);
els.openBtn.addEventListener("click", () => els.fileInput.click());
els.dropOpenBtn.addEventListener("click", () => els.fileInput.click());
els.sampleBtn.addEventListener("click", () => loadSample());

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files?.[0];
  els.fileInput.value = "";
  openFile(file);
});

els.palette.addEventListener("click", (event) => {
  if (event.target.closest("[data-palette-close]")) {
    closePalette();
    return;
  }
  const pin = event.target.closest("[data-pin]");
  if (pin) {
    event.preventDefault();
    const id = pin.dataset.pin;
    paletteState = togglePin(paletteState, id);
    writeJson(STORE_KEYS.pinned, paletteState.pinned);
    writeJson(STORE_KEYS.recent, paletteState.recent);
    renderPalette();
    els.toolSearch.focus();
    return;
  }
  runFromEvent(event);
});

els.palette.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusable = [...els.palette.querySelectorAll("button, input")].filter(
    (node) => !node.hidden && node.offsetParent !== null && !node.disabled,
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

els.toolSearch.addEventListener("input", applyPaletteFilter);
els.toolSearch.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const first = els.palette.querySelector(".tool-row:not(.is-dim) [data-command]");
  if (first) {
    const id = first.dataset.command;
    closePalette({ restoreFocus: false });
    runCommand(id);
  }
});
els.toolSearchClear.addEventListener("click", () => {
  els.toolSearch.value = "";
  applyPaletteFilter();
  els.toolSearch.focus();
});
els.suggestBtn.addEventListener("click", () => {
  toast("This is a local demo — add tools in app/js/tools-data.js");
});

els.findInput.addEventListener("input", scheduleSearch);
els.findInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    moveMatch(event.shiftKey ? -1 : 1);
  }
});
els.prevBtn.addEventListener("click", () => moveMatch(-1));
els.nextBtn.addEventListener("click", () => moveMatch(1));
els.closeFind.addEventListener("click", closeFind);
els.caseBtn.addEventListener("click", () => toggleFindOption("matchCase"));
els.wordBtn.addEventListener("click", () => toggleFindOption("wholeWord"));

document.addEventListener("keydown", (event) => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === "k") {
    event.preventDefault();
    togglePalette();
    return;
  }
  if (mod && event.key.toLowerCase() === "f") {
    event.preventDefault();
    openFind();
    return;
  }
  if (event.key === "Escape") {
    if (state.paletteOpen) {
      event.preventDefault();
      closePalette();
    } else if (!els.findBar.hidden) {
      event.preventDefault();
      closeFind();
    }
    return;
  }
  if (event.key === "/" && !isTypingTarget(event.target) && !state.paletteOpen) {
    event.preventDefault();
    openFind();
  }
});

window.addEventListener("resize", () => {
  if (!state.pdf || !state.fit) return;
  const next = fitScale();
  if (Math.abs(next - state.scale) < 0.01) return;
  setZoom(next, true, false);
});

// Drag and drop anywhere in the stage.
for (const eventName of ["dragenter", "dragover"]) {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("dragging");
  });
}
els.dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) openFile(file);
});

window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => {
  if (!event.dataTransfer?.files?.length) return;
  event.preventDefault();
  if (els.dropzone.hidden) return; // only the empty state accepts drops
  openFile(event.dataTransfer.files[0]);
});

els.infoDialog.addEventListener("click", (event) => {
  if (event.target === els.infoDialog) els.infoDialog.close();
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

els.findBar.hidden = true;
els.docName.textContent = "No document";
els.docMeta.textContent = "";

if (location.hash === "#sample") loadSample();

// Expose a tiny debug surface for browser-based tests and the curious.
window.smallEditor = {
  state,
  runCommand,
  openPalette,
  closePalette,
  openFind,
  runSearch,
  moveMatch,
  filterTools,
};
