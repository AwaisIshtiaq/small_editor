import fs from 'node:fs';

const CDP = 'http://127.0.0.1:9333';
const ROUTE = process.argv[2] || 'header-footer-pdf';
const SAMPLE = 'D:/small_editor/samples/sample.pdf';
const OUT = `D:/small_editor/reports/_raw/${ROUTE}-probe.json`;
const SHOT = `D:/small_editor/reports/_raw/${ROUTE}-probe.png`;
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
    tx.set(msg.params.requestId, {
      method: msg.params.request.method,
      url: msg.params.request.url,
      type: msg.params.type,
      postData: msg.params.request.postData || null,
      response: null
    });
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
    }, 60000);
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
  fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
}

await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');
await send('Network.enable', { maxPostDataSize: 5_000_000 });
try { await send('Network.setBypassServiceWorker', { bypass: true }); } catch {}
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Network.setExtraHTTPHeaders', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
// Deliberately do NOT clear cookies/storage: preserve the same free-tier client session.
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

const url = `https://www.sejda.com/${ROUTE}`;
await send('Page.navigate', { url });
await waitFor('document ready', async () => (await evalValue('document.readyState')) === 'complete', 45000);
await sleep(3500);

const inputBefore = await evalValue(`(() => {
  const i = document.querySelector('#fileUploadForm input[type=file]');
  return i ? { id: i.id, accept: i.accept, multiple: i.multiple } : null;
})()`);
if (!inputBefore) throw new Error('No #fileUploadForm input');
const obj = await send('Runtime.evaluate', { expression: "document.querySelector('#fileUploadForm input[type=file]')" });
await send('DOM.setFileInputFiles', { files: [SAMPLE], objectId: obj.result.objectId });

await waitFor('file upload state', async () => {
  return await evalValue(`(() => {
    const files = document.querySelectorAll('input[name="files[]"]').length;
    const step2 = document.querySelector('#step2Choices');
    const tf = document.querySelector('form.task-form');
    return files >= 1 || (step2 && getComputedStyle(step2).display !== 'none') || Boolean(tf && tf.offsetParent !== null);
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
  const step2 = document.querySelector('#step2Choices');
  return {
    url: location.href,
    title: document.title,
    step2: step2 ? { display: getComputedStyle(step2).display, html: step2.outerHTML.slice(0, 30000) } : null,
    files: Array.from(document.querySelectorAll('input[name="files[]"]')).map((x) => ({ name: x.name, value: x.value, id: x.id })),
    fileInputs: Array.from(document.querySelectorAll('input[type=file]')).map((x) => ({ id: x.id, name: x.name, accept: x.accept, multiple: x.multiple })),
    buttons,
    taskForm: taskForm ? {
      id: taskForm.id,
      class: taskForm.className,
      html: taskForm.outerHTML.slice(0, 30000),
      fields: Array.from(taskForm.querySelectorAll('input,select,textarea,button')).map((x) => ({
        tag: x.tagName.toLowerCase(),
        type: x.getAttribute('type') || '',
        name: x.name || '',
        id: x.id || '',
        value: x.value || '',
        placeholder: x.getAttribute('placeholder') || '',
        text: (x.innerText || '').trim().slice(0, 150),
        visible: vis(x),
        checked: Boolean(x.checked),
        options: x.tagName === 'SELECT' ? Array.from(x.options).map((o) => ({ value: o.value, text: o.text })) : undefined
      }))
    } : null,
    bodyText: document.body.innerText.slice(0, 6000)
  };
})()`);

const api = Array.from(tx.values())
  .filter((t) => /\/api\//.test(t.url))
  .map((t) => ({
    method: t.method,
    url: t.url,
    status: t.response?.status ?? null,
    mime: t.response?.mimeType ?? null,
    postData: t.postData ? t.postData.slice(0, 1200) : null
  }));
const out = {
  capturedAt: new Date().toISOString(),
  route: ROUTE,
  target: { id: target.id, title: target.title, url: target.url },
  inputBefore,
  api,
  dump
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  out: OUT,
  screenshot: SHOT,
  api,
  step2Display: dump.step2?.display ?? null,
  files: dump.files,
  taskFormId: dump.taskForm?.id,
  taskFormClass: dump.taskForm?.class,
  visibleButtons: dump.buttons.filter((b) => b.visible).map((b) => ({ id: b.id, class: b.class, text: b.text, type: b.type, disabled: b.disabled })),
  hiddenActionButtons: dump.buttons.filter((b) => !b.visible && /btn-default|btn-primary/.test(b.class)).map((b) => ({ id: b.id, class: b.class, text: b.text, type: b.type })),
  fields: dump.taskForm?.fields?.map((f) => ({ tag: f.tag, type: f.type, name: f.name, id: f.id, value: f.value, placeholder: f.placeholder, text: f.text, visible: f.visible, checked: f.checked, options: f.options })),
  bodyText: dump.bodyText.slice(0, 3000)
}, null, 2));
ws.close();
