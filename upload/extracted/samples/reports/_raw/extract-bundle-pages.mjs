import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BUNDLE = 'D:/small_editor/reports/evidence/rea-bounded-pass.bundle.json';
const OUT_DIR = 'D:/small_editor/reports/_raw/static-pass/bundle-pages';
const CDP = 'http://127.0.0.1:9333';
const BASE = 'https://www.sejda.com';

fs.mkdirSync(OUT_DIR, { recursive: true });
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const slugify = (route) => route.replace(/^\/+/, '').replace(/[^a-z0-9._-]+/gi, '_') || 'home';

function sanitizeText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/([?&](?:_s|uplid)=)[^&"'<>\s]+/gi, '$1[redacted]')
    .replace(/(name=["']uplid["'][^>]*value=["'])[^"']*(["'])/gi, '$1[redacted]$2')
    .replace(/(name=["']_s["'][^>]*value=["'])[^"']*(["'])/gi, '$1[redacted]$2')
    .replace(/(value=["'][^"']*)(?:s=web-[^"'&]+)/gi, '$1s=[redacted]');
}

function sanitizeUrl(value) {
  if (typeof value !== 'string' || !value) return value;
  try {
    const url = new URL(value, BASE);
    for (const key of ['_s', 'uplid', 's']) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '[redacted]');
    }
    return url.toString();
  } catch {
    return sanitizeText(value);
  }
}

function extractParsed() {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const attrMap = (el) => {
    const out = {};
    for (const a of Array.from(el.attributes || [])) {
      if (a.name.startsWith('data-')) out[a.name] = a.value;
    }
    return out;
  };
  const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const field = (el) => {
    const type = (el.getAttribute('type') || el.tagName || '').toLowerCase();
    const name = el.getAttribute('name') || '';
    const sensitive = /^(uplid|_s|password|pwd|filepwd|email)$/i;
    const value = (type === 'password' || sensitive.test(name)) ? '[redacted]' : (el.getAttribute('value') ?? '');
    return {
      tag: el.tagName.toLowerCase(),
      type,
      name,
      id: el.id || '',
      class: el.className || '',
      value: String(value).slice(0, 500),
      placeholder: el.getAttribute('placeholder') || '',
      checked: el.hasAttribute('checked'),
      disabled: el.hasAttribute('disabled'),
      readOnly: el.hasAttribute('readonly'),
      min: el.getAttribute('min'),
      max: el.getAttribute('max'),
      step: el.getAttribute('step'),
      accept: el.getAttribute('accept'),
      multiple: el.hasAttribute('multiple'),
      options: el.tagName === 'SELECT'
        ? Array.from(el.options || []).map((o) => ({
            value: o.value,
            text: textOf(o),
            selected: o.selected
          }))
        : undefined,
      data: attrMap(el)
    };
  };
  const forms = Array.from(doc.querySelectorAll('form')).map((form) => ({
    id: form.id || '',
    class: form.className || '',
    name: form.getAttribute('name') || '',
    action: form.getAttribute('action') || '',
    method: (form.getAttribute('method') || '').toUpperCase(),
    enctype: form.getAttribute('enctype') || '',
    data: attrMap(form),
    fields: Array.from(form.querySelectorAll('input,select,textarea,button')).slice(0, 250).map(field)
  }));
  const fileInputs = Array.from(doc.querySelectorAll('input[type=file]')).map((el) => {
    const form = el.closest('form');
    return {
      ...field(el),
      formId: form?.id || '',
      formAction: form?.getAttribute('action') || '',
      formMethod: (form?.getAttribute('method') || '').toUpperCase(),
      formEnctype: form?.getAttribute('enctype') || ''
    };
  });
  const dataTask = Array.from(doc.querySelectorAll('[data-task]')).map((el) => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    class: el.className || '',
    name: el.getAttribute('name') || '',
    value: el.getAttribute('value') || '',
    task: el.getAttribute('data-task')
  }));
  const submits = Array.from(doc.querySelectorAll('button, input[type=submit], a.btn, .btn')).map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: (el.getAttribute('type') || '').toLowerCase(),
    id: el.id || '',
    class: el.className || '',
    text: (textOf(el) || el.getAttribute('value') || '').slice(0, 200),
    disabled: el.hasAttribute('disabled')
  })).filter((x) => x.text);
  const scripts = Array.from(doc.scripts).map((s) => ({
    src: s.src || s.getAttribute('src') || '',
    type: s.type || '',
    async: s.hasAttribute('async'),
    defer: s.hasAttribute('defer'),
    integrity: s.getAttribute('integrity') || '',
    inlineBytes: s.getAttribute('src') ? 0 : (s.textContent || '').length
  }));
  const bodyText = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    title: textOf(doc.querySelector('title')),
    lang: doc.documentElement.lang || '',
    canonical: doc.querySelector('link[rel=canonical]')?.getAttribute('href') || '',
    metaDescription: doc.querySelector('meta[name=description]')?.getAttribute('content') || '',
    h1: Array.from(doc.querySelectorAll('h1')).map(textOf).filter(Boolean),
    h2: Array.from(doc.querySelectorAll('h2')).map(textOf).filter(Boolean).slice(0, 20),
    dataTask,
    fileInputs,
    forms,
    submits: submits.slice(0, 80),
    scripts,
    bodyText: bodyText.slice(0, 30000),
    bodyTextLength: bodyText.length,
    bodyClasses: doc.body?.className || '',
    hasFileUploadForm: Boolean(doc.querySelector('#fileUploadForm')),
    hasStep2Choices: Boolean(doc.querySelector('#step2Choices')),
    hasTaskForm: Boolean(doc.querySelector('form.task-form')),
    hasDropZone: Boolean(doc.querySelector('.dropzone, #dropzone, .fileupload-button, .upload-button')),
    counts: {
      forms: doc.forms.length,
      fileInputs: doc.querySelectorAll('input[type=file]').length,
      dataTask: doc.querySelectorAll('[data-task]').length,
      buttons: doc.querySelectorAll('button').length,
      links: doc.querySelectorAll('a').length
    }
  };
}

const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));
const record = bundle.records.find(
  (r) => r.operation === 'capture_browser_scenario' &&
    r.normalized_result?.steps?.length === 18 &&
    r.parameters?.start_url?.url?.includes('/split-pdf')
);
if (!record) throw new Error('Could not find the 9-page capture record in the bundle');
const steps = record.normalized_result.steps;

const routeSteps = new Map();
routeSteps.set(new URL(record.parameters.start_url.url).pathname, steps.find((s) => s.step_id === 'scenario_start'));
for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  if (step.action === 'goto' && step.after_url?.url) {
    const route = new URL(step.after_url.url).pathname;
    const settle = steps[i + 1]?.action === 'wait_for_timeout' ? steps[i + 1] : step;
    routeSteps.set(route, settle);
  }
}

const pages = [];
for (const [route, step] of routeSteps) {
  const slug = slugify(route);
  const dom = step.artifacts?.dom?.value;
  const shot = step.artifacts?.screenshot?.value;
  if (!dom?.text) throw new Error(`No DOM for ${route}`);
  const html = sanitizeText(dom.text);
  const htmlBuf = Buffer.from(html, 'utf8');
  const shotBuf = shot?.data_base64 ? Buffer.from(shot.data_base64, 'base64') : null;
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), htmlBuf);
  if (shotBuf) fs.writeFileSync(path.join(OUT_DIR, `${slug}.png`), shotBuf);
  pages.push({
    route,
    slug,
    url: `${BASE}${route}`,
    step_id: step.step_id,
    step_index: step.step_index,
    capturedAt: step.after_url?.url ? new Date().toISOString() : new Date().toISOString(),
    htmlPath: `reports/_raw/static-pass/bundle-pages/${slug}.html`,
    htmlBytes: htmlBuf.length,
    htmlSha256: sha256(htmlBuf),
    screenshotPath: shotBuf ? `reports/_raw/static-pass/bundle-pages/${slug}.png` : null,
    screenshotBytes: shotBuf?.length || 0,
    screenshotSha256: shotBuf ? sha256(shotBuf) : null,
    title: null,
    dataTasks: [],
    fileInputs: [],
    taskFields: []
  });
}

const targets = await (await fetch(CDP + '/json')).json();
const target = targets.find((t) => t.type === 'page' && t.url.startsWith(BASE))
  || targets.find((t) => t.type === 'page');
if (!target) throw new Error('No page target on CDP endpoint');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (!msg.id) return;
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
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
await send('Runtime.enable');

for (const page of pages) {
  const pagePath = path.join('D:/small_editor', page.htmlPath);
  const html = fs.readFileSync(pagePath, 'utf8');
  const expression = `(() => {
    const html = ${JSON.stringify(html)};
    ${extractParsed.toString()}
    return extractParsed();
  })()`;
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  const parsed = JSON.parse(sanitizeText(JSON.stringify(r.result.value)));
  parsed.url = page.url;
  for (const f of parsed.forms || []) f.action = sanitizeUrl(f.action);
  for (const f of parsed.fileInputs || []) {
    f.formAction = sanitizeUrl(f.formAction);
    f.value = '[redacted]';
  }
  for (const s of parsed.scripts || []) s.src = sanitizeUrl(s.src);
  page.title = parsed.title;
  page.dataTasks = [...new Set((parsed.dataTask || []).map((x) => x.task).filter(Boolean))];
  page.fileInputs = (parsed.fileInputs || []).map((x) => ({
    accept: x.accept,
    multiple: x.multiple,
    id: x.id,
    name: x.name,
    formId: x.formId
  }));
  page.taskFields = Array.from(new Set((parsed.forms || [])
    .filter((f) => /task/i.test(f.class) || /task/i.test(f.id))
    .flatMap((f) => (f.fields || []).map((x) => x.name))
    .filter(Boolean)));
  page.forms = (parsed.forms || []).map((f) => ({
    id: f.id,
    class: f.class,
    method: f.method,
    enctype: f.enctype,
    action: f.action,
    fieldCount: f.fields?.length || 0
  }));
  page.submitTexts = Array.from(new Set((parsed.submits || [])
    .map((x) => x.text)
    .filter((t) => t && !/^[\uFFFD\s]+$/.test(t)))).slice(0, 30);
  page.pageScripts = (parsed.scripts || []).filter((s) => s.src && /\/js\/pages\//.test(s.src)).map((s) => s.src);
  page.scriptCount = (parsed.scripts || []).length;
  page.bodyTextLength = parsed.bodyTextLength;
  page.counts = parsed.counts;
  const pageJson = {
    ...parsed,
    capture: {
      source: 'rea-bounded-pass.bundle',
      evidence_id: record.evidence_id,
      step_id: page.step_id,
      route: page.route,
      capturedAt: page.capturedAt,
      environment: {
        viewport: '1440x900@1',
        locale: 'en-US',
        timezone: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        cache: 'default',
        loggedIn: false
      },
      htmlPath: page.htmlPath,
      htmlBytes: page.htmlBytes,
      htmlSha256: page.htmlSha256,
      screenshotPath: page.screenshotPath,
      screenshotBytes: page.screenshotBytes,
      screenshotSha256: page.screenshotSha256
    }
  };
  const jsonBuf = Buffer.from(JSON.stringify(pageJson, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, `${page.slug}.json`), jsonBuf);
  page.jsonPath = `reports/_raw/static-pass/bundle-pages/${page.slug}.json`;
  page.jsonBytes = jsonBuf.length;
  page.jsonSha256 = sha256(jsonBuf);
}

const summary = {
  source: 'rea-bounded-pass.bundle.json',
  evidence_id: record.evidence_id,
  scenario_sha256: record.parameters?.scenario_sha256,
  routeCount: pages.length,
  routes: pages
};
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
ws.close();
