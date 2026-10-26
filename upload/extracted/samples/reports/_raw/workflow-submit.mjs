import fs from 'node:fs';
import crypto from 'node:crypto';

const CDP = 'http://127.0.0.1:9333';
const ROUTE = (process.argv[2] || 'workflow').replace(/^\/+/, '');
const OUT = `D:/small_editor/reports/_raw/${ROUTE}-task-network.json`;
const SANITIZED = `D:/small_editor/reports/_raw/${ROUTE}-task-network.sanitized.json`;
const SHOT = `D:/small_editor/reports/_raw/${ROUTE}-result.png`;
const HTML = `D:/small_editor/reports/_raw/${ROUTE}-result.html`;
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
    .replace(/(name=["']uplid["'][^>]*value=["'])[^"']*(["'])/gi, '$1[redacted]$2');
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
const target = targets.find((t) => t.type === 'page' && t.url.startsWith('https://www.sejda.com'))
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

const startedAt = new Date().toISOString();
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable', { maxPostDataSize: 5_000_000 });
try { await send('Network.setBypassServiceWorker', { bypass: true }); } catch {}
await send('Network.setCacheDisabled', { cacheDisabled: true });

const before = await evalValue(`(() => {
  const form = document.querySelector('form.task-form');
  const submit = form ? form.querySelector('button[type=submit], input[type=submit]') : null;
  return {
    url: location.href,
    title: document.title,
    files: Array.from(document.querySelectorAll('input[name="files[]"]')).map((x) => x.value),
    submit: submit ? { text: (submit.innerText || submit.value || '').trim(), visible: submit.offsetParent !== null } : null,
    fields: form ? Array.from(form.querySelectorAll('input,select,textarea')).map((x) => ({
      type: x.getAttribute('type') || x.tagName.toLowerCase(),
      name: x.name || '',
      id: x.id || '',
      value: x.value || '',
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
  const url = change.resultFullUrlPattern
    .replace('{{filename}}', encodeURIComponent(filename))
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
    : 'bin';
  const resultPath = `D:/small_editor/reports/_raw/${ROUTE}-result.${ext}`;
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
    url: t.url,
    method: t.method,
    resourceType: t.resourceType,
    requestHeaders: t.requestHeaders,
    postData: t.postData ? t.postData.slice(0, 20000) : null,
    response: t.response,
    body: t.body,
    failed: t.failed
  }));

const out = {
  startedAt,
  finishedAt: new Date().toISOString(),
  clickedAt,
  route: `/${ROUTE}`,
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
  before,
  taskResponseSeen,
  task: { status: taskStatus, headers: taskHeaders, body: taskBody.slice(0, 8000), id: taskId },
  change: { status: changeStatus, headers: changeHeaders, body: changeBody ? changeBody.slice(0, 20000) : null, parsed: change },
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
sanitized.task.headers = safeHeaders(sanitized.task.headers);
sanitized.task.body = safeText(sanitized.task.body);
sanitized.change.headers = safeHeaders(sanitized.change.headers);
sanitized.change.body = safeText(sanitized.change.body);
if (sanitized.change.parsed?.resultFullUrlPattern) {
  sanitized.change.parsed.resultFullUrlPattern = safeUrl(sanitized.change.parsed.resultFullUrlPattern);
}
sanitized.apiTransactions = sanitized.apiTransactions.map((t) => ({
  ...t,
  url: safeUrl(t.url),
  requestHeaders: safeHeaders(t.requestHeaders),
  postData: safeText(t.postData),
  response: t.response ? { ...t.response, headers: safeHeaders(t.response.headers) } : null,
  body: t.body?.body ? { ...t.body, body: safeText(t.body.body) } : t.body
}));
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
  before,
  after,
  pageErrors: pageErrors.slice(-10)
}, null, 2));
ws.close();
