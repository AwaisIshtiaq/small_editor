// Dump a loaded page resource through CDP (bypasses edge bot filtering because the browser already fetched it).
// Usage: node dump-resource.mjs <targetId> <url> <outFile>
const endpoint = process.env.CDP || "http://127.0.0.1:9333";
const [targetId, url, outFile] = process.argv.slice(2);
const fs = await import("node:fs");
const list = await (await fetch(`${endpoint}/json/list`)).json();
const target = list.find((t) => t.id === targetId);
if (!target) throw new Error("target not found");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
await send("Page.enable");
const { frameTree } = await send("Page.getFrameTree");
const res = await send("Page.getResourceContent", { frameId: frameTree.frame.id, url });
fs.writeFileSync(outFile, res.content, res.base64Encoded ? "base64" : "utf8");
console.log(JSON.stringify({ url, bytes: res.content.length, base64: res.base64Encoded, outFile }));
ws.close();
