/**
 * 俄罗斯方块的游戏信息：大厅卡片、游戏页文案、/api/games 都读这里。
 * 这个文件会被服务端 import，所以不能碰 DOM。
 */

const ART = `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="俄罗斯方块示意图">
  <defs>
    <linearGradient id="tg-cy" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#3ee0f2" />
      <stop offset="1" stop-color="#0891b2" />
    </linearGradient>
    <linearGradient id="tg-bl" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#7cb0fb" />
      <stop offset="1" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="tg-pu" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#cfa4fd" />
      <stop offset="1" stop-color="#7c3aed" />
    </linearGradient>
    <linearGradient id="tg-am" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#fdc84a" />
      <stop offset="1" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="tg-gr" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#6ee7a0" />
      <stop offset="1" stop-color="#16a34a" />
    </linearGradient>
    <radialGradient id="tg-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0.32" />
      <stop offset="1" stop-color="#a78bfa" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="tg-trail" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0" />
      <stop offset="1" stop-color="#a78bfa" stop-opacity="0.5" />
    </linearGradient>
    <filter id="tg-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="3" stdDeviation="3.2" flood-color="#2a1a52" flood-opacity="0.22" />
    </filter>
  </defs>

  <g stroke="#7c5cff" stroke-opacity="0.1" stroke-width="1">
    <path d="M0 20h320M0 40h320M0 60h320M0 80h320M0 100h320M0 120h320M0 140h320M0 160h320" />
    <path d="M20 0v180M40 0v180M60 0v180M80 0v180M100 0v180M120 0v180M140 0v180M160 0v180M180 0v180M200 0v180M220 0v180M240 0v180M260 0v180M280 0v180M300 0v180" />
  </g>

  <ellipse cx="206" cy="92" rx="96" ry="86" fill="url(#tg-glow)" />
  <ellipse cx="96" cy="170" rx="86" ry="12" fill="#7c5cff" fill-opacity="0.1" />
  <ellipse cx="214" cy="170" rx="52" ry="9" fill="#7c5cff" fill-opacity="0.08" />

  <!-- 落下的 T 形方块 -->
  <rect x="215" y="6" width="2" height="34" rx="1" fill="url(#tg-trail)" />
  <g filter="url(#tg-shadow)">
    <g transform="translate(178 26)">
      <rect width="24" height="24" rx="6" fill="url(#tg-pu)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.26" />
    </g>
    <g transform="translate(204 26)">
      <rect width="24" height="24" rx="6" fill="url(#tg-pu)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.3" />
    </g>
    <g transform="translate(230 26)">
      <rect width="24" height="24" rx="6" fill="url(#tg-pu)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.24" />
    </g>
    <g transform="translate(204 52)">
      <rect width="24" height="24" rx="6" fill="url(#tg-pu)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.2" />
    </g>
  </g>

  <!-- 底部堆起来的方块 -->
  <g filter="url(#tg-shadow)">
    <g transform="translate(40 148)">
      <rect width="24" height="24" rx="6" fill="url(#tg-cy)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.3" />
    </g>
    <g transform="translate(65 148)">
      <rect width="24" height="24" rx="6" fill="url(#tg-bl)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.26" />
    </g>
    <g transform="translate(90 148)">
      <rect width="24" height="24" rx="6" fill="url(#tg-pu)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.26" />
    </g>
    <g transform="translate(115 148)">
      <rect width="24" height="24" rx="6" fill="url(#tg-am)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.32" />
    </g>
    <g transform="translate(140 148)">
      <rect width="24" height="24" rx="6" fill="url(#tg-gr)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.28" />
    </g>
    <g transform="translate(40 123)">
      <rect width="24" height="24" rx="6" fill="url(#tg-pu)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.24" />
    </g>
    <g transform="translate(65 123)">
      <rect width="24" height="24" rx="6" fill="url(#tg-cy)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.3" />
    </g>
    <g transform="translate(90 123)">
      <rect width="24" height="24" rx="6" fill="url(#tg-am)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.28" />
    </g>
    <g transform="translate(65 98)">
      <rect width="24" height="24" rx="6" fill="url(#tg-gr)" />
      <rect x="3" y="2.5" width="18" height="7" rx="3.4" fill="#ffffff" fill-opacity="0.26" />
    </g>
  </g>

  <!-- 消行时的碎片 -->
  <g opacity="0.85">
    <g transform="translate(252 118) rotate(18)">
      <rect width="16" height="16" rx="4" fill="url(#tg-am)" />
    </g>
    <g transform="translate(276 96) rotate(-24)">
      <rect width="12" height="12" rx="3" fill="url(#tg-cy)" />
    </g>
    <g transform="translate(262 140) rotate(-40)">
      <rect width="10" height="10" rx="3" fill="url(#tg-gr)" />
    </g>
    <circle cx="292" cy="126" r="3" fill="#a78bfa" fill-opacity="0.6" />
    <circle cx="246" cy="92" r="2.2" fill="#a78bfa" fill-opacity="0.5" />
    <circle cx="286" cy="62" r="2.8" fill="#c4b5fd" fill-opacity="0.7" />
  </g>
</svg>`;

export const meta = {
  id: "tetris",
  name: "俄罗斯方块",
  tagline: "七种方块，消行得分",
  description: "七种方块随机落下，填满一整行就能消除。一次消四行最划算，连续消行还有连击加成。",
  status: "ready",
  accent: "#7c5cff",
  bestKey: "tetris",
  scoreLabel: "最高分",
  styles: ["style.css"],
  meta: { players: "键盘 / 触屏", duration: "3–10 分钟" },
  tags: ["键盘 / 触屏", "单局 3–10 分钟"],
  controls: [
    { keys: ["←", "→"], label: "左右移动（长按连发）" },
    { keys: ["↓"], label: "加速下落" },
    { keys: ["↑", "Z"], label: "旋转：↑ 顺时针，Z 逆时针" },
    { keys: ["空格"], label: "直接落到底" },
    { keys: ["C"], label: "暂存当前方块" },
    { keys: ["P"], label: "暂停 / 继续" },
    { keys: ["回车", "R"], label: "开始 / 重新开始" },
    { keys: ["滑动"], label: "触屏滑动移动，点按直落，↑ 旋转", touch: true }
  ],
  overlayHint: "← → 移动 · 空格 直落 · P 暂停",
  touchHint: "点按直落 · 滑动移动 · ↑ 旋转",
  art: ART
};
