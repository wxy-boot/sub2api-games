import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|svg\+xml)|image\/svg\+xml)/;
const GZIP_MIN_BYTES = 1024;

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"]
]);

export function httpError(status, code, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

export function sendJson(res, status, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": body.length,
    ...extraHeaders
  });
  res.end(isHead(res) ? undefined : body);
}

export function sendHtml(res, html, extraHeaders = {}, status = 200) {
  const body = Buffer.from(html, "utf8");

  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": body.length,
    ...extraHeaders
  });
  res.end(isHead(res) ? undefined : body);
}

export function sendText(res, status, text, type = "text/plain; charset=utf-8", extraHeaders = {}) {
  const body = Buffer.from(text, "utf8");

  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Content-Length": body.length,
    ...extraHeaders
  });
  res.end(isHead(res) ? undefined : body);
}

function isHead(res) {
  return res.req?.method === "HEAD";
}

/**
 * 启动时把 public/ 整个读进内存：总量不到 100KB，换来每次请求零磁盘 IO。
 * 因为文件清单是固定的 Map，天然不存在路径穿越问题。
 */
export async function loadAssets(publicDir) {
  const assets = new Map();
  const files = await walk(publicDir, "");

  for (const relative of files) {
    const file = path.join(publicDir, relative);
    const url = `/${relative.split(path.sep).join("/")}`;
    const body = await readFile(file);
    const type = CONTENT_TYPES.get(path.extname(file).toLowerCase()) || "application/octet-stream";

    assets.set(url, buildAsset({ url, body, type }));
  }

  return assets;
}

function buildAsset({ url, body, type }) {
  const etag = `"${createHash("sha1").update(body).digest("base64url").slice(0, 16)}"`;
  const compressible = COMPRESSIBLE.test(type) && body.length >= GZIP_MIN_BYTES;

  return {
    url,
    type,
    etag,
    size: body.length,
    body,
    gzip: compressible ? gzipSync(body, { level: 9 }) : null
  };
}

async function walk(dir, prefix) {
  const entries = await readdir(path.join(dir, prefix), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = prefix ? path.join(prefix, entry.name) : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await walk(dir, relative)));
      continue;
    }

    if (entry.isFile()) {
      files.push(relative);
    }
  }

  return files.sort();
}

/**
 * 静态资源：内存 + ETag 协商 + gzip。304 命中和 HEAD 都不会发正文。
 */
export function serveAsset(req, res, asset, { maxAge = 0 } = {}) {
  const ifNoneMatch = String(req.headers["if-none-match"] || "");
  const cacheControl = maxAge > 0 ? `public, max-age=${maxAge}` : "no-cache";

  if (ifNoneMatch && matchesEtag(ifNoneMatch, asset.etag)) {
    res.writeHead(304, { ETag: asset.etag, "Cache-Control": cacheControl });
    res.end();
    return;
  }

  const acceptsGzip = String(req.headers["accept-encoding"] || "").includes("gzip");
  const useGzip = Boolean(asset.gzip) && acceptsGzip;
  const body = useGzip ? asset.gzip : asset.body;

  /** @type {Record<string, string|number>} */
  const headers = {
    "Content-Type": asset.type,
    "Content-Length": body.length,
    "Cache-Control": cacheControl,
    ETag: asset.etag,
    Vary: "Accept-Encoding",
    "X-Content-Type-Options": "nosniff"
  };

  if (useGzip) {
    headers["Content-Encoding"] = "gzip";
  }

  res.writeHead(200, headers);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  res.end(body);
}

function matchesEtag(header, etag) {
  return header
    .split(",")
    .map((item) => item.trim().replace(/^W\//, ""))
    .some((item) => item === "*" || item === etag);
}
