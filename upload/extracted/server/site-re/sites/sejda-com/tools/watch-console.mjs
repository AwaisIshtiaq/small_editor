// Reload a page with console/exception/network-failure logging and print the events.
// Usage: node watch-console.mjs <targetId> [url] [seconds]
const endpoint = process.env.CDP || "http://127.0.0.1:9333";
const [targetId, url, seconds = "8"] = process.argv.slice(2);
const list = await (await fetch(`${endpoint}/json/list`)).json();
const target = list.find((t) => t.id === targetId);
if (!target) throw new Error("target not found");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const events = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === "Runtime.consoleAPICalled") events.push({ type: `console.${m.params.type}`, text: m.params.args.map(a => a.value ?? a.description ?? a.type).join(" ") });
  if (m.method === "Runtime.exceptionThrown") events.push({ type: "exception", text: m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text });
  if (m.method === "Log.entryAdded") events.push({ type: `log.${m.params.entry.level}`, text: `${m.params.entry.text} ${m.params.entry.url ?? ""}` });
  if (m.method === "Network.loadingFailed") events.push({ type: "net-fail", text: `${m.params.errorText} ${m.params.type}` });
};
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Page.enable");
if (url) await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
const state = await send("Runtime.evaluate", { expression: "JSON.stringify({ready:document.readyState,doc:document.querySelector('#docName')?.textContent,pages:document.querySelectorAll('.pdf-page').length,hasApi:!!window.smallEditor})", returnByValue: true });
console.log(JSON.stringify({ events, state: JSON.parse(state.result.value) }, null, 2));
ws.close();
