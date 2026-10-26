import fs from 'node:fs';

const CDP = 'http://127.0.0.1:9333';
const SAMPLE = 'D:/small_editor/samples/sample.pdf';
const OUT = 'D:/small_editor/reports/_raw/rea-upload-task-network.json';
const SHOT_READY = 'D:/small_editor/reports/_raw/rea-split-ready.png';
const SHOT_RESULT = 'D:/small_editor/reports/_raw/rea-split-result.png';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safeHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k] = /^(cookie|set-cookie|authorization|proxy-authorization)$/i.test(k) ? '[redacted]' : v;
  }
  return out;
}

function multipartSummary(postData, contentType) {
  if (!postData) return { available: false };
  const out = {
    available: true,
    bytes: Buffer.byteLength(postData, 'utf8'),
    fields: {},
    files: []
  };
  for (const m of postData.matchAll(/name="([^"]+)"\r\n\r\n([^\r\n]*)/g)) {
    if (!out.fields[m[1]]) out.fields[m[1]] = m[2].slice(0, 200);
  }
  for (const m of postData.matchAll(/name="([^"]+)"; filename="([^"]*)"\r\nContent-Type: ([^\r\n]+)/g)) {
    out.files.push({ field: m[1], filename: m[2], contentType: m[3] });
  }
  if (contentType) out.contentType = contentType;
  return out;
}

const targets = await (await fetch(CDP + '/json')).json();
const target = targets.find((t) => t.type === 'page' && t.url.startsWith('https://www.sejda.com'))
  || targets.find((t) => t.type === 'page');
if (!target) throw new Error('No page target on CDP endpoint');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const transactions = new Map();
const consoleEvents = [];
const pageErrors = [];
const navigations = [];
let targetRequestId = null;

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout ${method}`));
    }, 45000);
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
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
    return;
  }
  const { method, params } = msg;
  if (method === 'Network.requestWillBeSent') {
    const tx = {
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      resourceType: params.type,
      requestHeaders: safeHeaders(params.request.headers),
      hasPostData: Boolean(params.request.postData),
      postData: params.request.postData || null,
      timestamp: params.timestamp,
      wallTime: params.wallTime,
      response: null,
      body: null,
      failed: null
    };
    transactions.set(params.requestId, tx);
    if (/\/api\/(files|tasks|event)/.test(tx.url)) {
      tx.api = true;
      if (tx.url.includes('/api/files/upload') && !tx.url.includes('upload-check')) {
        tx.uploadSummary = multipartSummary(tx.postData, tx.requestHeaders['Content-Type'] || tx.requestHeaders['content-type']);
        tx.postData = null;
      }
    }
  } else if (method === 'Network.responseReceived') {
    const tx = transactions.get(params.requestId);
    if (tx) {
      tx.response = {
        status: params.response.status,
        statusText: params.response.statusText,
        mimeType: params.response.mimeType,
        headers: safeHeaders(params.response.headers),
        fromDiskCache: params.response.fromDiskCache,
        fromServiceWorker: params.response.fromServiceWorker,
        protocol: params.response.protocol,
        remoteIPAddress: params.response.remoteIPAddress
      };
    }
    if (/\/api\/tasks(?:\?|$)/.test(params.response.url) && params.response.requestHeaders === undefined) {
      // no-op; kept for structure
    }
  } else if (method === 'Network.loadingFinished') {
    const tx = transactions.get(params.requestId);
    if (tx && tx.api && !tx.bodyRequested) {
      tx.bodyRequested = true;
      tx.body = await getBody(params.requestId);
    }
  } else if (method === 'Network.loadingFailed') {
    const tx = transactions.get(params.requestId);
    if (tx) tx.failed = { errorText: params.errorText, canceled: params.canceled, blockedReason: params.blockedReason };
  } else if (method === 'Page.frameNavigated') {
    navigations.push({ url: params.frame.url, timestamp: Date.now() });
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

async function waitFor(description, fn, timeoutMs = 45000, intervalMs = 500) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = String(e);
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timeout waiting for ${description}; last=${JSON.stringify(last)}`);
}

async function screenshot(path) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
}

const startedAt = new Date().toISOString();
const steps = [];
async function step(name, details = {}) {
  const rec = { name, at: Date.now(), ...details };
  steps.push(rec);
  return rec;
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Network.enable', {
    maxTotalBufferSize: 100_000_000,
    maxResourceBufferSize: 10_000_000,
    maxPostDataSize: 5_000_000
  });
  try { await send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) { /* older CDP */ }
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.setExtraHTTPHeaders', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
  await send('Network.clearBrowserCookies');
  try { await send('Network.clearBrowserCache'); } catch (e) { /* optional */ }
  try { await send('Storage.clearDataForOrigin', { origin: 'https://www.sejda.com', storageTypes: 'all' }); } catch (e) { /* optional */ }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
  });
  try { await send('Emulation.setLocaleOverride', { locale: 'en-US' }); } catch (e) { /* optional */ }
  try { await send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' }); } catch (e) { /* optional */ }
  try {
    await send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-motion', value: 'reduce' }
      ]
    });
  } catch (e) { /* optional */ }

  await step('navigate', { url: 'https://www.sejda.com/split-pdf' });
  await send('Page.navigate', { url: 'https://www.sejda.com/split-pdf' });
  await waitFor('document ready', async () => (await evalValue('document.readyState')) === 'complete', 45000);
  await sleep(3500);
  await step('page_loaded', {
    url: await evalValue('location.href'),
    title: await evalValue('document.title'),
    fileInputs: await evalValue(`document.querySelectorAll('input[type=file]').length`)
  });

  const fileInputResult = await send('Runtime.evaluate', {
    expression: "document.querySelector('input.fileupload')"
  });
  const objectId = fileInputResult.result?.objectId;
  if (!objectId) throw new Error('File input not found');
  await send('DOM.setFileInputFiles', { files: [SAMPLE], objectId });
  await step('file_selected', { sample: SAMPLE, bytes: fs.statSync(SAMPLE).size });

  await waitFor('upload completed and step2 visible', async () => {
    return await evalValue(`(() => {
      const s = document.querySelector('#step2Choices');
      const files = document.querySelectorAll('input[name="files[]"]').length;
      return Boolean(s && getComputedStyle(s).display !== 'none' && files > 0);
    })()`);
  }, 60000, 500);
  await step('upload_completed', {
    filesInputs: await evalValue(`Array.from(document.querySelectorAll('input[name="files[]"]')).map(x => x.value)`),
    step2Visible: await evalValue(`getComputedStyle(document.querySelector('#step2Choices')).display`),
    bodyText: (await evalValue('document.body.innerText')).slice(0, 800)
  });
  await screenshot(SHOT_READY);

  await evalValue(`document.querySelector('#step2ChoicesContinueBtn').click(); true`);
  await step('clicked_continue');
  await waitFor('split submit visible', async () => {
    return await evalValue(`(() => {
      const b = document.querySelector('#splitPdfByPagesSubmitBtn');
      return Boolean(b && b.offsetParent !== null);
    })()`);
  }, 45000, 500);
  await waitFor('page thumbnails rendered', async () => {
    return (await evalValue(`document.querySelectorAll('#pdf-canvas-list .pdf-page-wrap').length`)) > 0;
  }, 45000, 500);
  await step('ready_to_submit', {
    pages: await evalValue(`document.querySelectorAll('#pdf-canvas-list .pdf-page-wrap').length`),
    pagesValue: await evalValue(`document.querySelector('#specificPages')?.value || ''`),
    stepValue: await evalValue(`document.querySelector('#splitStep')?.value || ''`),
    submitText: await evalValue(`document.querySelector('#splitPdfByPagesSubmitBtn')?.innerText || ''`)
  });

  await evalValue(`document.querySelector('#splitPdfByPagesSubmitBtn').click(); true`);
  await step('clicked_submit');

  await waitFor('POST /api/tasks response', async () => {
    return Array.from(transactions.values()).some((t) =>
      t.method === 'POST' && /\/api\/tasks(?:\?|$)/.test(t.url) && t.response
    );
  }, 90000, 500);

  await sleep(2500);
  const taskTx = Array.from(transactions.values()).find((t) =>
    t.method === 'POST' && /\/api\/tasks(?:\?|$)/.test(t.url)
  );
  if (taskTx && taskTx.bodyRequested) {
    await waitFor('task response body', async () => taskTx.body !== null, 15000, 250);
  }
  await screenshot(SHOT_RESULT);
  await step('task_response', {
    url: await evalValue('location.href'),
    title: await evalValue('document.title'),
    bodyText: (await evalValue('document.body.innerText')).slice(0, 2500),
    taskStatus: taskTx?.response?.status ?? null,
    taskResponseBody: taskTx?.body?.body?.slice(0, 8000) ?? null
  });

  const apiTransactions = Array.from(transactions.values()).filter((t) => t.api);
  const serializable = apiTransactions.map((t) => ({
    requestId: t.requestId,
    url: t.url,
    method: t.method,
    resourceType: t.resourceType,
    requestHeaders: t.requestHeaders,
    hasPostData: t.hasPostData,
    postData: t.postData ? t.postData.slice(0, 20000) : null,
    uploadSummary: t.uploadSummary || null,
    response: t.response,
    body: t.body,
    failed: t.failed
  }));

  const out = {
    startedAt,
    finishedAt: new Date().toISOString(),
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
    sample: { path: SAMPLE, bytes: fs.statSync(SAMPLE).size, sha256: '5ef833b674aa0e691eb7b9b6a063402876500553997215eff905d786cf76d319' },
    steps,
    navigations,
    apiTransactions: serializable,
    console: consoleEvents,
    pageErrors
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({
    out: OUT,
    steps: steps.map((s) => s.name),
    api: serializable.map((t) => ({
      method: t.method,
      url: t.url,
      status: t.response?.status ?? null,
      hasPostData: t.hasPostData,
      postDataPreview: t.postData ? t.postData.slice(0, 300) : null,
      uploadSummary: t.uploadSummary,
      bodyPreview: t.body?.body ? t.body.body.slice(0, 500) : null,
      bodyError: t.body?.error || null
    })),
    console: consoleEvents.slice(-20),
    pageErrors: pageErrors.slice(-10)
  }, null, 2));
} catch (e) {
  const apiTransactions = Array.from(transactions.values()).filter((t) => t.api);
  const out = {
    startedAt,
    finishedAt: new Date().toISOString(),
    error: String(e),
    stack: e?.stack,
    target: { id: target.id, title: target.title, url: target.url },
    steps,
    navigations,
    apiTransactions: apiTransactions.map((t) => ({
      requestId: t.requestId,
      url: t.url,
      method: t.method,
      resourceType: t.resourceType,
      requestHeaders: t.requestHeaders,
      hasPostData: t.hasPostData,
      postData: t.postData ? t.postData.slice(0, 20000) : null,
      uploadSummary: t.uploadSummary || null,
      response: t.response,
      body: t.body,
      failed: t.failed
    })),
    console: consoleEvents,
    pageErrors
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.error(JSON.stringify({ error: String(e), out: OUT, steps: steps.map((s) => s.name), api: out.apiTransactions.map((t) => ({ method: t.method, url: t.url, status: t.response?.status ?? null })) }, null, 2));
  process.exitCode = 1;
} finally {
  try { ws.close(); } catch { /* ignore */ }
}
