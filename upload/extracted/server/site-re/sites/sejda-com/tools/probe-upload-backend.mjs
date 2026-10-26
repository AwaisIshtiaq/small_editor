// Upload the tiny local fixture through the public editor UI and record the API
// responses/cookies. No conversion is started; this is the same action a user takes
// when choosing a file. Cookie values are never written, only names and flags.
import fs from "node:fs";

const CDP = process.env.CDP || "http://127.0.0.1:9333";
const file = process.argv[2] || "D:/small_editor/samples/sample.pdf";
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
  } else if (msg.method) events.push(msg);
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send("Network.enable");
await send("Page.enable");
await send("DOM.enable");
await send("Page.navigate", { url: "https://www.sejda.com/pdf-editor" });
await new Promise((r) => setTimeout(r, 7000));

const { root } = await send("DOM.getDocument", { depth: -1 });
const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input.fileupload" });
if (!nodeId) throw new Error("file input not found");
await send("DOM.setFileInputFiles", { nodeId, files: [file] });

// Wait for the upload request(s).
await new Promise((r) => setTimeout(r, 12000));

const urlByRequest = new Map();
for (const ev of events) {
  if (ev.method === "Network.requestWillBeSent") {
    urlByRequest.set(ev.params.requestId, ev.params.request.url);
  }
}
const reqIds = new Map();
for (const ev of events) {
  if (ev.method !== "Network.responseReceived") continue;
  const url = ev.params.response.url;
  if (!url.includes("/api/")) continue;
  reqIds.set(url, ev.params.requestId);
}

const bodies = {};
for (const [url, requestId] of reqIds) {
  try {
    const b = await send("Network.getResponseBody", { requestId });
    bodies[url] = (b.base64Decoded ? Buffer.from(b.body, "base64").toString("utf8") : b.body).slice(0, 1200);
  } catch (error) {
    bodies[url] = `body unavailable: ${String(error).slice(0, 120)}`;
  }
}

const responses = [];
for (const ev of events) {
  if (!["Network.responseReceived", "Network.responseReceivedExtraInfo"].includes(ev.method)) continue;
  const p = ev.params;
  const url = p.response?.url || urlByRequest.get(p.requestId) || null;
  if (!url || !url.includes("/api/")) continue;
  const h = p.response?.headers || p.headers || {};
  const keep = {};
  for (const [k, v] of Object.entries(h)) {
    if (!/^(server|via|x-powered-by|x-application-context|x-request-id|content-type|set-cookie|cf-ray|cf-cache-status|location|www-authenticate)$/i.test(k)) continue;
    keep[k] = k.toLowerCase() === "set-cookie"
      ? String(v).split(/,(?=[^;]+=)/).map((c) => ({ name: c.split("=")[0].trim(), attributes: c.split(";").slice(1).map((x) => x.trim()) }))
      : v;
  }
  responses.push({ kind: ev.method, url, status: p.statusCode || p.response?.status || null, headers: keep });
}

const cookies = await send("Network.getAllCookies");
const summary = await send("Runtime.evaluate", {
  expression: `(() => ({
    title: document.title,
    docName: document.querySelector('#docName')?.textContent || null,
    taskIds: [...document.querySelectorAll('[data-task-id]')].map(x => x.getAttribute('data-task-id')).slice(0,5),
    bodyHasError: /error|failed|wrong/i.test(document.body.innerText.slice(0, 2000))
  }))()`,
  returnByValue: true,
});

const out = {
  captured_at: new Date().toISOString(),
  target: "https://www.sejda.com/pdf-editor",
  file,
  method: "fresh CDP tab -> Network.enable -> navigate -> DOM.setFileInputFiles(input.fileupload) -> wait 12s",
  page: summary.result?.value,
  api_responses: responses,
  api_bodies: bodies,
  cookies: cookies.cookies.map((c) => ({ name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite, session: c.session })),
};
fs.writeFileSync("raw/upload-probe.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ page: out.page, api: responses, bodies, cookies: out.cookies.map((c) => c.name) }, null, 2));

await fetch(`${CDP}/json/close/${created.id}`);
ws.close();
