import { escapeHtml } from "./escape.js";
import { games } from "./games.js";

function basePathOf(config) {
  return config.publicBasePath === "/" ? "" : config.publicBasePath;
}

/** 默认 light 不写参数，其余主题在跳转时带上，避免点进游戏又变回去。 */
function themeQuery(theme) {
  return theme && theme !== "light" ? `?theme=${encodeURIComponent(theme)}` : "";
}

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230f9e91'/%3E%3Cpath d='M6 24c6 0 5.2-8.4 10.6-8.4S21 8 25 8' fill='none' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/%3E%3Ccircle cx='25' cy='8' r='4.2' fill='%23ffffff'/%3E%3Ccircle cx='26' cy='7' r='1.1' fill='%230f9e91'/%3E%3C/svg%3E";

const LOGO_MARK = `<span class="logo-mark" aria-hidden="true">
  <svg viewBox="0 0 24 24">
    <path d="M4 18c4.4 0 4.2-5 8.4-5S17 8 20 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
    <circle cx="19" cy="7.4" r="2.4" fill="currentColor" />
  </svg>
</span>`;

/** theme: "light"（默认） | "dark" | "auto"。auto 交给 CSS 的 prefers-color-scheme。 */
function themeAttrs(theme) {
  if (theme === "dark") {
    return { attr: ` data-theme="dark"`, colorScheme: "dark", themeColor: "#0e141b" };
  }

  if (theme === "light") {
    return { attr: ` data-theme="light"`, colorScheme: "light", themeColor: "#f4f6f9" };
  }

  return { attr: "", colorScheme: "light dark", themeColor: "#f4f6f9" };
}

function head(config, { title, styles = ["/styles.css"], scripts = [], description = "", theme = "light" }) {
  const base = basePathOf(config);
  const tone = themeAttrs(theme);

  return `<!doctype html>
<html lang="zh-CN"${tone.attr}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="${tone.colorScheme}" />
    <meta name="theme-color" content="${tone.themeColor}" />
    <title>${escapeHtml(title)}</title>
${description ? `    <meta name="description" content="${escapeHtml(description)}" />\n` : ""}    <link rel="icon" href="${FAVICON}" />
    <meta name="games-base" content="${escapeHtml(config.publicBasePath)}" />
    <meta name="games-service" content="${escapeHtml(config.serviceName)}" />
${styles.map((href) => `    <link rel="stylesheet" href="${base}${href}" />`).join("\n")}
${scripts
  .map((script) => `    <script type="module" src="${base}${script}"></script>`)
  .join("\n")}
  </head>`;
}

function siteLink(config) {
  if (!config.siteName || !config.siteUrl) {
    return "";
  }

  return `<a class="ghost-button" href="${escapeHtml(config.siteUrl)}">
    <svg viewBox="0 0 24 24" aria-hidden="true" class="icon">
      <path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span>返回${escapeHtml(config.siteName)}</span>
  </a>`;
}

export function renderHub(config, { theme = "light" } = {}) {
  const base = basePathOf(config);
  const ready = games.filter((game) => game.status === "ready");
  const soon = games.filter((game) => game.status !== "ready");

  return `${head(config, {
    title: config.title,
    description: config.subtitle,
    scripts: ["/hub.js"],
    theme
  })}
  <body class="hub-page">
    <main class="shell">
      <header class="hub-head">
        <div class="hub-brand">
          ${LOGO_MARK}
          <div>
            <p class="eyebrow">Mini games</p>
            <h1>${escapeHtml(config.title)}</h1>
          </div>
        </div>
        <div class="hub-actions">
          <span class="pill pill-count">${ready.length} 款可玩</span>
          ${siteLink(config)}
        </div>
      </header>

      ${
        ready.length > 0
          ? `<div class="game-grid">
        ${ready.map((game) => renderGameCard(game, base, theme)).join("\n        ")}
      </div>`
          : `<p class="empty-line">暂时没有可玩的游戏。</p>`
      }

      ${
        soon.length > 0
          ? `<div class="soon-line">
        <span class="soon-label">即将上线</span>
        ${soon.map((game) => renderSoonChip(game)).join("\n        ")}
      </div>`
          : ""
      }
    </main>
  </body>
</html>`;
}

function renderGameCard(game, base, theme) {
  const href = `${base}/play/${game.id}${themeQuery(theme)}`;

  return `<article class="game-card">
        <a class="game-thumb" href="${href}" aria-label="进入${escapeHtml(game.name)}">
          ${game.art || ""}
        </a>
        <div class="game-body">
          <div class="game-title-row">
            <h3>${escapeHtml(game.name)}</h3>
            <span class="chip chip-live">可玩</span>
          </div>
          <p class="game-tagline">${escapeHtml(game.tagline)}</p>
          <div class="card-foot">
            <span class="best" data-best-for="${escapeHtml(game.bestKey)}" data-label="${escapeHtml(game.scoreLabel)}">
              ${escapeHtml(game.scoreLabel)} <strong>—</strong>
            </span>
            <a class="primary-button small" href="${href}">开始</a>
          </div>
        </div>
      </article>`;
}

function renderSoonChip(game) {
  return `<span class="soon-chip">${game.glyph || ""}<span>${escapeHtml(game.name)}</span></span>`;
}

function renderControls(game) {
  const controls = game.controls || [];

  if (controls.length === 0) {
    return `<li><span class="keys"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span><span>控制方向</span></li>`;
  }

  return controls
    .map((item) => {
      if (typeof item === "string") {
        return `<li><span class="keys"><kbd>·</kbd></span><span>${escapeHtml(item)}</span></li>`;
      }

      const keys = (item.keys || [])
        .map((key) => `<kbd>${escapeHtml(key)}</kbd>`)
        .join("");
      const scope = item.touch ? ` data-touch="true"` : ` data-keyboard="true"`;

      return `<li${scope}><span class="keys">${keys}</span><span>${escapeHtml(
        item.label || ""
      )}</span></li>`;
    })
    .join("\n            ");
}

const ICON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-play"><path d="M9 6.5v11l9-5.5z" fill="currentColor" /></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-pause"><path d="M9 5v14M15 5v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>`;
const ICON_RESTART = `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const ICON_SOUND_ON = `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-sound-on"><path d="M4 9v6h3.4L12 19V5L7.4 9H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /><path d="M15.5 8.8a4.4 4.4 0 0 1 0 6.4M18 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>`;
const ICON_SOUND_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-sound-off"><path d="M4 9v6h3.4L12 19V5L7.4 9H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>`;
const ICON_FULL = `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

export function renderGamePage(config, game, { embed = false, theme = "light", uiMode = "full" } = {}) {
  const base = basePathOf(config);
  const tags = (game.tags || [])
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  const embedded = embed || uiMode === "embedded";

  return `${head(config, {
    title: `${game.name} · ${config.title}`,
    scripts: [`/games/${game.id}.js`],
    theme
  })}
  <body class="game-page${embedded ? " is-embed" : ""}" data-play-state="idle" data-game="${escapeHtml(
    game.id
  )}" data-best-key="${escapeHtml(game.bestKey || game.id)}" data-score-label="${escapeHtml(
    game.scoreLabel || "最高分"
  )}">
    <main class="game-shell">
      <header class="game-head">
        <div class="game-id">
          <h1>${escapeHtml(game.name)}</h1>
          <p class="game-sub">${escapeHtml(game.tagline)}</p>
        </div>
        <div class="game-head-actions">
          <span class="pill pill-best">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="icon">
              <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
              <path d="M7 5.5H4.6v1.8A3.1 3.1 0 0 0 7 10.3M17 5.5h2.4v1.8a3.1 3.1 0 0 1-2.4 3M9.4 20h5.2M12 13v7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>${escapeHtml(game.scoreLabel)}</span>
            <strong id="bestValue" data-best-value="0">0</strong>
          </span>
          <a class="ghost-button back-button" href="${base}/${themeQuery(theme)}">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="icon">
              <path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>返回游戏厅</span>
          </a>
        </div>
      </header>

      <div class="game-body-grid">
        <div class="stage-column">
        <section class="stage-card">
          <header class="stage-head">
            <div class="stage-status">
              <span class="status-dot" aria-hidden="true"></span>
              <span class="stage-name">${escapeHtml(game.name)}</span>
              <span class="stage-state" id="stageState">准备开始</span>
            </div>
            <div class="stage-tools">
              <button class="tool-icon" id="pauseButton" type="button" data-mode="play" title="暂停 / 继续" aria-label="暂停或继续">
                ${ICON_PAUSE}
                ${ICON_PLAY}
              </button>
              <button class="tool-icon" id="restartButton" type="button" title="重新开始 (R)" aria-label="重新开始">
                ${ICON_RESTART}
              </button>
              <button class="tool-icon" id="soundButton" type="button" aria-pressed="true" title="音效开关" aria-label="音效开关">
                ${ICON_SOUND_ON}
                ${ICON_SOUND_OFF}
              </button>
              <button class="tool-icon" id="fullscreenButton" type="button" title="全屏" aria-label="全屏">
                ${ICON_FULL}
              </button>
            </div>
          </header>
          <div class="stage" id="stage">
            <canvas id="canvas" aria-label="${escapeHtml(game.name)}游戏画面" role="img"></canvas>
            <div class="overlay" id="overlay" data-state="idle">
              <div class="overlay-card">
                <span class="overlay-badge" id="overlayBadge">准备开始</span>
                <h2 id="overlayTitle">准备好了吗</h2>
                <p id="overlayText">${escapeHtml(game.description)}</p>
                <div class="overlay-stats" id="overlayStats"></div>
                <button class="primary-button" id="overlayButton" type="button">开始游戏</button>
                <p class="overlay-hint" id="overlayHint">空格 暂停 · 回车 开始</p>
              </div>
            </div>
            <div class="stage-toast" id="toast" hidden></div>
          </div>
          <div class="dpad" id="dpad" role="group" aria-label="方向键">
            <button class="dpad-key" type="button" data-dir="up" aria-label="上">↑</button>
            <button class="dpad-key" type="button" data-dir="left" aria-label="左">←</button>
            <button class="dpad-key" type="button" data-dir="down" aria-label="下">↓</button>
            <button class="dpad-key" type="button" data-dir="right" aria-label="右">→</button>
          </div>
        </section>
        </div>

        <aside class="game-side">
          <div class="hud panel">
            <div class="hud-head">
              <span class="hud-label">本局分数</span>
              <span class="hud-best"><span>${escapeHtml(game.scoreLabel)}</span><strong data-best-value="0">0</strong></span>
            </div>
            <strong class="hud-score" id="scoreValue">0</strong>
            <dl class="hud-stats" id="stats"></dl>
            <div class="hud-time"><span>本局时长</span><strong id="clockValue">0:00</strong></div>
          </div>

          <div class="panel">
            <header class="panel-head">
              <h2>操作方式</h2>
              <span class="panel-tags">${tags}</span>
            </header>
            <ul class="control-list">
            ${renderControls(game)}
            </ul>
          </div>

          <div class="panel">
            <header class="panel-head">
              <h2>本机记录</h2>
              <span class="panel-note">当前浏览器</span>
            </header>
            <dl class="record-list">
              <div><dt>今日局数</dt><dd id="todayRuns">0</dd></div>
              <div><dt>累计局数</dt><dd id="totalRuns">0</dd></div>
              <div><dt>最长一局</dt><dd id="longestRun">0:00</dd></div>
            </dl>
          </div>
        </aside>

      </div>
    </main>
  </body>
</html>`;
}

export function renderNotFound(config, message = "这个页面不存在。", { theme = "light" } = {}) {
  const base = basePathOf(config);

  return `${head(config, { title: `没找到 · ${config.title}`, theme })}
  <body class="hub-page">
    <main class="shell shell-narrow">
      <section class="panel empty-panel">
        <p class="eyebrow">404</p>
        <h1>${escapeHtml(message)}</h1>
        <p class="summary">链接可能已经失效，或者这个游戏还没上线。</p>
        <a class="primary-button" href="${base}/${themeQuery(theme)}">回到游戏厅</a>
      </section>
    </main>
  </body>
</html>`;
}

export function renderEmbedDemo(config, { theme = "light" } = {}) {
  const base = basePathOf(config);
  const featured = games.find((game) => game.status === "ready") || games[0];

  return `${head(config, { title: `嵌入示例 · ${config.title}`, scripts: ["/embed-demo.js"], theme })}
  <body class="demo-page">
    <main class="demo-shell">
      <header class="page-head">
        <div>
          <p class="eyebrow">Embed</p>
          <h1>嵌入到 sub2api</h1>
          <p class="summary">下面这段终端是模拟的主站页面，点右下角按钮会以抽屉形式打开游戏，与 sub2api 自定义菜单的嵌入方式一致。</p>
        </div>
        <a class="ghost-button" href="${base}/${themeQuery(theme)}">回到游戏厅</a>
      </header>

      <section class="fake-terminal" aria-hidden="true">
        <div class="fake-term-head">
          <span class="fake-dot"></span><span class="fake-dot"></span><span class="fake-dot"></span>
          <span class="fake-term-title">~/projects/api — agent</span>
        </div>
        <pre class="fake-term-body">$ agent "把计费模块的浮点误差修掉"
<span class="dim">· Thinking… (12s)</span>
<span class="dim">· Reading src/billing/calc.ts</span>
<span class="dim">· Planning 3 edits</span>

<span class="cursor">▌</span></pre>
        <p class="fake-term-note">
          <span>任务执行期间可以打开游戏，任务完成时自动暂停。</span>
          <button class="ghost-button" id="simulateDone" type="button">模拟任务完成</button>
        </p>
      </section>

      <section class="panel demo-code">
        <header class="panel-head">
          <h2>接入代码</h2>
          <span class="panel-note">embed.js</span>
        </header>
        <pre><code>&lt;script src="${base}/embed.js"&gt;&lt;/script&gt;
&lt;script&gt;
  Sub2ApiGames.mount({ src: "${base}/", game: "${featured.id}" });
&lt;/script&gt;</code></pre>
        <p class="hint">
          可选参数：<code>position</code>（<code>bottom-right</code> / <code>bottom-left</code>）、<code>label</code>、
          <code>accent</code>、<code>theme</code>、<code>onEvent</code>；任务结束时调用
          <code>Sub2ApiGames.notifyTaskDone({ name })</code>。
        </p>
      </section>
    </main>
  </body>
</html>`;
}
