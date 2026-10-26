import fs from 'node:fs';
import crypto from 'node:crypto';

const CDP = 'http://127.0.0.1:9333';
const OUT = 'D:/small_editor/reports/_raw/merge-task-network.json';
const SANITIZED = 'D:/small_editor/reports/_raw/merge-task-network.sanitized.json';
const ZIP = 'D:/small_editor/reports/_raw/merge-result.zip';
const SHOT = 'D:/small_editor/reports/_raw/merge-result.png';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const targets = await (await fetch(CDP + '/json')).json();
const target = targets.find((t) => t.type === 'page' && t.url.includes('/merge-pdf'))
  || targets.find((t) => t.type === 'page' && t.url.startsWith('https://www.sejda.com'))
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
    const t = {
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      resourceType: params.type,
      requestHeaders: params.request.headers,
      postData: params.request.postData || null,
      response: null,
      body: null,
      failed: null
    };
    tx.set(params.requestId, t);
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
    if (t) t.failed = { errorText: params.errorText, canceled: params.canceled, blockedReason: params.blockedReason };
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
function safeUrl(url) {
  try {
    const u = new URL(url, 'https://www.sejda.com');
    for (const k of ['_s', 's', 'uplid']) if (u.searchParams.has(k)) u.searchParams.set(k, '[redacted]');
    return u.toString();
  } catch {
    return String(url).replace(/([?&](?:_s|s|uplid)=)[^&]+/gi, '$1[redacted]');
  }
}
function sanitizedTransaction(t) {
  return {
    ...t,
    url: safeUrl(t.url),
    requestHeaders: Object.fromEntries(Object.entries(t.requestHeaders || {}).map(([k, v]) => [
      k, /^(cookie|authorization|proxy-authorization)$/i.test(k) ? '[redacted]' : v
    ])),
    response: t.response ? {
      ...t.response,
      headers: Object.fromEntries(Object.entries(t.response.headers || {}).map(([k, v]) => [
        k, /^(set-cookie)$/i.test(k) ? '[redacted]' : v
      ]))
    } : null,
    body: t.body?.body ? {
      ...t.body,
      body: t.body.body.replace(/([?&](?:_s|s|uplid)=)[^&"\\]+/gi, '$1[redacted]')
    } : t.body
  };
}

const startedAt = new Date().toISOString();
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable', { maxPostDataSize: 5_000_000 });
try { await send('Network.setBypassServiceWorker', { bypass: true }); } catch {}
await send('Network.setCacheDisabled', { cacheDisabled: true });

const before = await evalValue(`(() => ({
  url: location.href,
  title: document.title,
  files: Array.from(document.querySelectorAll('input[name="files[]"]')).map(x => x.value),
  submit: (() => {
    const b = document.querySelector('form.task-form button[type=submit]');
    return b ? { text: b.innerText, visible: b.offsetParent !== null } : null;
  })(),
  bodyText: document.body.innerText.slice(0, 1200)
}))()`);

await evalValue(`document.querySelector('form.task-form button[type=submit]').click(); true`);
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
if (taskTx && taskTx.bodyRequested) {
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
let result = null;
let zipInfo = null;
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
  if (change?.resultFullUrlPattern) {
    const filename = change.resultFilename || 'result.zip';
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
    const zipBuf = Buffer.from(dl.base64, 'base64');
    fs.writeFileSync(ZIP, zipBuf);
    zipInfo = {
      url: safeUrl(url),
      status: dl.status,
      headers: Object.fromEntries(Object.entries(dl.headers || {}).map(([k, v]) => [
        k, /^(set-cookie)$/i.test(k) ? '[redacted]' : v
      ])),
      bytes: dl.bytes,
      sha256: sha256(zipBuf)
    };
  }
}
const shot = await screenshot(SHOT);
const after = await evalValue(`(() => ({
  url: location.href,
  title: document.title,
  bodyText: document.body.innerText.slice(0, 3000)
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
  fixtures: [
    { path: 'D:/small_editor/samples/sample.pdf', bytes: 2924, sha256: '5ef833b674aa0e691eb7b9b6a063402876500553997215eff905d786cf76d319' },
    { path: 'D:/small_editor/samples/sample-merge-b.pdf', bytes: 2924, sha256: '5ef833b674aa0e691eb7b9b6a063402876500553997215eff905d786cf76d319' }
  ],
  before,
  task: {
    status: taskStatus,
    headers: taskHeaders,
    body: taskBody.slice(0, 8000),
    id: taskId
  },
  change: {
    status: changeStatus,
    headers: changeHeaders,
    body: changeBody ? changeBody.slice(0, 20000) : null,
    parsed: change
  },
  result: zipInfo,
  screenshot: { path: SHOT, ...shot },
  after,
  apiTransactions,
  console: consoleEvents.slice(-100),
  pageErrors: pageErrors.slice(-50)
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const sanitized = {
  ...out,
  apiTransactions: apiTransactions.map(sanitizedTransaction),
  task: {
    ...out.task,
    body: out.task.body.replace(/([?&](?:_s|s|uplid)=)[^&"\\]+/gi, '$1[redacted]')
  },
  change: {
    ...out.change,
    parsed: out.change.parsed ? JSON.parse(JSON.stringify(out.change.parsed).replace(/([?&](?:_s|s|uplid)=)[^&"\\]+/gi, '$1[redacted]')) : null,
    body: out.change.body ? out.change.body.replace(/([?&](?:_s|s|uplid)=)[^&"\\]+/gi, '$1[redacted]') : null
  }
};
fs.writeFileSync(SANITIZED, JSON.stringify(sanitized, null, 2));

console.log(JSON.stringify({
  out: OUT,
  sanitized: SANITIZED,
  zip: ZIP,
  zipInfo,
  taskStatus,
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
  clickError: null,
  pageErrors: pageErrors.slice(-10)
}, null, 2));
ws.close();
