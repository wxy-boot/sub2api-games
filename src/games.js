import { meta as snake } from "../public/games/snake/meta.js";
import { meta as tetris } from "../public/games/tetris/meta.js";

/**
 * 游戏注册表：大厅、游戏页、/api/games 全部从这里取数据。
 *
 * 约定：一个游戏一个目录 public/games/<id>/，目录里至少两个文件
 *   meta.js   游戏信息，服务端 import 进来（所以不能碰 DOM）
 *   index.js  浏览器入口，调用 startGame(...)
 * 可选 style.css 放该游戏专属的画布配色。
 *
 * 新增游戏 = 建目录 + 写 meta.js + 把 meta 加进下面 READY 数组（status: "ready"）。
 */

const GLYPH_2048 = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="7" y="7" width="15" height="15" rx="3.5"/><rect x="26" y="7" width="15" height="15" rx="3.5"/><rect x="7" y="26" width="15" height="15" rx="3.5"/><rect x="26" y="26" width="15" height="15" rx="3.5"/></g></svg>`;

const GLYPH_MINES = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 38V14"/><path d="M18 14h14l-4 7 4 7H18"/><path d="M12 38h14"/><circle cx="33" cy="30" r="4"/></g></svg>`;

const GLYPH_WORD = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="7" y="12" width="34" height="9" rx="2.5"/><rect x="7" y="25" width="34" height="9" rx="2.5"/><path d="M13 12v9M20 12v9M27 12v9" stroke-linecap="round"/></g></svg>`;

/** 已上线：meta 来自各自的游戏目录。 */
const READY = [snake, tetris];

/** 排队中：还没有代码，只有卡片用的小图标。 */
const SOON = [
  {
    id: "2048",
    name: "数字方块",
    tagline: "合并相同数字，凑出 2048",
    description: "合并相同的数字，凑出 2048。",
    status: "soon",
    accent: "#2f6fed",
    tags: ["键盘 / 触屏", "回合制"],
    glyph: GLYPH_2048
  },
  {
    id: "minesweeper",
    name: "扫雷",
    tagline: "首次点击保证不炸，长按插旗",
    description: "首次点击保证不炸，长按插旗。",
    status: "soon",
    accent: "#c2760a",
    tags: ["鼠标 / 长按", "回合制"],
    glyph: GLYPH_MINES
  },
  {
    id: "wordle",
    name: "每日一猜",
    tagline: "每天一个五字词，六次机会",
    description: "每天一个五字词，六次机会。",
    status: "soon",
    accent: "#16a34a",
    tags: ["每日一局", "6 次机会"],
    glyph: GLYPH_WORD
  }
];

export const games = [...READY, ...SOON];

export const readyGames = games.filter((game) => game.status === "ready");

export function getGame(id) {
  return games.find((game) => game.id === id) || null;
}

/** 游戏目录在 public 下的位置：/games/<id>/ */
export function gameDir(game) {
  return `/games/${game.id}`;
}

/** 浏览器入口脚本。默认 index.js，个别游戏可以在 meta 里换名字。 */
export function gameEntryUrl(game) {
  return `${gameDir(game)}/${game.entry || "index.js"}`;
}

/** 该游戏专属样式，浏览器按顺序加载。 */
export function gameStyleUrls(game) {
  return (game.styles || []).map((file) => `${gameDir(game)}/${file}`);
}

/** 浏览器需要的字段，服务端内部用的（如文件路径）不要带出去。 */
export function publicGame(game, basePath = "") {
  const base = basePath === "/" ? "" : basePath;
  const ready = game.status === "ready";

  return {
    id: game.id,
    name: game.name,
    tagline: game.tagline,
    description: game.description,
    status: game.status,
    accent: game.accent,
    tags: game.tags || [],
    meta: game.meta || {},
    controls: game.controls || [],
    bestKey: game.bestKey || game.id,
    scoreLabel: game.scoreLabel || "最高分",
    script: ready ? `${base}${gameEntryUrl(game)}` : "",
    url: ready ? `${base}/play/${game.id}` : ""
  };
}
