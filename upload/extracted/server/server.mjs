// Tiny static file server for Small Editor. No dependencies.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".woff2", "font/woff2"],
  [".ftl", "text/plain; charset=utf-8"],
  [".bcmap", "application/octet-stream"],
  [".pfb", "application/octet-stream"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
]);

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "app" : decoded.slice(1);
  const target = resolve(join(root, normalize(relative)));
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  const target = resolveRequestPath(request.url ?? "/");
  if (!target) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  let info;
  try {
    info = statSync(target);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }

  if (info.isDirectory()) {
    if ((request.url ?? "/") === "/") {
      response.writeHead(302, { Location: "/app/" }).end();
      return;
    }
    const index = join(target, "index.html");
    try {
      const indexInfo = statSync(index);
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": indexInfo.size,
        "Cache-Control": "no-store",
      });
      if (request.method === "HEAD") return response.end();
      createReadStream(index).pipe(response);
      return;
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
  }

  response.writeHead(200, {
    "Content-Type": MIME.get(extname(target).toLowerCase()) ?? "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Opener-Policy": "same-origin",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(target).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Small Editor → http://${host}:${port}/`);
});
