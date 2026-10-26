// Minimal CDP driver for evidence collection (no external deps; Node >= 22 global WebSocket).
// Usage: node cdp.mjs <targetId> <expressionFileOrInline> [--screenshot out.png]
const endpoint = process.env.CDP || "http://127.0.0.1:9333";
const targetId = process.argv[2];
const expr = process.argv[3];
const shotIdx = process.argv.indexOf("--screenshot");
const shotPath = shotIdx > -1 ? process.argv[shotIdx + 1] : null;

const list = await (await fetch(`${endpoint}/json/list`)).json();
const target = list.find((t) => t.id === targetId);
if (!target) throw new Error(`target ${targetId} not found`);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

const out = {};
if (expr) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  out.evaluate = r.result?.value ?? r;
}
if (shotPath) {
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const fs = await import("node:fs");
  fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
  out.screenshot = shotPath;
}
console.log(JSON.stringify(out, null, 2));
ws.close();
