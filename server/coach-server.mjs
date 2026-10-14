// Node app server: static hosting of dist/ plus the AI endpoints in ./ai.mjs.
// (On Netlify the same endpoints run as netlify/functions/api.mjs.)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { configured, handleApi } from "./ai.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const DIST = join(fileURLToPath(new URL(".", import.meta.url)), "..", "dist");
const MAX_BODY = 8 * 1024 * 1024;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  let p = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!p.startsWith(DIST)) return send(res, 403, { error: "Forbidden" });
  try {
    if (!(await stat(p)).isFile()) throw new Error();
  } catch {
    p = join(DIST, "index.html"); // SPA fallback
  }
  try {
    const data = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    send(res, 404, { error: "Build not found. Run npm run build." });
  }
}

function send(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request too large."), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (!path.startsWith("/api/")) return serveStatic(req, res);
  const [status, out] = await handleApi(path, req.method, () => readBody(req)).catch((e) => [e.status ?? 500, { error: e.message }]);
  send(res, status, out);
}).listen(PORT, () => console.log(`App server on http://localhost:${PORT} (AI ${configured ? "enabled" : "not configured"})`));
