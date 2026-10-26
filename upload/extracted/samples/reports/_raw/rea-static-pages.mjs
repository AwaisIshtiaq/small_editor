import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CDP = 'http://127.0.0.1:9333';
const OUT_DIR = 'D:/small_editor/reports/_raw/static-pass';
const PAGES_DIR = path.join(OUT_DIR, 'pages');
const ALL_ROUTES = [
  'compress-pdf',
  'pdf-editor',
  'crop-pdf',
  'organize-pdf',
  'split-pdf-down-the-middle',
  'split-pdf-by-text',
  'sign-pdf',
  'pdf-forms',
  'delete-pdf-pages',
  'encrypt-pdf',
  'unlock-pdf',
  'watermark-pdf',
  'flatten-pdf',
  'pdf-to-excel',
  'pdf-to-ppt',
  'extract-text-from-pdf',
  'pdf-to-word',
  'html-to-pdf',
  'jpg-to-pdf',
  'word-to-pdf',
  'bates-numbering-pdf',
  'pdf-bookmarks',
  'edit-pdf-metadata',
  'extract-images-from-pdf',
  'flip-pdf',
  'grayscale-pdf',
  'n-up-pdf',
  'page-numbers-pdf',
  'rename-pdf',
  'repair-pdf',
  'resize-pdf',
  'delete-pdf-annotations',
  'deskew-pdf',
  'ocr-pdf',
  'workflows'
];
const ROUTE_FILTER = (process.env.ROUTES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ROUTES = ROUTE_FILTER.length
  ? ROUTE_FILTER.map((route) => route.replace(/^\/+/, ''))
  : ALL_ROUTES;

fs.mkdirSync(PAGES_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function sanitizeText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/([?&](?:_s|uplid)=)[^&"'<>\s]+/gi, '$1[redacted]')
    .replace(/(name=["']uplid["'][^>]*value=["'])[^"']*(["'])/gi, '$1[redacted]$2')
    .replace(/(name=["']_s["'][^>]*value=["'])[^"']*(["'])/gi, '$1[redacted]$2');
}

function sanitizeUrl(value) {
  if (typeof value !== 'string' || !value) return value;
  try {
    const url = new URL(value, 'https://www.sejda.com');
    for (const key of ['_s', 'uplid']) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '[redacted]');
    }
    return url.toString();
  } catch {
    return sanitizeText(value);
  }
}

function extractPage() {
  const attrMap = (el) => {
    const out = {};
    for (const a of Array.from(el.attributes || [])) {
      if (a.name.startsWith('data-')) out[a.name] = a.value;
    }
    return out;
  };
  const sensitive = /^(uplid|_s|password|pwd|filepwd|email)$/i;
  const field = (el) => {
    const type = (el.getAttribute('type') || el.tagName || '').toLowerCase();
    const name = el.getAttribute('name') || '';
    const value = (type === 'password' || sensitive.test(name)) ? '[redacted]' : (el.value ?? '');
    const options = el.tagName === 'SELECT'
      ? Array.from(el.options || []).map((o) => ({
          value: o.value,
          text: (o.textContent || '').trim(),
          selected: o.selected
        }))
      : undefined;
    return {
      tag: el.tagName.toLowerCase(),
      type,
      name,
      id: el.id || '',
      class: el.className || '',
      value: value.length > 500 ? value.slice(0, 500) : value,
      placeholder: el.getAttribute('placeholder') || '',
      checked: Boolean(el.checked),
      disabled: Boolean(el.disabled),
      readOnly: Boolean(el.readOnly),
      min: el.getAttribute('min'),
      max: el.getAttribute('max'),
      step: el.getAttribute('step'),
      accept: el.getAttribute('accept'),
      multiple: el.hasAttribute('multiple'),
      options,
      data: attrMap(el)
    };
  };
  const visible = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const forms = Array.from(document.querySelectorAll('form')).map((form) => ({
    id: form.id || '',
    class: form.className || '',
    name: form.getAttribute('name') || '',
    action: form.getAttribute('action') || '',
    method: (form.getAttribute('method') || '').toUpperCase(),
    enctype: form.getAttribute('enctype') || '',
    visible: visible(form),
    data: attrMap(form),
    fields: Array.from(form.querySelectorAll('input,select,textarea,button')).slice(0, 250).map(field)
  }));
  const fileInputs = Array.from(document.querySelectorAll('input[type=file]')).map((el) => {
    const form = el.closest('form');
    return {
      ...field(el),
      formId: form?.id || '',
      formAction: form?.getAttribute('action') || '',
      formMethod: (form?.getAttribute('method') || '').toUpperCase(),
      formEnctype: form?.getAttribute('enctype') || ''
    };
  });
  const dataTask = Array.from(document.querySelectorAll('[data-task]')).map((el) => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    class: el.className || '',
    name: el.getAttribute('name') || '',
    value: el.getAttribute('value') || '',
    task: el.getAttribute('data-task'),
    visible: visible(el)
  }));
  const submits = Array.from(document.querySelectorAll('button, input[type=submit], a.btn, .btn')).map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: (el.getAttribute('type') || '').toLowerCase(),
    id: el.id || '',
    class: el.className || '',
    text: (el.innerText || el.value || '').trim().slice(0, 200),
    visible: visible(el),
    disabled: Boolean(el.disabled)
  })).filter((x) => x.text);
  const scripts = Array.from(document.scripts).map((s) => ({
    src: s.src || '',
    type: s.type || '',
    async: Boolean(s.async),
    defer: Boolean(s.defer),
    integrity: s.integrity || '',
    inlineBytes: s.src ? 0 : (s.textContent || '').length
  }));
  const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  return {
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    lang: document.documentElement.lang || '',
    canonical: document.querySelector('link[rel=canonical]')?.href || '',
    metaDescription: document.querySelector('meta[name=description]')?.content || '',
    h1: Array.from(document.querySelectorAll('h1')).map((x) => (x.innerText || '').trim()).filter(Boolean),
    h2: Array.from(document.querySelectorAll('h2')).map((x) => (x.innerText || '').trim()).filter(Boolean).slice(0, 20),
    dataTask,
    fileInputs,
    forms,
    submits: submits.slice(0, 80),
    scripts,
    bodyText: bodyText.slice(0, 30000),
    bodyTextLength: bodyText.length,
    bodyClasses: document.body?.className || '',
    hasFileUploadForm: Boolean(document.querySelector('#fileUploadForm')),
    hasStep2Choices: Boolean(document.querySelector('#step2Choices')),
    hasTaskForm: Boolean(document.querySelector('form.task-form')),
    hasDropZone: Boolean(document.querySelector('.dropzone, #dropzone, .fileupload-button, .upload-button')),
    counts: {
      forms: document.forms.length,
      fileInputs: document.querySelectorAll('input[type=file]').length,
      dataTask: document.querySelectorAll('[data-task]').length,
      buttons: document.querySelectorAll('button').length,
      links: document.querySelectorAll('a').length
    }
  };
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
const consoleEvents = [];
const pageErrors = [];
const navigations = [];

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

ws.addEventListener('message', (ev) => {
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
  if (method === 'Page.frameNavigated') {
    navigations.push({ url: params.frame.url, timestamp: Date.now() });
  } else if (method === 'Runtime.consoleAPICalled') {
    consoleEvents.push({
      type: params.type,
      text: (params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 500),
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

async function screenshot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(file, buf);
  return { bytes: buf.length, sha256: sha256(buf) };
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
try { await send('Network.setBypassServiceWorker', { bypass: true }); } catch { /* optional */ }
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Network.setExtraHTTPHeaders', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
try { await send('Emulation.setLocaleOverride', { locale: 'en-US' }); } catch { /* optional */ }
try { await send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' }); } catch { /* optional */ }
try {
  await send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'reduce' }
    ]
  });
} catch { /* optional */ }

const startedAt = new Date().toISOString();
const results = [];
const extractExpr = '(' + extractPage.toString() + ')()';

for (let i = 0; i < ROUTES.length; i++) {
  const route = ROUTES[i];
  const url = `https://www.sejda.com/${route}`;
  const slug = route.replace(/[^a-z0-9._-]+/gi, '_');
  const record = {
    index: i + 1,
    route,
    requestedUrl: url,
    startedAt: new Date().toISOString(),
    status: 'pending'
  };
  try {
    console.log(`[${i + 1}/${ROUTES.length}] ${route}`);
    await send('Page.navigate', { url });
    await waitFor('document ready', async () => (await evalValue('document.readyState')) === 'complete', 60000);
    await sleep(3000);
    await evalValue('window.scrollTo(0, 0); true');

    const page = await evalValue(extractExpr);
    const html = sanitizeText(await evalValue('document.documentElement.outerHTML'));
    const shot = await screenshot(path.join(PAGES_DIR, `${slug}.png`));
    const htmlBuf = Buffer.from(html, 'utf8');

    const sanitized = JSON.parse(sanitizeText(JSON.stringify(page)));
    sanitized.url = sanitizeUrl(sanitized.url);
    for (const f of sanitized.forms || []) f.action = sanitizeUrl(f.action);
    for (const f of sanitized.fileInputs || []) {
      f.formAction = sanitizeUrl(f.formAction);
      f.value = '[redacted]';
    }
    for (const s of sanitized.scripts || []) s.src = sanitizeUrl(s.src);

    const pagePath = `reports/_raw/static-pass/pages/${slug}.json`;
    const htmlPath = `reports/_raw/static-pass/pages/${slug}.html`;
    const pngPath = `reports/_raw/static-pass/pages/${slug}.png`;
    const pageJson = {
      ...sanitized,
      capture: {
        route,
        requestedUrl: url,
        capturedAt: new Date().toISOString(),
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
        htmlPath,
        htmlBytes: htmlBuf.length,
        htmlSha256: sha256(htmlBuf),
        screenshotPath: pngPath,
        screenshotBytes: shot.bytes,
        screenshotSha256: shot.sha256
      }
    };
    const jsonBuf = Buffer.from(JSON.stringify(pageJson, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, 'pages', `${slug}.json`), jsonBuf);
    fs.writeFileSync(path.join(OUT_DIR, 'pages', `${slug}.html`), htmlBuf);

    record.status = 'captured';
    record.finalUrl = sanitized.url;
    record.title = sanitized.title;
    record.h1 = sanitized.h1;
    record.dataTasks = [...new Set((sanitized.dataTask || []).map((x) => x.task).filter(Boolean))];
    record.fileInputs = (sanitized.fileInputs || []).map((x) => ({
      accept: x.accept,
      multiple: x.multiple,
      id: x.id,
      name: x.name,
      formId: x.formId
    }));
    record.taskFields = Array.from(new Set((sanitized.forms || [])
      .filter((f) => /task/i.test(f.class) || /task/i.test(f.id))
      .flatMap((f) => (f.fields || []).map((x) => x.name))
      .filter(Boolean)));
    record.forms = (sanitized.forms || []).map((f) => ({
      id: f.id,
      class: f.class,
      method: f.method,
      enctype: f.enctype,
      action: f.action,
      visible: f.visible,
      fieldCount: f.fields?.length || 0
    }));
    record.pageScripts = (sanitized.scripts || []).filter((s) => s.src && /\/js\/pages\//.test(s.src)).map((s) => s.src);
    record.scriptCount = (sanitized.scripts || []).length;
    record.bodyTextLength = sanitized.bodyTextLength;
    record.htmlBytes = htmlBuf.length;
    record.htmlSha256 = pageJson.capture.htmlSha256;
    record.screenshotBytes = shot.bytes;
    record.screenshotSha256 = shot.sha256;
    record.jsonBytes = jsonBuf.length;
    record.jsonSha256 = sha256(jsonBuf);
    record.challenge = /Just a moment|Attention Required|Enable JavaScript and cookies|Access denied|403 Forbidden/i
      .test(`${sanitized.title} ${sanitized.bodyText || ''}`);
    record.finishedAt = new Date().toISOString();
  } catch (e) {
    record.status = 'error';
    record.error = String(e?.stack || e);
    record.finishedAt = new Date().toISOString();
    console.error(`  ERROR ${route}: ${record.error}`);
  }
  results.push(record);
  await sleep(1500);
}

const summary = {
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
  routesAttempted: ROUTES.length,
  captured: results.filter((r) => r.status === 'captured').length,
  errors: results.filter((r) => r.status === 'error').length,
  challenges: results.filter((r) => r.challenge).length,
  results,
  console: consoleEvents.slice(-100),
  pageErrors: pageErrors.slice(-50),
  navigations
};
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

const manifest = [
  'route,status,final_url,title,data_tasks,file_inputs,task_fields,html_bytes,html_sha256,screenshot_bytes,screenshot_sha256,json_bytes,json_sha256'
];
for (const r of results) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  manifest.push([
    r.route, r.status, r.finalUrl || '', r.title || '',
    (r.dataTasks || []).join('|'), (r.fileInputs || []).map((x) => x.accept || x.name || '').join('|'),
    (r.taskFields || []).join('|'), r.htmlBytes || '', r.htmlSha256 || '',
    r.screenshotBytes || '', r.screenshotSha256 || '', r.jsonBytes || '', r.jsonSha256 || ''
  ].map(esc).join(','));
}
fs.writeFileSync(path.join(OUT_DIR, 'manifest.csv'), manifest.join('\n') + '\n');

console.log(JSON.stringify({
  out: OUT_DIR,
  attempted: summary.routesAttempted,
  captured: summary.captured,
  errors: summary.errors,
  challenges: summary.challenges,
  results: results.map((r) => ({
    route: r.route,
    status: r.status,
    dataTasks: r.dataTasks,
    fileInputs: r.fileInputs,
    taskFields: r.taskFields,
    error: r.error || undefined
  }))
}, null, 2));
ws.close();
