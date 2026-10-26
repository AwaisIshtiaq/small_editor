import fs from 'node:fs';

const CDP = 'http://127.0.0.1:9333';
const TRACE = 'D:/small_editor/reports/_raw/pdf-to-jpg-task-network.json';
const ZIP = 'D:/small_editor/reports/_raw/pdf-to-jpg-result.zip';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const d = JSON.parse(fs.readFileSync(TRACE, 'utf8'));
const change = d.change.parsed;
if (!change?.resultFullUrlPattern || !change?.resultFilename) throw new Error('No completed result in trace');
const filename = change.resultFilename;
let url = change.resultFullUrlPattern
  .replace('%7B%7Bfilename%7D%7D', encodeURIComponent(filename))
  .replace('{{filename}}', encodeURIComponent(filename))
  .replace(/^www\./, 'https://www.');
console.log('download_url', url.replace(/([?&](?:_s|s|uplid)=)[^&]+/gi, '$1[redacted]'));

const targets = await (await fetch(CDP + '/json')).json();
const target = targets.find((t) => t.type === 'page' && t.url.includes('/pdf-to-jpg'))
  || targets.find((t) => t.type === 'page');
if (!target) throw new Error('No page target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }
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
await send('Page.enable');
await send('Runtime.enable');
const dl = await evalValue(`(async () => {
  const res = await fetch(${JSON.stringify(url)}, { credentials: 'include', cache: 'no-store' });
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers),
    base64: btoa(bin),
    bytes: bytes.length,
    magic: Array.from(bytes.subarray(0, 8))
  };
})()`);
const buf = Buffer.from(dl.base64, 'base64');
fs.writeFileSync(ZIP, buf);
console.log(JSON.stringify({
  status: dl.status,
  headers: dl.headers,
  bytes: dl.bytes,
  magic: Buffer.from(dl.magic).toString(),
  path: ZIP
}, null, 2));
ws.close();
