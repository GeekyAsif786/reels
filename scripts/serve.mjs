#!/usr/bin/env node
// Tiny static server for local dev and tests: serves the repo root (like Netlify's
// publish = ".") with the same security headers as netlify.toml. Zero dependencies.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

// Read the header block from netlify.toml so the two can't drift.
const toml = await readFile(join(ROOT, "netlify.toml"), "utf8");
const HEADERS = {};
const block = toml.split(/\[\[headers\]\]/)[1] ?? "";
for (const m of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/gm)) {
  if (m[1] !== "for") HEADERS[m[1]] = m[2];
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function send(res, status, file, extra = {}) {
  const body = await readFile(file);
  res.writeHead(status, { ...HEADERS, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", ...extra });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/" || pathname === "/reels") {
      res.writeHead(301, { ...HEADERS, Location: "/reels/" });
      return res.end();
    }
    let file = normalize(join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(join(ROOT, "reels") + sep) && file !== join(ROOT, "reels")) {
      return send(res, 404, join(ROOT, "reels/404.html"));
    }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, "index.html");
    if (!(await stat(file).catch(() => null))?.isFile()) return send(res, 404, join(ROOT, "reels/404.html"));
    return send(res, 200, file);
  } catch {
    res.writeHead(500).end();
  }
}).listen(PORT, "127.0.0.1", () => console.log(`reels: http://localhost:${PORT}/reels/`));
