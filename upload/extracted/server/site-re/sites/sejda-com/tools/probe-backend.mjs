// Passive backend fingerprint probe.
// Loads the public editor page in a fresh tab, records response headers (names only
// for cookies), cookies, and a few benign GET responses. Does not authenticate or mutate.
import fs from "node:fs";

const CDP = process.env.CDP || "http://127.0.0.1:9333";
const created = await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(created.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method) {
    events.push(msg);
  }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

const interesting = (name) =>
  /^(server|via|x-powered-by|x-application-context|x-request-id|x-runtime|x-served-by|x-cache|content-type|set-cookie|cf-ray|cf-cache-status|location|www-authenticate)$/i.test(name);

await send("Network.enable");
await send("Page.enable");
await send("Page.navigate", { url: "https://www.sejda.com/pdf-editor" });
await new Promise((r) => setTimeout(r, 7000));

const evalValue = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.text };
  return r.result?.value;
};

const fetchProbe = async (path) => {
  return await evalValue(`(async () => {
    try {
      const r = await fetch(${JSON.stringify(path)}, { redirect: "manual", credentials: "omit" });
      const text = await r.text();
      const headers = {};
      for (const [k, v] of r.headers) headers[k] = v;
      return { status: r.status, type: r.type, headers, body: text.slice(0, 800) };
    } catch (error) { return { error: String(error) }; }
  })()`);
};

const pages = {};
for (const path of ["/", "/pdf-editor", "/this-page-does-not-exist-9f2c", "/api/files", "/api/tasks"]) {
  pages[path] = await fetchProbe(path);
}

const doc = await evalValue(`(() => ({
  title: document.title,
  generator: document.querySelector('meta[name="generator"]')?.content || null,
  scripts: [...document.scripts].map(s => s.src).filter(Boolean).slice(0, 40),
  cookie: document.cookie ? document.cookie.split(';').map(x => x.split('=')[0].trim()) : [],
  origin: location.origin
}))()`);

const allCookies = await send("Network.getAllCookies");

const responses = [];
const seen = new Set();
for (const ev of events) {
  if (ev.method !== "Network.responseReceived" && ev.method !== "Network.responseReceivedExtraInfo") continue;
  const p = ev.params;
  const url = p.response?.url || events.find((e) => e.method === "Network.requestWillBeSent" && e.params.requestId === p.requestId)?.params.request.url || null;
  if (!url) continue;
  if (seen.has(ev.method + url + (p.statusCode || p.response?.status))) continue;
  seen.add(ev.method + url + (p.statusCode || p.response?.status));
  const raw = p.response?.headers || p.headers || {};
  const headerNames = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!interesting(k)) continue;
    if (k.toLowerCase() === "set-cookie") {
      headerNames[k] = String(v).split(/,(?=[^;]+=)/).map((c) => c.split("=")[0].trim());
    } else {
      headerNames[k] = v;
    }
  }
  responses.push({
    kind: ev.method,
    url,
    status: p.statusCode || p.response?.status || null,
    mimeType: p.response?.mimeType || null,
    headers: headerNames,
  });
}

const out = {
  captured_at: new Date().toISOString(),
  target: "https://www.sejda.com/pdf-editor",
  method: "fresh CDP tab, Network.enable, navigate, then same-origin fetch probes; cookies recorded by name/flags only",
  document: doc,
  cookies: allCookies.cookies.map((c) => ({
    name: c.name, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
    session: c.session, expires: c.expires,
  })),
  pages,
  responses,
};
fs.writeFileSync("raw/backend-probe.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  document: doc,
  cookies: out.cookies.map((c) => `${c.name} (${c.domain}, httpOnly=${c.httpOnly})`),
  pageStatuses: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, v.status ?? v.error])),
  responseHosts: [...new Set(responses.map((r) => { try { return new URL(r.url).host; } catch { return r.url; } }))],
  apiResponses: responses.filter((r) => r.url.includes("/api/")).slice(0, 10),
}, null, 2));

await fetch(`${CDP}/json/close/${created.id}`);
ws.close();
