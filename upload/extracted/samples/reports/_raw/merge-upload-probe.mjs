import fs from 'node:fs';

const CDP = 'http://127.0.0.1:9333';
const OUT = 'D:/small_editor/reports/_raw/merge-upload-probe.json';
const SHOT = 'D:/small_editor/reports/_raw/merge-upload-probe.png';
const FILES = [
  'D:/small_editor/samples/sample.pdf',
  'D:/small_editor/samples/sample-merge-b.pdf'
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
ws.addEventListener('message', (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }
  if (msg.id) {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    return;
  }
  if (msg.method === 'Network.requestWillBeSent') {
    const t = {
      requestId: msg.params.requestId,
      method: msg.params.request.method,
      url: msg.params.request.url,
      type: msg.params.type,
      headers: msg.params.request.headers,
      postData: msg.params.request.postData || null,
      response: null
    };
    tx.set(t.requestId, t);
  } else if (msg.method === 'Network.responseReceived') {
    const t = tx.get(msg.params.requestId);
    if (t) t.response = {
      status: msg.params.response.status,
      headers: msg.params.response.headers,
      mimeType: msg.params.response.mimeType
    };
  }
});
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
async function waitFor(description, fn, timeoutMs = 60000, intervalMs = 500) {
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
  fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
}

await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');
await send('Network.enable', { maxPostDataSize: 5_000_000 });
try { await send('Network.setBypassServiceWorker', { bypass: true }); } catch {}
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Network.setExtraHTTPHeaders', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
await send('Network.clearBrowserCookies');
try { await send('Storage.clearDataForOrigin', { origin: 'https://www.sejda.com', storageTypes: 'all' }); } catch {}
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
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

await send('Page.navigate', { url: 'https://www.sejda.com/merge-pdf' });
await waitFor('document ready', async () => (await evalValue('document.readyState')) === 'complete', 45000);
await sleep(3500);

const fileInput = await send('Runtime.evaluate', { expression: "document.querySelector('#fileUploadForm input[type=file]')" });
const objectId = fileInput.result?.objectId;
if (!objectId) throw new Error('No merge file input');
await send('DOM.setFileInputFiles', { files: FILES, objectId });

await waitFor('upload and step2', async () => {
  return await evalValue(`(() => {
    const s = document.querySelector('#step2Choices');
    const files = document.querySelectorAll('input[name="files[]"]').length;
    return Boolean(s && getComputedStyle(s).display !== 'none' && files >= 2);
  })()`);
}, 90000, 500);
await sleep(2500);
await screenshot(SHOT);

const dump = await evalValue(`(() => {
  const vis = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const buttons = Array.from(document.querySelectorAll('button, input[type=submit], a.btn')).map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    id: el.id || '',
    class: el.className || '',
    text: (el.innerText || el.value || '').trim().slice(0, 200),
    visible: vis(el),
    disabled: Boolean(el.disabled),
    onclick: el.getAttribute('onclick') || ''
  })).filter((x) => x.text);
  const taskForm = document.querySelector('form.task-form');
  return {
    url: location.href,
    title: document.title,
    step2Display: getComputedStyle(document.querySelector('#step2Choices')).display,
    files: Array.from(document.querySelectorAll('input[name="files[]"]')).map((x) => ({ name: x.name, value: x.value, id: x.id })),
    fileInputs: Array.from(document.querySelectorAll('input[type=file]')).map((x) => ({ id: x.id, name: x.name, accept: x.accept, multiple: x.multiple })),
    buttons,
    taskForm: taskForm ? {
      id: taskForm.id,
      class: taskForm.className,
      html: taskForm.outerHTML.slice(0, 20000),
      fields: Array.from(taskForm.querySelectorAll('input,select,textarea,button')).map((x) => ({
        tag: x.tagName.toLowerCase(),
        type: x.getAttribute('type') || '',
        name: x.name || '',
        id: x.id || '',
        value: x.value || '',
        text: (x.innerText || '').trim().slice(0, 100),
        visible: vis(x)
      }))
    } : null,
    bodyText: document.body.innerText.slice(0, 4000)
  };
})()`);

const api = Array.from(tx.values()).filter((t) => /\/api\//.test(t.url)).map((t) => ({
  method: t.method,
  url: t.url,
  status: t.response?.status ?? null,
  mime: t.response?.mimeType ?? null,
  postData: t.postData ? t.postData.slice(0, 1000) : null
}));
const out = {
  capturedAt: new Date().toISOString(),
  files: FILES,
  api,
  dump
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  out: OUT,
  screenshot: SHOT,
  api,
  step2Display: dump.step2Display,
  files: dump.files,
  taskFormId: dump.taskForm?.id,
  taskFormClass: dump.taskForm?.class,
  visibleButtons: dump.buttons.filter((b) => b.visible).map((b) => ({ id: b.id, class: b.class, text: b.text, type: b.type })),
  hiddenActionButtons: dump.buttons.filter((b) => !b.visible && /btn-default|btn-primary/.test(b.class)).map((b) => ({ id: b.id, class: b.class, text: b.text, type: b.type })),
  fields: dump.taskForm?.fields?.map((f) => ({ tag: f.tag, type: f.type, name: f.name, id: f.id, value: f.value, text: f.text, visible: f.visible })),
  bodyText: dump.bodyText.slice(0, 2000)
}, null, 2));
ws.close();
