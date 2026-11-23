import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(__dirname, "..");

export const config = {
  serviceName: "sub2api-games",
  port: readIntEnv("PORT", 8790),
  publicBasePath: normalizeBasePath(process.env.PUBLIC_BASE_PATH || "/"),
  title: process.env.GAMES_TITLE || "摸鱼小游戏",
  subtitle: process.env.GAMES_SUBTITLE || "sub2api 内置小游戏厅，含贪吃蛇等纯前端小游戏。",
  siteName: String(process.env.GAMES_SITE_NAME || "").trim(),
  siteUrl: String(process.env.GAMES_SITE_URL || "").trim(),
  staticMaxAge: Math.max(0, readIntEnv("GAMES_STATIC_MAX_AGE", 3600)),
  allowEmbed: readBoolEnv("GAMES_ALLOW_EMBED", true)
};

export function readIntEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

export function readBoolEnv(name, fallback = false) {
  const value = String(process.env[name] || "").trim().toLowerCase();

  if (["1", "true", "yes", "on", "enabled"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off", "disabled"].includes(value)) {
    return false;
  }

  return fallback;
}

function normalizeBasePath(value) {
  const text = String(value || "/").trim();
  const withSlash = text.startsWith("/") ? text : `/${text}`;
  const trimmed = withSlash.replace(/\/+$/, "");
  return trimmed || "/";
}
