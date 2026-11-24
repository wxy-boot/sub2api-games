/**
 * 贪吃蛇的游戏信息：大厅卡片、游戏页文案、/api/games 都读这里。
 * 这个文件会被服务端 import，所以不能碰 DOM。
 */

const ART = `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="贪吃蛇示意图">
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

export const meta = {
  id: "snake",
  name: "贪吃蛇",
  tagline: "方向键控制，吃得越多越快",
  description: "吃莓果让蛇变长，每 5 颗提速一次。撞墙或咬到自己就结束。",
  status: "ready",
  accent: "#0f9e91",
  bestKey: "snake",
  scoreLabel: "最高分",
  styles: ["style.css"],
  meta: { players: "键盘 / 触屏", duration: "1–3 分钟" },
  tags: ["键盘 / 触屏", "单局 1–3 分钟"],
  controls: [
    { keys: ["↑", "←", "↓", "→"], label: "方向键或 WASD 控制方向" },
    { keys: ["空格"], label: "暂停 / 继续" },
    { keys: ["回车"], label: "开始 / 再来一局" },
    { keys: ["R"], label: "立即重新开始" },
    { keys: ["滑动"], label: "触屏滑动控制方向", touch: true }
  ],
  overlayHint: "空格 暂停 · 回车 开始",
  touchHint: "点按开始 · 滑动控制方向",
  art: ART
};
