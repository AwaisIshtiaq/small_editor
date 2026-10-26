// End-to-end check for Small Editor in a real (headless) Chrome.
// Starts its own Chrome on port 9337 when CDP is not supplied.
//
//   node scripts/browser-check.mjs
//   CDP=http://127.0.0.1:9333 node scripts/browser-check.mjs
//
// Prints PASS/FAIL lines and exits non-zero on failure.

import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173/app/";
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

let chrome = null;
let profile = null;
let endpoint = process.env.CDP || "";

async function waitFor(fn, { timeout = 15000, interval = 150 } = {}) {
  const start = Date.now();
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      /* keep waiting */
    }
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

async function ensureChrome() {
  if (endpoint) return;
  const executable = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error("Chrome not found; set CHROME_PATH");
  profile = await mkdtemp(join(tmpdir(), "small-editor-check-"));
  endpoint = "http://127.0.0.1:9337";
  chrome = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=9337",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  await waitFor(async () => {
    const response = await fetch(`${endpoint}/json/version`);
    return response.ok;
  });
}

async function newTarget(url) {
  const response = await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`could not create target: ${response.status}`);
  return (await response.json()).id;
}

async function connect(targetId) {
  const list = await (await fetch(`${endpoint}/json/list`)).json();
  const target = list.find((item) => item.id === targetId);
  if (!target) throw new Error("target not found");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      consoleErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, { resolve, reject });
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const screenshot = async (path) => {
    const result = await send("Page.captureScreenshot", { format: "png" });
    await mkdir(resolve("artifacts"), { recursive: true });
    await writeFile(path, Buffer.from(result.data, "base64"));
  };
  await send("Runtime.enable");
  await send("Page.enable");
  return { send, evaluate, screenshot, consoleErrors, close: () => ws.close() };
}

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, pass: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

try {
  await ensureChrome();
  const targetId = await newTarget(`${BASE}#sample`);
  const page = await connect(targetId);

  await waitFor(async () => page.evaluate("!!window.smallEditor && window.smallEditor.state.indexed === 4"));

  const meta = await page.evaluate(`(() => ({
    doc: document.querySelector('#docName').textContent,
    pages: document.querySelectorAll('.pdf-page').length,
    indexed: window.smallEditor.state.indexed,
    errors: 0
  }))()`);
  check("sample PDF loads", meta.doc === "sample.pdf" && meta.pages === 4, JSON.stringify(meta));

  const found = await page.evaluate(`(async () => {
    const e = window.smallEditor;
    e.openFind();
    const input = document.querySelector('#findInput');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'merge');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 450));
    return {
      count: document.querySelector('#findCount').textContent,
      meta: document.querySelector('#findMeta').textContent,
      visible: document.querySelectorAll('.hit').length,
      current: document.querySelectorAll('.hit.current').length,
      pages: [...new Set(e.state.matches.map(m => m.pageNumber))]
    };
  })()`);
  check("find counts occurrences", found.count === "1 / 9", found.count);
  check("find paints all hits", found.visible === 9, String(found.visible));
  check("exactly one current hit", found.current === 1, String(found.current));
  check("matches span pages 1,2,4", String(found.pages) === "1,2,4", String(found.pages));

  const stepped = await page.evaluate(`(async () => {
    const e = window.smallEditor;
    for (let i = 0; i < 9; i += 1) e.moveMatch(1);
    await new Promise(r => setTimeout(r, 200));
    return document.querySelector('#findCount').textContent;
  })()`);
  check("navigation wraps after the last match", stepped === "1 / 9", stepped);

  const caseSensitive = await page.evaluate(`(async () => {
    document.querySelector('#caseBtn').click();
    await new Promise(r => setTimeout(r, 400));
    return { count: document.querySelector('#findCount').textContent, matches: window.smallEditor.state.matches.length, pressed: document.querySelector('#caseBtn').getAttribute('aria-pressed') };
  })()`);
  check("match case narrows the set", caseSensitive.matches === 7 && caseSensitive.pressed === "true", JSON.stringify(caseSensitive));

  const whole = await page.evaluate(`(async () => {
    document.querySelector('#caseBtn').click();
    const input = document.querySelector('#findInput');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'quick');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    document.querySelector('#wordBtn').click();
    await new Promise(r => setTimeout(r, 400));
    const before = { count: document.querySelector('#findCount').textContent, matches: window.smallEditor.state.matches.length };
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'quick brown');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    return { before, phrase: document.querySelector('#findCount').textContent, phraseMatches: window.smallEditor.state.matches.length };
  })()`);
  check("whole word + phrase search", whole.before.matches === 2 && whole.phraseMatches === 2, JSON.stringify(whole));

  const palette = await page.evaluate(`(async () => {
    const e = window.smallEditor;
    e.openPalette();
    await new Promise(r => setTimeout(r, 180));
    const input = document.querySelector('#toolSearch');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'zoom');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 260));
    const rows = [...document.querySelectorAll('.tool-row')];
    const scroller = document.querySelector('.palette-scroll');
    const first = document.querySelector('.tool-row:not(.is-dim)');
    const rowRect = first.getBoundingClientRect();
    const boxRect = scroller.getBoundingClientRect();
    // Read the settled value, not an in-flight transition sample.
    const freeze = document.createElement('style');
    freeze.textContent = '*{transition:none!important}';
    document.head.append(freeze);
    const dimOpacity = getComputedStyle(rows.find(r => r.classList.contains('is-dim'))).opacity;
    freeze.remove();
    return {
      rows: rows.length,
      dim: rows.filter(r => r.classList.contains('is-dim')).length,
      dimOpacity,
      firstVisible: rowRect.top >= boxRect.top && rowRect.bottom <= boxRect.bottom + 1,
      first: first.querySelector('.tool-title').textContent
    };
  })()`);
  check("palette keeps every row and dims non-matches", palette.rows === 20 && palette.dim === 17, JSON.stringify(palette));
  check("dim opacity is Sejda's 0.1", palette.dimOpacity === "0.1", palette.dimOpacity);
  check("palette scrolls the first live result into view", palette.firstVisible === true, palette.first);

  await page.screenshot(resolve("artifacts", "palette.png"));

  const pinned = await page.evaluate(`(async () => {
    document.querySelector('[data-pin="zoom-in"]').click();
    await new Promise(r => setTimeout(r, 120));
    return {
      stored: JSON.parse(localStorage.getItem('smallEditor.pinnedTools') || '[]')[0],
      chip: document.querySelectorAll('.chip')[0].textContent.trim(),
      pressed: document.querySelector('[data-pin="zoom-in"]').getAttribute('aria-pressed')
    };
  })()`);
  check("pinning writes localStorage and moves the chip", pinned.stored === "zoom-in" && pinned.pressed === "true", JSON.stringify(pinned));

  const closed = await page.evaluate(`(async () => {
    document.querySelector('#toolSearch').value = '';
    document.querySelector('#toolSearch').dispatchEvent(new Event('input', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    const paletteHidden = document.querySelector('#palette').hidden;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    return { paletteHidden, findHidden: document.querySelector('#findBar').hidden };
  })()`);
  check("Escape closes palette then find", closed.paletteHidden === true && closed.findHidden === true, JSON.stringify(closed));

  check("no console errors or exceptions", page.consoleErrors.length === 0, page.consoleErrors.join(" | "));

  page.close();
} catch (error) {
  console.error("CHECK ERROR:", error.message);
  results.push({ name: "harness", pass: false, detail: error.message });
} finally {
  if (chrome) chrome.kill();
  if (profile) await rm(profile, { recursive: true, force: true }).catch(() => {});
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
