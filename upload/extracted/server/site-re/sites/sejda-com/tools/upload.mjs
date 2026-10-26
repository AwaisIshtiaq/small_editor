// Set a local file on an <input type=file> through CDP, then report the resulting page state.
// Usage: node upload.mjs <targetId> <cssSelector> <filePath>
const endpoint = process.env.CDP || "http://127.0.0.1:9333";
const [targetId, selector, filePath] = process.argv.slice(2);
const list = await (await fetch(`${endpoint}/json/list`)).json();
const target = list.find((t) => t.id === targetId);
if (!target) throw new Error("target not found");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
await send("DOM.enable");
const { root } = await send("DOM.getDocument", { depth: -1 });
const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector });
if (!nodeId) throw new Error(`selector not found: ${selector}`);
await send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
console.log(JSON.stringify({ ok: true, selector, filePath }));
ws.close();
