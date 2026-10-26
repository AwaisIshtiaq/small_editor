import fs from 'node:fs';
import crypto from 'node:crypto';

const CDP = 'http://127.0.0.1:9333';
const ROUTE = (process.argv[2] || '').replace(/^\/+/, '');
const SCENARIO = process.argv[3] || ROUTE;
const ROOT = 'D:/small_editor';
const RAW = `${ROOT}/reports/_raw`;
const OUT = `${RAW}/${SCENARIO}-task-network.json`;
const SANITIZED = `${RAW}/${SCENARIO}-task-network.sanitized.json`;
const SHOT = `${RAW}/${SCENARIO}-result.png`;
const HTML = `${RAW}/${SCENARIO}-result.html`;

const SCENARIOS = {
  'split-pdf-by-outline': {
    route: 'split-pdf-by-outline',
    files: ['samples/sample-bookmarks.pdf'],
    waitFiles: 1,
    radios: { bookmarksLevel: '1' },
    texts: { bookmarksExpression: 'Chapter' }
  },
  'alternate-mix-pdf': {
    route: 'alternate-mix-pdf',
    files: ['samples/sample.pdf', 'samples/sample-bookmarks.pdf'],
    waitFiles: 2
  },
  'encrypt-pdf': {
    route: 'encrypt-pdf',
    files: ['samples/sample.pdf'],
    waitFiles: 1,
    texts: {
      userPassword: 'open-sejda-2026',
      ownerPassword: 'owner-sejda-2026'
    }
  },
  'split-pdf-by-size': {
    route: 'split-pdf-by-size',
    files: ['samples/sample.pdf'],
    waitFiles: 1,
    radios: { sizeUnit: 'KB' },
    texts: { size: '1' }
  },
  'extract-pdf-pages': {
    route: 'extract-pdf-pages',
    files: ['samples/sample.pdf'],
    waitFiles: 1,
    clicks: ['.specific-pages-selector'],
    fields: { '#specificPages': '1,3-4' }
  },
  'rotate-pdf-pages': {
    route: 'rotate-pdf-pages',
    files: ['samples/sample.pdf'],
    waitFiles: 1,
    rotations: [
      { page: 1, times: 1 },
      { page: 3, times: 2 },
      { page: 4, times: 3 }
    ]
  }
};

const config = SCENARIOS[SCENARIO];
if (!config) throw new Error(`No scenario for ${SCENARIO}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function safeUrl(url) {
  let raw = String(url);
  if (/^www\./i.test(raw)) raw = 'https://' + raw;
  try {
    const u = new URL(raw, 'https://www.sejda.com');
    for (const k of ['_s', 's', 'uplid']) if (u.searchParams.has(k)) u.searchParams.set(k, '[redacted]');
    return u.toString();
  } catch {
    return String(url).replace(/([?&](?:_s|s|uplid)=)[^&]+/gi, '$1[redacted]');
  }
}
function safeText(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/([?&](?:_s|s|uplid)=)[^&"'\\\s]+/gi, '$1[redacted]')
    .replace(/(name=["']uplid["'][^>]*value=["'])[^"']*(["'])/gi, '$1[redacted]$2')
    .replace(/("(?:userPassword|ownerPassword|password)"\s*:\s*")[^"]*(")/gi, '$1[redacted]$2');
}
function safeHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [
    k,
    /^(cookie|set-cookie|authorization|proxy-authorization)$/i.test(k)
      ? '[redacted]'
      : safeText(String(v))
  ]));
}

const targets = await (await fetch(CDP + '/json')).json();
const pageTargets = targets.filter((t) => t.type === 'page' && t.url.startsWith('https://www.sejda.com'));
const target = pageTargets.find((t) => t.url.includes(`/${config.route}`))
  || pageTargets.find((t) => t.type === 'page')
  || targets.find((t) => t.type === 'page');
if (!target) throw new Error('No page target');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 1;
const pending = new Map();
const tx = new Map();
const consoleEvents = [];
const pageErrors = [];

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout ${method}`));
    }, 60000);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); }
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function getBody(requestId) {
  try {
    const r = await send('Network.getResponseBody', { requestId });
    return { body: r.body, base64Encoded: r.base64Encoded };
  } catch (e) {
    return { error: String(e) };
  }
}
ws.addEventListener('message', async (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }
  if (msg.id) {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    return;
  }
  const { method, params } = msg;
  if (method === 'Network.requestWillBeSent') {
    tx.set(params.requestId, {
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      resourceType: params.type,
      requestHeaders: params.request.headers,
      postData: params.request.postData || null,
      response: null,
      body: null,
      failed: null
    });
  } else if (method === 'Network.responseReceived') {
    const t = tx.get(params.requestId);
    if (t) t.response = {
      status: params.response.status,
      statusText: params.response.statusText,
      mimeType: params.response.mimeType,
      headers: params.response.headers,
      protocol: params.response.protocol,
      remoteIPAddress: params.response.remoteIPAddress
    };
  } else if (method === 'Network.loadingFinished') {
    const t = tx.get(params.requestId);
    if (t && /\/api\/(files|tasks)/.test(t.url) && !t.bodyRequested) {
      t.bodyRequested = true;
      t.body = await getBody(params.requestId);
    }
  } else if (method === 'Network.loadingFailed') {
    const t = tx.get(params.requestId);
    if (t) t.failed = {
      errorText: params.errorText,
      canceled: params.canceled,
      blockedReason: params.blockedReason
    };
  } else if (method === 'Runtime.consoleAPICalled') {
    consoleEvents.push({
      type: params.type,
      text: (params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 1000),
      timestamp: params.timestamp
    });
  } else if (method === 'Runtime.exceptionThrown') {
    pageErrors.push({
      text: params.exceptionDetails?.text || '',
      description: params.exceptionDetails?.exception?.description || '',
      url: params.exceptionDetails?.url,
      lineNumber: params.exceptionDetails?.lineNumber,
      timestamp: params.timestamp
    });
  }
});
async function evalValue(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function waitFor(description, fn, timeoutMs = 90000, intervalMs = 500) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) { last = String(e); }
    await sleep(intervalMs);
  }
  throw new Error(`Timeout waiting for ${description}; last=${JSON.stringify(last)}`);
}
async function screenshot(path) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(path, buf);
  return { bytes: buf.length, sha256: sha256(buf) };
}

await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');
await send('Network.enable', { maxPostDataSize: 5_000_000 });
try { await send('Network.setBypassServiceWorker', { bypass: true }); } catch {}
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Network.setExtraHTTPHeaders', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
// Deliberately do NOT clear cookies/storage: preserve the same free-tier client session.
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
});
try { await send('Emulation.setLocaleOverride', { locale: 'en-US' }); } catch {}
try { await send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' }); } catch {}
try {
  await send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'reduce' }
    ]
  });
} catch {}

const startedAt = new Date().toISOString();
const url = `https://www.sejda.com/${config.route}`;
await send('Page.navigate', { url });
await waitFor('document ready', async () => (await evalValue('document.readyState')) === 'complete', 45000);
await sleep(3500);

const inputBefore = await evalValue(`(() => {
  const i = document.querySelector('#fileUploadForm input[type=file]');
  return i ? { id: i.id, accept: i.accept, multiple: i.multiple } : null;
})()`);
if (!inputBefore) throw new Error('No #fileUploadForm input');
const obj = await send('Runtime.evaluate', { expression: "document.querySelector('#fileUploadForm input[type=file]')" });
await send('DOM.setFileInputFiles', {
  files: config.files.map((p) => `${ROOT}/${p}`),
  objectId: obj.result.objectId
});

await waitFor('upload completed', async () => {
  return await evalValue(`(() => {
    const files = document.querySelectorAll('input[name="files[]"]').length;
    const step2 = document.querySelector('#step2Choices');
    const tf = document.querySelector('form.task-form');
    const submit = tf?.querySelector('button[type=submit], input[type=submit]');
    return files >= ${config.waitFiles}
      && ((step2 && getComputedStyle(step2).display !== 'none') || Boolean(submit && submit.offsetParent !== null));
  })()`);
}, 90000, 500);
await sleep(2000);

const step2 = await evalValue(`(() => {
  const el = document.querySelector('#step2Choices');
  return el ? { display: getComputedStyle(el).display, text: el.innerText.slice(0, 1000) } : null;
})()`);
if (step2 && step2.display !== 'none') {
  const clicked = await evalValue(`(() => {
    const visible = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const preferred = document.querySelector('#step2ChoicesContinueBtn');
    if (preferred && visible(preferred)) { preferred.click(); return { id: preferred.id, text: preferred.innerText }; }
    const btn = Array.from(document.querySelectorAll('#step2Choices button, #step2Choices a.btn'))
      .find((el) => visible(el) && /continue/i.test(el.innerText || el.value || ''));
    if (btn) { btn.click(); return { id: btn.id, text: btn.innerText }; }
    return null;
  })()`);
  if (!clicked) throw new Error('Step 2 visible but no Continue button');
}

await waitFor('task form submit visible', async () => {
  return await evalValue(`(() => {
    const form = document.querySelector('form.task-form');
    const submit = form?.querySelector('button[type=submit], input[type=submit]');
    return Boolean(submit && submit.offsetParent !== null && !submit.disabled);
  })()`);
}, 45000, 500);
await sleep(1000);

if (config.radios) {
  for (const [name, value] of Object.entries(config.radios)) {
    const ok = await evalValue(`(() => {
      const el = Array.from(document.querySelectorAll('form.task-form input[type=radio][name="${name}"]'))
        .find((x) => x.value === ${JSON.stringify(value)});
      if (!el) return false;
      el.click();
      return el.checked;
    })()`);
    if (!ok) throw new Error(`Could not select radio ${name}=${value}`);
  }
}
if (config.texts) {
  for (const [name, value] of Object.entries(config.texts)) {
    const ok = await evalValue(`(() => {
      const el = document.querySelector('form.task-form [name="${name}"]');
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    })()`);
    if (!ok) throw new Error(`Could not set ${name}`);
  }
}
if (config.clicks) {
  for (const selector of config.clicks) {
    const clicked = await evalValue(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    })()`);
    if (!clicked) throw new Error(`Could not click ${selector}`);
    await sleep(250);
  }
}
if (config.fields) {
  for (const [selector, value] of Object.entries(config.fields)) {
    const ok = await evalValue(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.focus();
      return el.value;
    })()`);
    if (!ok) throw new Error(`Could not set ${selector}`);
  }
}
let rotationResult = null;
if (config.rotations) {
  rotationResult = await evalValue(`(() => {
    const plan = ${JSON.stringify(config.rotations)};
    return plan.map(({ page, times }) => {
      const wrap = document.querySelector('.pdf-page-wrap[data-page="' + page + '"]');
      if (!wrap) return { page, error: 'missing page' };
      const btn = wrap.querySelector('.page-tools-rotate-btn[data-rotation="90"]');
      if (!btn) return { page, error: 'missing rotate button' };
      for (let i = 0; i < times; i += 1) btn.click();
      return { page, times, rotation: wrap.getAttribute('data-rotation'), class: wrap.className };
    });
  })()`);
  if (rotationResult.some((x) => x.error)) throw new Error(`Could not rotate pages: ${JSON.stringify(rotationResult)}`);
}

const before = await evalValue(`(() => {
  const form = document.querySelector('form.task-form');
  const submit = form ? form.querySelector('button[type=submit], input[type=submit]') : null;
  return {
    url: location.href,
    title: document.title,
    files: Array.from(document.querySelectorAll('input[name="files[]"]')).map((x) => x.value),
    submit: submit ? { text: (submit.innerText || submit.value || '').trim(), visible: submit.offsetParent !== null } : null,
    pages: Array.from(document.querySelectorAll('.pdf-page-wrap')).map((x) => ({
      page: x.getAttribute('data-page'),
      rotation: x.getAttribute('data-rotation'),
      fileCounter: x.getAttribute('data-file-counter'),
      filename: x.getAttribute('data-filename')
    })),
    fields: form ? Array.from(form.querySelectorAll('input,select,textarea')).map((x) => ({
      type: x.getAttribute('type') || x.tagName.toLowerCase(),
      name: x.name || '',
      id: x.id || '',
      value: (x.type === 'password' || /password/i.test(x.name || '')) ? '[redacted]' : (x.value || ''),
      checked: Boolean(x.checked)
    })) : [],
    bodyText: document.body.innerText.slice(0, 1500)
  };
})()`);
if (!before.submit) throw new Error('No task-form submit button');

await evalValue(`(() => {
  const form = document.querySelector('form.task-form');
  const submit = form.querySelector('button[type=submit], input[type=submit]');
  submit.click();
  return true;
})()`);
const clickedAt = new Date().toISOString();

let taskResponseSeen = false;
try {
  await waitFor('POST /api/tasks response', async () => {
    return Array.from(tx.values()).some((t) =>
      t.method === 'POST' && /\/api\/tasks(?:\?|$)/.test(t.url) && t.response
    );
  }, 45000, 500);
  taskResponseSeen = true;
} catch (e) {
  console.error('No POST /api/tasks response observed:', String(e));
}
await sleep(1500);

const taskTx = Array.from(tx.values()).find((t) =>
  t.method === 'POST' && /\/api\/tasks(?:\?|$)/.test(t.url) && t.response
);
if (taskTx?.bodyRequested) {
  await waitFor('task response body', async () => taskTx.body !== null, 15000, 250);
}
const taskStatus = taskTx?.response?.status ?? null;
const taskHeaders = taskTx?.response?.headers || {};
const taskBody = taskTx?.body?.body || '';
let taskId = null;
if (taskStatus === 200 && taskBody) {
  try {
    const parsed = JSON.parse(taskBody);
    taskId = typeof parsed === 'string' ? parsed : (parsed.id || null);
  } catch { taskId = taskBody.replace(/^"|"$/g, ''); }
}

let change = null;
let changeStatus = null;
let changeHeaders = null;
let changeBody = null;
if (taskId) {
  const pollStart = Date.now();
  while (Date.now() - pollStart < 120000) {
    const r = await evalValue(`(async () => {
      const res = await fetch('/api/tasks/${encodeURIComponent(taskId)}/change?_=' + Date.now(), { credentials: 'include', cache: 'no-store' });
      const text = await res.text();
      return { status: res.status, headers: Object.fromEntries(res.headers), body: text };
    })()`);
    changeStatus = r.status;
    changeHeaders = r.headers;
    changeBody = r.body;
    try { change = JSON.parse(r.body); } catch { change = null; }
    if (change?.status === 'Completed' || change?.status === 'Failed' || change?.status === 'Error') break;
    await sleep(1500);
  }
}

let result = null;
if (change?.resultFullUrlPattern) {
  const filename = change.resultFilename || 'result';
  const encoded = encodeURIComponent(filename);
  const url = change.resultFullUrlPattern
    .replace(/%7B%7Bfilename%7D%7D/gi, encoded)
    .replace(/\{\{filename\}\}/gi, encoded)
    .replace(/^www\./, 'https://www.');
  const dl = await evalValue(`(async () => {
    const res = await fetch(${JSON.stringify(url)}, { credentials: 'include', cache: 'no-store' });
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return { status: res.status, headers: Object.fromEntries(res.headers), base64: btoa(bin), bytes: bytes.length };
  })()`);
  const buf = Buffer.from(dl.base64, 'base64');
  const contentType = String(dl.headers?.['content-type'] || '').toLowerCase();
  const ext = contentType.includes('pdf') ? 'pdf'
    : contentType.includes('zip') ? 'zip'
    : /\.zip$/i.test(filename) ? 'zip'
    : /\.pdf$/i.test(filename) ? 'pdf'
    : 'bin';
  const resultPath = `${RAW}/${SCENARIO}-result.${ext}`;
  fs.writeFileSync(resultPath, buf);
  result = {
    path: resultPath,
    url: safeUrl(url),
    status: dl.status,
    headers: safeHeaders(dl.headers),
    bytes: dl.bytes,
    sha256: sha256(buf),
    ext
  };
}

const shot = await screenshot(SHOT);
const html = await evalValue('document.documentElement.outerHTML');
fs.writeFileSync(HTML, safeText(html));
const after = await evalValue(`(() => ({
  url: location.href,
  title: document.title,
  bodyText: document.body.innerText.slice(0, 4000)
}))()`);

const apiTransactions = Array.from(tx.values())
  .filter((t) => /\/api\/(files|tasks|event)/.test(t.url))
  .map((t) => ({
    requestId: t.requestId,
    url: safeUrl(t.url),
    method: t.method,
    resourceType: t.resourceType,
    requestHeaders: safeHeaders(t.requestHeaders),
    postData: t.postData ? safeText(t.postData.slice(0, 20000)) : null,
    response: t.response ? { ...t.response, headers: safeHeaders(t.response.headers) } : null,
    body: t.body?.body ? { ...t.body, body: safeText(t.body.body) } : t.body,
    failed: t.failed
  }));

const out = {
  startedAt,
  finishedAt: new Date().toISOString(),
  clickedAt,
  route: `/${config.route}`,
  cdpEndpoint: CDP,
  target: { id: target.id, title: target.title, url: target.url },
  environment: {
    viewport: '1440x900@1',
    locale: 'en-US',
    timezone: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'bypass',
    cache: 'disabled',
    loggedIn: false
  },
  fixtures: config.files.map((p) => ({
    path: p,
    bytes: fs.statSync(`${ROOT}/${p}`).size,
    sha256: sha256(fs.readFileSync(`${ROOT}/${p}`))
  })),
  inputBefore,
  step2,
  config: {
    radios: config.radios || null,
    texts: config.texts ? Object.keys(config.texts) : null,
    clicks: config.clicks || null,
    fields: config.fields ? Object.keys(config.fields) : null,
    rotations: config.rotations || null
  },
  rotationResult,
  before,
  taskResponseSeen,
  rateLimit: {
    remaining: taskHeaders['x-ratelimit-remaining'] ?? taskHeaders['X-RateLimit-Remaining'] ?? null,
    wait: taskHeaders['x-ratelimit-wait'] ?? taskHeaders['X-RateLimit-Wait'] ?? null
  },
  task: { status: taskStatus, headers: safeHeaders(taskHeaders), body: safeText(taskBody.slice(0, 8000)), id: taskId },
  change: { status: changeStatus, headers: safeHeaders(changeHeaders), body: changeBody ? safeText(changeBody.slice(0, 20000)) : null, parsed: change },
  result,
  screenshot: { path: SHOT, ...shot },
  html: { path: HTML, bytes: Buffer.byteLength(html, 'utf8'), sha256: sha256(Buffer.from(html)) },
  after,
  apiTransactions,
  console: consoleEvents.slice(-100),
  pageErrors: pageErrors.slice(-50)
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

const sanitized = JSON.parse(JSON.stringify(out));
sanitized.task.body = safeText(sanitized.task.body);
sanitized.change.body = safeText(sanitized.change.body);
if (sanitized.change.parsed?.resultFullUrlPattern) {
  sanitized.change.parsed.resultFullUrlPattern = safeUrl(sanitized.change.parsed.resultFullUrlPattern);
}
fs.writeFileSync(SANITIZED, JSON.stringify(sanitized, null, 2));

console.log(JSON.stringify({
  out: OUT,
  sanitized: SANITIZED,
  screenshot: SHOT,
  result,
  taskStatus,
  taskResponseSeen,
  rateLimit: {
    remaining: taskHeaders['x-ratelimit-remaining'] ?? taskHeaders['X-RateLimit-Remaining'] ?? null,
    wait: taskHeaders['x-ratelimit-wait'] ?? taskHeaders['X-RateLimit-Wait'] ?? null
  },
  taskId,
  changeStatus,
  change: change ? {
    status: change.status,
    resultFilename: change.resultFilename,
    resultFileSize: change.resultFileSize,
    resultItems: change.resultItems,
    warnings: change.warnings
  } : null,
  before: {
    files: before.files,
    submit: before.submit,
    fields: before.fields
  },
  after,
  pageErrors: pageErrors.slice(-10)
}, null, 2));
ws.close();
