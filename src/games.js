/**
 * 游戏注册表：大厅、游戏页、/api/games 全部从这里取数据。
 * 新增一个游戏 = 在 public/games/ 下加一个模块 + 在这里加一条记录（status: "ready"）。
 */

const SNAKE_ART = `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="贪吃蛇示意图">
  <defs>
    <linearGradient id="s2g-body" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#0c8276" />
      <stop offset="0.55" stop-color="#17a99a" />
      <stop offset="1" stop-color="#4fd6c3" />
    </linearGradient>
    <radialGradient id="s2g-head" cx="0.35" cy="0.3" r="0.85">
      <stop offset="0" stop-color="#6fe8d4" />
      <stop offset="1" stop-color="#0f9e91" />
    </radialGradient>
    <radialGradient id="s2g-berry" cx="0.34" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ff8a80" />
      <stop offset="1" stop-color="#c62f34" />
    </radialGradient>
  </defs>
  <g stroke="#0f9e91" stroke-opacity="0.12" stroke-width="1">
    <path d="M0 30h320M0 60h320M0 90h320M0 120h320M0 150h320" />
    <path d="M40 0v180M80 0v180M120 0v180M160 0v180M200 0v180M240 0v180M280 0v180" />
  </g>
  <ellipse cx="112" cy="160" rx="104" ry="9" fill="#0f9e91" fill-opacity="0.07" />
  <path d="M22 146 C 70 146 72 104 112 104 C 150 104 148 60 186 60"
        fill="none" stroke="#0b3f39" stroke-opacity="0.16" stroke-width="25" stroke-linecap="round" />
  <path d="M22 146 C 70 146 72 104 112 104 C 150 104 148 60 186 60"
        fill="none" stroke="url(#s2g-body)" stroke-width="21" stroke-linecap="round" />
  <path d="M22 146 C 70 146 72 104 112 104 C 150 104 148 60 186 60"
        fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="3.4" stroke-linecap="round"
        stroke-dasharray="2.5 12" />
  <g transform="translate(198 52) rotate(-38)">
    <path d="M21 0 h10 l7 -6 M31 0 l7 6" fill="none" stroke="#d84b45" stroke-width="2.6" stroke-linecap="round" />
    <ellipse rx="24" ry="17.5" fill="url(#s2g-head)" stroke="#0b4a44" stroke-opacity="0.3" stroke-width="1.6" />
    <ellipse cx="-5" cy="-6.5" rx="8.5" ry="3.6" fill="#ffffff" fill-opacity="0.3" />
    <ellipse cx="6" cy="-9.4" rx="5.6" ry="4.8" fill="#f7fffb" />
    <ellipse cx="6.6" cy="-9.4" rx="1.6" ry="3.3" fill="#16202b" />
    <ellipse cx="6" cy="9.4" rx="5.6" ry="4.8" fill="#f7fffb" />
    <ellipse cx="6.6" cy="9.4" rx="1.6" ry="3.3" fill="#16202b" />
    <circle cx="15.5" cy="-3" r="1" fill="#0b4a44" fill-opacity="0.5" />
    <circle cx="15.5" cy="3" r="1" fill="#0b4a44" fill-opacity="0.5" />
  </g>
  <g>
    <ellipse cx="255" cy="131" rx="14" ry="4" fill="#0f9e91" fill-opacity="0.1" />
    <circle cx="255" cy="118" r="11.5" fill="url(#s2g-berry)" />
    <circle cx="251.5" cy="114" r="3.2" fill="#ffd2cd" fill-opacity="0.75" />
    <path d="M255 106 c 5 -7 12 -8 15 -4 c -6 3.6 -10.6 4.6 -15 4 z" fill="#4ba36a" />
  </g>
  <g fill="#0f9e91" fill-opacity="0.28">
    <circle cx="66" cy="42" r="2" />
    <circle cx="132" cy="140" r="1.7" />
    <circle cx="290" cy="82" r="1.8" />
  </g>
</svg>`;

const GLYPH_2048 = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="7" y="7" width="15" height="15" rx="3.5"/><rect x="26" y="7" width="15" height="15" rx="3.5"/><rect x="7" y="26" width="15" height="15" rx="3.5"/><rect x="26" y="26" width="15" height="15" rx="3.5"/></g></svg>`;

const GLYPH_MINES = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 38V14"/><path d="M18 14h14l-4 7 4 7H18"/><path d="M12 38h14"/><circle cx="33" cy="30" r="4"/></g></svg>`;

const GLYPH_WORD = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="7" y="12" width="34" height="9" rx="2.5"/><rect x="7" y="25" width="34" height="9" rx="2.5"/><path d="M13 12v9M20 12v9M27 12v9" stroke-linecap="round"/></g></svg>`;

const GLYPH_BLOCKS = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="16" y="6" width="9" height="9" rx="2"/><rect x="25" y="6" width="9" height="9" rx="2"/><rect x="16" y="15" width="9" height="9" rx="2"/><rect x="25" y="24" width="9" height="9" rx="2"/><rect x="7" y="33" width="9" height="9" rx="2"/><rect x="16" y="33" width="9" height="9" rx="2"/><rect x="25" y="33" width="9" height="9" rx="2"/><rect x="34" y="33" width="6" height="9" rx="2"/></g></svg>`;

export const games = [
  {
    id: "snake",
    name: "贪吃蛇",
    tagline: "方向键控制，吃得越多越快",
    description: "吃莓果让蛇变长，每 5 颗提速一次。撞墙或咬到自己就结束。",
    status: "ready",
    accent: "#0f9e91",
    bestKey: "snake",
    scoreLabel: "最高分",
    meta: { players: "键盘 / 触屏", duration: "1–3 分钟" },
    tags: ["键盘 / 触屏", "单局 1–3 分钟"],
    controls: [
      { keys: ["↑", "←", "↓", "→"], label: "方向键或 WASD 控制方向" },
      { keys: ["空格"], label: "暂停 / 继续" },
      { keys: ["回车"], label: "开始 / 再来一局" },
      { keys: ["R"], label: "立即重新开始" },
      { keys: ["滑动"], label: "触屏滑动控制方向", touch: true }
    ],
    art: SNAKE_ART
  },
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
  },
  {
    id: "blocks",
    name: "方块落下",
    tagline: "七种方块，消行得分",
    description: "七种方块，消行得分。",
    status: "soon",
    accent: "#7c5cff",
    tags: ["键盘", "单局 3–10 分钟"],
    glyph: GLYPH_BLOCKS
  }
];

export const readyGames = games.filter((game) => game.status === "ready");

export function getGame(id) {
  return games.find((game) => game.id === id) || null;
}

/** 浏览器需要的字段，服务端内部用的（如文件路径）不要带出去。 */
export function publicGame(game, basePath = "") {
  const base = basePath === "/" ? "" : basePath;

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
    url: game.status === "ready" ? `${base}/play/${game.id}` : ""
  };
}
