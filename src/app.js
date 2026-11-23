import { createServer } from "node:http";
import path from "node:path";
import { config as defaultConfig, rootDir } from "./config.js";
import { games, getGame, publicGame, readyGames } from "./games.js";
import { httpError, loadAssets, serveAsset, sendHtml, sendJson, sendText } from "./http.js";
import { logError } from "./log.js";
import { renderEmbedDemo, renderGamePage, renderHub, renderNotFound } from "./pages.js";

/**
 * 整个服务只有静态资源和两个 JSON 接口，没有任何状态、没有数据库、没有定时器。
 * public/ 在启动时全部读进内存，单请求路径上不碰磁盘。
 */
export async function createApp(overrides = {}) {
  const config = { ...defaultConfig, ...overrides };
  const assets = await loadAssets(path.join(rootDir, "public"));

  const server = createServer((req, res) => {
    handle(req, res, config, assets).catch((error) => {
      const status = error.status || 500;
      const payload = error.status
        ? { ok: false, error: error.code, message: error.message }
        : { ok: false, error: "internal_error", message: "服务内部错误" };

      if (!error.status) {
        logError("request.error", {
          method: req.method,
          url: req.url,
          message: error.message,
          stack: error.stack
        });
      }

      if (res.headersSent) {
        res.end();
        return;
      }

      sendJson(res, status, payload);
    });
  });

  server.on("clientError", (_error, socket) => {
    if (socket.writable) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    }
  });

  return { server, config, assets };
}

async function handle(req, res, config, assets) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodePath(url.pathname);
  const routePath = stripPublicBasePath(pathname, config.publicBasePath);

  if (routePath === null) {
    sendNotFound(req, res, config);
    return;
  }

  const method = req.method === "HEAD" ? "GET" : req.method;

  if (method === "GET" && routePath === "/healthz") {
    sendJson(res, 200, { ok: true, service: config.serviceName, games: readyGames.length });
    return;
  }

  if (method === "GET" && routePath === "/api/games") {
    sendJson(
      res,
      200,
      {
        ok: true,
        title: config.title,
        subtitle: config.subtitle,
        basePath: config.publicBasePath,
        playable: readyGames.length,
        games: games.map((game) => publicGame(game, config.publicBasePath))
      },
      { "Access-Control-Allow-Origin": "*" }
    );
    return;
  }

  const apiGameMatch = routePath.match(/^\/api\/games\/([a-z0-9-]+)$/);

  if (method === "GET" && apiGameMatch) {
    const game = getGame(apiGameMatch[1]);

    if (!game) {
      throw httpError(404, "game_not_found", "没有这个游戏。");
    }

    sendJson(res, 200, { ok: true, game: publicGame(game, config.publicBasePath) }, {
      "Access-Control-Allow-Origin": "*"
    });
    return;
  }

  const theme = readTheme(url.searchParams.get("theme"));
  const uiMode = readUiMode(url.searchParams.get("ui_mode"));
  const embed = isTruthy(url.searchParams.get("embed")) || uiMode === "embedded";

  if (method === "GET" && (routePath === "/" || routePath === "/index.html")) {
    sendHtml(res, renderHub(config, { theme }), htmlHeaders(config));
    return;
  }

  if (method === "GET" && routePath === "/embed-demo") {
    sendHtml(res, renderEmbedDemo(config, { theme }), htmlHeaders(config));
    return;
  }

  const playMatch = routePath.match(/^\/play\/([a-z0-9-]+)\/?$/);

  if (method === "GET" && playMatch) {
    const game = getGame(playMatch[1]);

    if (!game || game.status !== "ready") {
      const message = game ? "这个游戏还在排队。" : "没有这个游戏。";
      sendHtml(
        res,
        renderNotFound(config, message, { theme }),
        { ...htmlHeaders(config), "Cache-Control": "no-store" },
        404
      );
      return;
    }

    sendHtml(res, renderGamePage(config, game, { embed, theme, uiMode }), htmlHeaders(config));
    return;
  }

  const asset = assets.get(routePath);

  if (method === "GET" && asset) {
    serveAsset(req, res, asset, { maxAge: config.staticMaxAge });
    return;
  }

  sendNotFound(req, res, config, theme);
}

function sendNotFound(req, res, config, theme = "dark") {
  const wantsHtml = String(req.headers.accept || "").includes("text/html");

  if (wantsHtml) {
    sendHtml(res, renderNotFound(config, "这个页面不存在。", { theme }), htmlHeaders(config), 404);
    return;
  }

  sendText(res, 404, JSON.stringify({ ok: false, error: "not_found" }), "application/json; charset=utf-8");
}

function htmlHeaders(config) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      `frame-ancestors ${config.allowEmbed ? "*" : "'self'"}`
    ].join("; ")
  };

  if (!config.allowEmbed) {
    headers["X-Frame-Options"] = "SAMEORIGIN";
  }

  return headers;
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function readTheme(value) {
  const theme = String(value || "").toLowerCase();
  return ["dark", "light", "auto"].includes(theme) ? theme : "light";
}

function readUiMode(value) {
  return String(value || "").toLowerCase() === "embedded" ? "embedded" : "full";
}

function decodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function stripPublicBasePath(pathname, basePath) {
  const base = basePath || "/";

  if (base === "/") {
    return pathname;
  }

  if (pathname === base) {
    return "/";
  }

  if (pathname.startsWith(`${base}/`)) {
    return pathname.slice(base.length) || "/";
  }

  return null;
}
