// Fetch a URL *inside* the already-loaded page (shares its cookies/TLS/UA) and save the body.
// Usage: node fetch-in-page.mjs <targetId> <url> <outFile> [as=buffer]
const endpoint = process.env.CDP || "http://127.0.0.1:9333";
const [targetId, url, outFile, as] = process.argv.slice(2);
const fs = await import("node:fs");
const list = await (await fetch(`${endpoint}/json/list`)).json();
const target = list.find((t) => t.id === targetId);
if (!target) throw new Error("target not found");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
const expr = `(async()=>{const r=await fetch(${JSON.stringify(url)},{credentials:'include'});const b=await r.arrayBuffer();const u=new Uint8Array(b);let s='';for(let i=0;i<u.length;i+=8192){s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));}const bin=btoa(s);return {status:r.status,headers:Object.fromEntries(r.headers),bytes:u.length,contentType:r.headers.get('content-type')||'',base64:${as === "buffer" ? "true" : "false"},text:${as === "buffer" ? "''" : "new TextDecoder().decode(u)"}};})()`;
const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
const v = r.result?.value;
if (!v) throw new Error(JSON.stringify(r));
if (as === "buffer") fs.writeFileSync(outFile, Buffer.from(v.base64, "base64"));
else fs.writeFileSync(outFile, v.text);
console.log(JSON.stringify({ url, status: v.status, bytes: v.bytes, contentType: v.contentType, outFile }));
ws.close();
