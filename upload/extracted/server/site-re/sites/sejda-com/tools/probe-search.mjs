// Probe sejda.com "All Tools" search at runtime through CDP.
// Usage: node probe-search.mjs <targetId>
const endpoint = process.env.CDP || "http://127.0.0.1:9333";
const targetId = process.argv[2];
const fs = await import("node:fs");
const path = await import("node:path");
const outDir = path.resolve(import.meta.dirname, "..", "captures");
fs.mkdirSync(outDir, { recursive: true });

const list = await (await fetch(`${endpoint}/json/list`)).json();
const target = list.find((t) => t.id === targetId);
if (!target) throw new Error("target not found");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
const evalv = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
};
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(outDir, name), Buffer.from(r.data, "base64"));
};

await send("Page.enable");
await evalv(`location.href='https://www.sejda.com/'`);
await new Promise((r) => setTimeout(r, 4000));

// inventory of the mega menu before any interaction
const inventory = await evalv(`(()=>{
  const menu=document.querySelector('#megaMenu');
  const cols=[...menu.querySelectorAll('.tasks-container > .row:first-child > .col')];
  return {
    title: document.title,
    url: location.href,
    headerTools: [...document.querySelectorAll('header a.header-tool')].map(a=>a.textContent.trim()),
    categories: cols.map(col=>{
      const headers=[...col.querySelectorAll('li.header')].map(h=>h.textContent.trim());
      const tools=[...col.querySelectorAll('li:not(.header) a')].map(a=>({caption:a.querySelector('.caption')?.textContent.trim()||a.textContent.trim(), description:a.querySelector('.description')?.textContent.trim()||'', href:a.getAttribute('href')}));
      return {headers, tools};
    }),
    searchInput: (()=>{const el=document.querySelector('#searchTools'); const w=el?.closest('.search-tools-wrap'); return el?{placeholder:el.getAttribute('placeholder'),type:el.type,wrapperInlineStyle:w?.getAttribute('style'),rect:el.getBoundingClientRect().toJSON()}:null;})(),
    searchCss: (()=>{const el=document.querySelector('.search-not-matching'); if(!el) return null; const cs=getComputedStyle(el); return {display:cs.display, visibility:cs.visibility, opacity:cs.opacity, height:cs.height};})()
  };
})()`);

// open the menu through the real click handler
await evalv(`document.querySelector('a.more-tasks').click(); true`);
await new Promise((r) => setTimeout(r, 600));
const afterOpen = await evalv(`(()=>{const el=document.querySelector('#searchTools');const w=el.closest('.search-tools-wrap');return {menuDisplay:getComputedStyle(document.querySelector('#megaMenu')).display, wrapperStyle:w.getAttribute('style'), wrapperDisplay:getComputedStyle(w).display, inputRect:el.getBoundingClientRect().toJSON()};})()`);
await shot("all-tools-open-1440.png");

// does the input become visible on a narrow viewport?
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await new Promise((r) => setTimeout(r, 400));
const at390 = await evalv(`(()=>{const el=document.querySelector('#searchTools');const w=el.closest('.search-tools-wrap');return {wrapperStyle:w.getAttribute('style'), wrapperDisplay:getComputedStyle(w).display, inputRect:el.getBoundingClientRect().toJSON()};})()`);
await shot("all-tools-open-390.png");
await send("Emulation.clearDeviceMetricsOverride");
await new Promise((r) => setTimeout(r, 300));

// force the shipped input visible (intervention) and drive it exactly like the shipped keyup handler
const results = await evalv(`(async()=>{
  const el=document.querySelector('#searchTools');
  const wrap=el.closest('.search-tools-wrap');
  wrap.style.display='block';
  const anchors=[...document.querySelectorAll('#megaMenu li a')];
  const setVal=(v)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,v); el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:v.slice(-1)||'a'}));};
  const snap=(q)=>({query:q, total:anchors.length, matched:anchors.filter(a=>!a.classList.contains('search-not-matching')).map(a=>({caption:a.querySelector('.caption')?.textContent.trim(), href:a.getAttribute('href'), title:a.getAttribute('title')})), hiddenCss:(()=>{const h=anchors.find(a=>a.classList.contains('search-not-matching')); if(!h) return null; const cs=getComputedStyle(h); return {display:cs.display, parentsDisplay:getComputedStyle(h.closest('li')).display};})()});
  const out={};
  for (const q of ['merge','pdf','delete','image','sign','xyzzy','  ','PDF']) { setVal(q); await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,60))); out[JSON.stringify(q)]=snap(q); }
  setVal('merge'); await new Promise(r=>setTimeout(r,100));
  return out;
})()`);
await shot("tools-search-merge-1440.png");

// final DOM snapshot of the menu region
const menuHtml = await evalv(`document.querySelector('#megaMenu').outerHTML`);
fs.writeFileSync(path.join(outDir, "all-tools-menu-dom.html"), menuHtml);

const report = { inventory, afterOpen, at390, results,
  shippedHandlerSource: (()=>{ try { return null; } catch { return null; } })() };
fs.writeFileSync(path.join(import.meta.dirname, "..", "raw", "probe-search.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ inventory: { title: inventory.title, headerTools: inventory.headerTools, categories: inventory.categories.map(c=>({headers:c.headers,count:c.tools.length})) }, searchInput: inventory.searchInput, afterOpen, at390, results }, null, 2));
ws.close();
