/**
 * 游戏外壳：所有小游戏共用的一套运行时。
 * 负责画布尺寸 / DPR、固定循环、失焦自动暂停、键盘与触屏输入、音效、最高分存档、
 * 以及和父页面（sub2api）之间的 postMessage 通信。
 *
 * 游戏模块只需要实现 create(env) → { reset, update, draw, onDirection }。
 * 需要更多按键（如俄罗斯方块的旋转、直落、暂存）再额外提供
 * onKey(key) → boolean / onKeyUp(key) / onTap()，外壳会把按键先交给它。
 */

const STORAGE_PREFIX = "sub2api-games:";
const SWIPE_MIN_RATIO = 0.06;
const SWIPE_MIN_PX = 18;
const OVER_TAIL = 1.1; // 结束后继续绘制的时间，给死亡动画留出余量

const STATE_LABEL = {
  idle: "准备开始",
  running: "进行中",
  paused: "已暂停",
  over: "已结束"
};

export function startGame(create) {
  const page = document.body;
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("canvas");

  if (!stage || !canvas) {
    throw new Error("游戏页面缺少 #stage / #canvas");
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("浏览器不支持 Canvas 2D");
  }

  // 老一点的 Safari 没有 roundRect，用 arcTo 兜一下。
  if (typeof ctx.roundRect !== "function") {
    ctx.roundRect = function roundRect(x, y, width, height, radius) {
      const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));

      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + width, y, x + width, y + height, r);
      this.arcTo(x + width, y + height, x, y + height, r);
      this.arcTo(x, y + height, x, y, r);
      this.arcTo(x, y, x + width, y, r);
      this.closePath();
    };
  }

  const meta = {
    game: page.dataset.game || "unknown",
    bestKey: page.dataset.bestKey || page.dataset.game || "unknown",
    scoreLabel: page.dataset.scoreLabel || "最高分"
  };

  const dom = {
    overlay: document.getElementById("overlay"),
    overlayBadge: document.getElementById("overlayBadge"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    overlayStats: document.getElementById("overlayStats"),
    overlayButton: document.getElementById("overlayButton"),
    overlayHint: document.getElementById("overlayHint"),
    score: document.getElementById("scoreValue"),
    clock: document.getElementById("clockValue"),
    stats: document.getElementById("stats"),
    sound: document.getElementById("soundButton"),
    fullscreen: document.getElementById("fullscreenButton"),
    pause: document.getElementById("pauseButton"),
    stageState: document.getElementById("stageState"),
    restart: document.getElementById("restartButton"),
    todayRuns: document.getElementById("todayRuns"),
    totalRuns: document.getElementById("totalRuns"),
    longestRun: document.getElementById("longestRun"),
    toast: document.getElementById("toast"),
    dpad: document.getElementById("dpad")
  };

  const touch =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const hint = (desktop, mobile) => (touch ? mobile : desktop);

  const idleCopy = {
    badge: dom.overlayBadge?.textContent || "准备开始",
    title: dom.overlayTitle?.textContent || "准备好了吗",
    text: dom.overlayText?.textContent || "",
    hint: hint(
      dom.overlayHint?.textContent || "",
      page.dataset.touchHint || "点按开始 · 滑动控制方向"
    )
  };

  const storage = createStorage();
  const sound = createSound(storage);
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const game = { state: "idle", score: 0, best: storage.getInt(`${meta.bestKey}:best`, 0) };
  const env = {
    canvas,
    ctx,
    size: { width: 0, height: 0 },
    api: null,
    reduceMotion,
    isEmbed: page.classList.contains("is-embed")
  };
  let instance = null;
  let elapsed = 0;
  let lastFrame = 0;
  let dirty = true;
  let clockAcc = 0;
  let drawTail = 0;
  let bumpTimer = 0;

  env.api = {
    setScore(value) {
      const next = Math.max(0, Math.round(Number(value) || 0));

      if (next === game.score) {
        return;
      }

      game.score = next;
      paintScore(true);
      post("score", { score: game.score, best: game.best });
    },
    setStats(stats) {
      paintStats(stats);
    },
    gameOver(payload = {}) {
      finish(payload);
    },
    sound(name) {
      sound.play(name);
    },
    /** 当前状态："idle" | "running" | "paused" | "over"。 */
    getState() {
      return game.state;
    },
    togglePause() {
      togglePause();
    },
    restart() {
      start();
    },
    storage
  };

  // ---------------------------------------------------------------- 布局

  const wrap = stage.parentElement || stage;
  const column = stage.closest?.(".stage-column") || wrap.parentElement || wrap;

  function resize() {
    const fullscreen = Boolean(document.fullscreenElement);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let size;

    if (fullscreen) {
      // 全屏时画布卡片铺满屏幕，画布按短边取正方形并居中。
      const box = stage.getBoundingClientRect();
      size = Math.floor(Math.min(box.width || window.innerWidth, box.height || window.innerHeight));
    } else {
      // 用列容器算尺寸，避免“改了 stage 尺寸 → 再次触发 ResizeObserver”的回环。
      const available = column.clientWidth || wrap.clientWidth || stage.clientWidth;
      const ratio = env.isEmbed ? 0.84 : 0.76;
      const maxHeight = Math.max(200, window.innerHeight * ratio);
      size = Math.round(Math.min(available, maxHeight));
    }

    size = Math.max(120, size);

    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    if (fullscreen) {
      stage.style.width = "";
      stage.style.height = "";
    } else {
      stage.style.width = `${size}px`;
      stage.style.height = `${size}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    env.size.width = size;
    env.size.height = size;
    // 窄屏或全屏时侧栏不可见，游戏需要把关键指标画进画布。
    env.compact = fullscreen || (!env.isEmbed && window.innerWidth < 980);
    env.fullscreen = fullscreen;
    dirty = true;
  }

  // ---------------------------------------------------------------- 循环

  function frame(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
    lastFrame = now;

    if (game.state === "running") {
      elapsed += dt;
      clockAcc += dt;

      if (clockAcc >= 0.25) {
        clockAcc = 0;
        paintClock();
      }

      instance?.update?.(dt);
      instance?.draw?.(dt);
      dirty = true;
    } else if (drawTail > 0) {
      // 结算后的一小段时间继续画，让粒子和闪屏能落下去。
      drawTail = Math.max(0, drawTail - dt);
      instance?.draw?.(dt);
    } else if (dirty) {
      // 暂停/结束时只在需要时重绘，避免白烧 CPU。
      instance?.draw?.(0);
      dirty = false;
    }

    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- 状态机

  function start() {
    instance = create(env) || {};
    game.score = 0;
    elapsed = 0;
    clockAcc = 0;
    drawTail = 0;
    game.state = "running";
    clearDeferredOverlay();
    paintStats({});
    instance.reset?.();
    paintScore();
    paintClock();
    paintPlayState();
    setOverlay("running");
    sound.unlock();
    sound.play("start");
    post("state", { state: "running" });
    post("score", { score: 0, best: game.best });
    dirty = true;
  }

  function pause(reason = "manual") {
    if (game.state !== "running") {
      return;
    }

    game.state = "paused";
    paintOverlay({
      badge: reason === "blur" ? "已自动暂停" : "已暂停",
      title: reason === "blur" ? "页面切走了" : "休息一下",
      text:
        reason === "blur"
          ? "这一局停在原地，回来接着玩。"
          : "当前进度已经保留，随时继续。",
      button: "继续游戏",
      hint: hint("空格 继续 · R 重开", "点按继续")
    });
    setOverlay("paused");
    paintPlayState();
    post("state", { state: "paused", reason });

    if (reason === "manual") {
      sound.play("pause");
    }
  }

  function resume() {
    if (game.state !== "paused") {
      return;
    }

    game.state = "running";
    setOverlay("running");
    paintPlayState();
    sound.play("click");
    post("state", { state: "running" });
    dirty = true;
  }

  function finish(payload = {}) {
    if (game.state !== "running") {
      return;
    }

    game.state = "over";
    game.score = Math.max(game.score, Math.round(Number(payload.score) || 0));

    const isBest = game.score > game.best;

    if (isBest) {
      game.best = game.score;
      storage.setInt(`${meta.bestKey}:best`, game.best);
      paintBest();
    }

    paintScore();
    paintPlayState();
    recordPlay();
    paintRecords();
    sound.play(isBest ? "best" : "over");

    const stats = payload.stats && typeof payload.stats === "object" ? payload.stats : {};
    const gap = game.best - game.score;

    paintOverlay({
      badge: isBest ? "新纪录" : "本局结束",
      title: isBest ? "刷新了最高分" : "这局结束了",
      text: isBest
        ? `把纪录推进到 ${game.score} 分。`
        : gap > 0
          ? `距离最高分还差 ${gap} 分。`
          : "按回车再来一局。",
      button: "再来一局",
      hint: hint("回车 再来一局 · R 立即重开", "点按再来一局"),
      highlight: isBest,
      stats: { 本局得分: game.score, [meta.scoreLabel]: game.best, ...stats }
    });
    setOverlay("over");
    deferOverlay(420);
    drawTail = OVER_TAIL;
    post("over", { score: game.score, best: game.best, stats });
  }

  function togglePause() {
    if (game.state === "running") {
      pause("manual");
      return;
    }

    if (game.state === "paused") {
      resume();
      return;
    }

    start();
  }

  // ---------------------------------------------------------------- 渲染辅助

  function paintScore(bump = false) {
    paintBest(Math.max(game.best, game.score));

    if (dom.score) {
      dom.score.textContent = String(game.score);

      if (bump && game.state === "running") {
        dom.score.classList.add("is-bump");
        window.clearTimeout(bumpTimer);
        bumpTimer = window.setTimeout(() => dom.score.classList.remove("is-bump"), 180);
      }
    }
  }

  function paintBest(value = game.best) {
    for (const node of document.querySelectorAll("[data-best-value]")) {
      node.textContent = String(value);
      node.dataset.bestValue = String(value);
    }
  }

  function paintClock() {
    if (!dom.clock) {
      return;
    }

    dom.clock.textContent = formatClock(elapsed);
  }

  function paintStats(stats) {
    if (!dom.stats) {
      return;
    }

    const entries = Object.entries(stats || {});

    dom.stats.replaceChildren(
      ...entries.map(([label, value]) => {
        const row = document.createElement("div");
        row.className = "hud-stat";
        const key = document.createElement("span");
        key.textContent = label;
        const val = document.createElement("strong");
        val.textContent = String(value);
        row.append(key, val);
        return row;
      })
    );
  }

  function paintPlayState() {
    page.dataset.playState = game.state;

    if (dom.stageState) {
      dom.stageState.textContent = STATE_LABEL[game.state] || "";
    }

    if (dom.pause) {
      const label = game.state === "running" ? "暂停" : game.state === "paused" ? "继续" : "开始";
      dom.pause.dataset.mode = game.state === "running" ? "pause" : "play";
      dom.pause.title = `${label} (空格)`;
      dom.pause.setAttribute("aria-label", label);
    }
  }

  function paintOverlay({ badge, title, text, button, hint, stats, highlight = false }) {
    if (dom.overlayBadge && badge) {
      dom.overlayBadge.textContent = badge;
    }

    if (dom.overlayTitle) {
      dom.overlayTitle.textContent = title;
    }

    if (dom.overlayText) {
      dom.overlayText.textContent = text || "";
    }

    if (dom.overlayButton) {
      dom.overlayButton.textContent = button;
    }

    if (dom.overlayHint) {
      dom.overlayHint.textContent = hint || "";
    }

    if (dom.overlayStats) {
      dom.overlayStats.replaceChildren(
        ...Object.entries(stats || {}).map(([label, value], index) => {
          const item = document.createElement("div");
          item.className = "overlay-stat";

          if (highlight && index === 0) {
            item.classList.add("is-highlight");
          }

          const key = document.createElement("span");
          key.textContent = label;
          const val = document.createElement("strong");
          val.textContent = String(value);
          item.append(key, val);
          return item;
        })
      );
    }
  }

  function setOverlay(state) {
    if (dom.overlay) {
      dom.overlay.dataset.state = state;
    }
  }

  // 结算面板晚一点出现，让死亡动画和震屏先演完。
  let overlayTimer = 0;

  function deferOverlay(delay) {
    if (!dom.overlay) {
      return;
    }

    dom.overlay.classList.add("is-deferred");
    window.clearTimeout(overlayTimer);
    overlayTimer = window.setTimeout(() => {
      dom.overlay?.classList.remove("is-deferred");
    }, delay);
  }

  function clearDeferredOverlay() {
    window.clearTimeout(overlayTimer);
    dom.overlay?.classList.remove("is-deferred");
  }

  function resetOverlayCopy() {
    paintOverlay({
      badge: idleCopy.badge,
      title: idleCopy.title,
      text: idleCopy.text,
      button: "开始游戏",
      hint: idleCopy.hint,
      stats: {}
    });
    setOverlay("idle");
  }

  // ---------------------------------------------------------------- 记录

  function readRecord() {
    return storage.getJson("play", {}) || {};
  }

  function recordPlay() {
    const today = new Date().toISOString().slice(0, 10);
    const previous = readRecord();
    const sameDay = previous.date === today;

    storage.setJson("play", {
      total: Number(previous.total || 0) + 1,
      date: today,
      todayCount: sameDay ? Number(previous.todayCount || 0) + 1 : 1,
      longest: Math.max(Number(previous.longest || 0), Math.round(elapsed))
    });
  }

  function paintRecords() {
    const record = readRecord();

    if (dom.todayRuns) {
      dom.todayRuns.textContent = String(Number(record.todayCount || 0));
    }

    if (dom.totalRuns) {
      dom.totalRuns.textContent = String(Number(record.total || 0));
    }

    if (dom.longestRun) {
      dom.longestRun.textContent = formatClock(Number(record.longest || 0));
    }
  }

  // ---------------------------------------------------------------- 输入

  function direction(dir) {
    if (game.state !== "running") {
      return;
    }

    instance?.onDirection?.(dir);
  }

  const KEY_DIRS = new Map([
    ["ArrowUp", "up"],
    ["ArrowDown", "down"],
    ["ArrowLeft", "left"],
    ["ArrowRight", "right"],
    ["w", "up"],
    ["a", "left"],
    ["s", "down"],
    ["d", "right"],
    ["W", "up"],
    ["A", "left"],
    ["S", "down"],
    ["D", "right"]
  ]);

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      sound.unlock();

      // 游戏可以先接管按键（俄罗斯方块拿空格直落、↑ 旋转），返回 true 表示已消费，
      // 外壳就不再执行自己的空格/回车/方向键默认行为。
      if (instance?.onKey?.(event.key, event)) {
        event.preventDefault();
        return;
      }

      const dir = KEY_DIRS.get(event.key);

      if (dir) {
        event.preventDefault();

        if (game.state === "idle") {
          start();
        }

        direction(dir);
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        togglePause();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        if (game.state === "running") {
          pause("manual");
        } else if (game.state === "paused") {
          resume();
        } else {
          start();
        }

        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        start();
      }
    },
    { passive: false }
  );

  // 有按键抬起才能做 DAS / 长按软降，所以把 keyup 也转给游戏。
  window.addEventListener("keyup", (event) => {
    instance?.onKeyUp?.(event.key, event);
  });

  // 触屏滑动：只在画布上生效，避免影响页面滚动。
  let pointerStart = null;

  stage.addEventListener("pointerdown", (event) => {
    pointerStart = { x: event.clientX, y: event.clientY, time: Date.now() };
    sound.unlock();
  });

  stage.addEventListener("pointerup", (event) => {
    if (!pointerStart) {
      return;
    }

    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const threshold = Math.max(SWIPE_MIN_PX, env.size.width * SWIPE_MIN_RATIO);
    pointerStart = null;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      if (game.state === "idle") {
        start();
        return;
      }

      // 轻点：棋盘类游戏用它做「直落」这类单次动作。
      if (game.state === "running") {
        instance?.onTap?.();
      }

      return;
    }

    if (game.state === "idle") {
      start();
    }

    direction(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  });

  stage.addEventListener("pointercancel", () => {
    pointerStart = null;
  });

  // 屏幕方向键（触摸设备显示）
  dom.dpad?.addEventListener("pointerdown", (event) => {
    const target = event.target.closest("[data-dir]");

    if (!target) {
      return;
    }

    event.preventDefault();
    sound.unlock();

    if (game.state === "idle") {
      start();
    }

    direction(target.dataset.dir);
  });

  dom.overlayButton?.addEventListener("click", () => {
    sound.unlock();

    if (game.state === "paused") {
      resume();
      return;
    }

    start();
  });

  dom.pause?.addEventListener("click", () => {
    sound.unlock();
    togglePause();
  });

  dom.restart?.addEventListener("click", () => {
    sound.unlock();
    start();
  });

  dom.fullscreen?.addEventListener("click", () => {
    const card = stage.closest?.(".stage-card") || stage;

    if (typeof card.requestFullscreen !== "function") {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }

    void card.requestFullscreen().catch(() => {});
  });

  // 切走就暂停：用户会频繁回终端看智能体。
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pause("blur");
    }
  });

  window.addEventListener("blur", () => {
    pause("blur");
  });

  // ---------------------------------------------------------------- 音效开关

  let mutedNow = storage.get("sound") === "off";

  function paintSound() {
    if (!dom.sound) {
      return;
    }

    dom.sound.setAttribute("aria-pressed", mutedNow ? "false" : "true");
    dom.sound.title = mutedNow ? "音效已关闭" : "音效已开启";
  }

  dom.sound?.addEventListener("click", () => {
    mutedNow = !mutedNow;
    storage.set("sound", mutedNow ? "off" : "on");
    sound.setMuted(mutedNow);
    paintSound();
    sound.unlock();
    sound.play("click");
  });

  sound.setMuted(mutedNow);
  paintSound();

  // ---------------------------------------------------------------- 与父页面通信

  function post(type, payload = {}) {
    if (window.parent === window) {
      return;
    }

    try {
      window.parent.postMessage({ source: "sub2api-games", game: meta.game, type, ...payload }, "*");
    } catch {
      /* 跨域被拒就算了，游戏本身不受影响 */
    }
  }

  window.addEventListener("message", (event) => {
    const data = event.data;

    if (!data || data.target !== "sub2api-games") {
      return;
    }

    if (data.type === "pause") {
      pause("manual");
      return;
    }

    if (data.type === "resume") {
      resume();
      return;
    }

    if (data.type === "task-done") {
      pause("manual");
      showToast(data.name ? `「${data.name}」跑完了，回去看看` : "任务跑完了，回去看看");
    }
  });

  let toastTimer = 0;

  function showToast(text) {
    if (!dom.toast) {
      return;
    }

    dom.toast.textContent = text;
    dom.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 5200);
  }

  // ---------------------------------------------------------------- 启动

  resize();
  instance = create(env) || {};
  paintStats({});
  instance.reset?.();
  paintScore();
  paintClock();
  paintBest();
  paintRecords();
  paintPlayState();
  resetOverlayCopy();

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => resize()).observe(column);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", () => {
    const active = Boolean(document.fullscreenElement);

    if (dom.fullscreen) {
      dom.fullscreen.title = active ? "退出全屏" : "全屏";
      dom.fullscreen.setAttribute("aria-label", active ? "退出全屏" : "全屏");
    }

    resize();
    window.setTimeout(resize, 120);
  });

  requestAnimationFrame(frame);
  post("ready", { state: "idle", best: game.best });
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// -------------------------------------------------------------------- 存储

function createStorage() {
  const safe = (fn, fallback) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  return {
    get(key) {
      return safe(() => window.localStorage.getItem(STORAGE_PREFIX + key), null);
    },
    set(key, value) {
      return safe(() => window.localStorage.setItem(STORAGE_PREFIX + key, String(value)), null);
    },
    getInt(key, fallback = 0) {
      const raw = safe(() => window.localStorage.getItem(STORAGE_PREFIX + key), null);
      const value = Number.parseInt(raw ?? "", 10);
      return Number.isFinite(value) ? value : fallback;
    },
    setInt(key, value) {
      return safe(
        () => window.localStorage.setItem(STORAGE_PREFIX + key, String(Math.round(value))),
        null
      );
    },
    getJson(key, fallback = null) {
      const raw = safe(() => window.localStorage.getItem(STORAGE_PREFIX + key), null);

      if (!raw) {
        return fallback;
      }

      return safe(() => JSON.parse(raw), fallback);
    },
    setJson(key, value) {
      return safe(
        () => window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)),
        null
      );
    }
  };
}

// -------------------------------------------------------------------- 音效

/**
 * 用 WebAudio 现场合成，没有任何音频文件，所以也不占带宽。
 */
function createSound(storage) {
  let context = null;
  let muted = storage.get("sound") === "off";

  function ensure() {
    if (context) {
      return context;
    }

    const Ctor = window.AudioContext || window.webkitAudioContext;

    if (!Ctor) {
      return null;
    }

    try {
      context = new Ctor();
    } catch {
      context = null;
    }

    return context;
  }

  function tone(freq, duration, { type = "sine", gain = 0.06, delay = 0, slide = 0 } = {}) {
    const audio = ensure();

    if (!audio || muted) {
      return;
    }

    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const amp = audio.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + duration);
    }

    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  const presets = {
    eat: () => {
      tone(640, 0.08, { type: "triangle", gain: 0.05 });
      tone(960, 0.07, { type: "triangle", gain: 0.032, delay: 0.045 });
    },
    golden: () => {
      tone(780, 0.09, { type: "triangle", gain: 0.05 });
      tone(1040, 0.09, { type: "triangle", gain: 0.042, delay: 0.07 });
      tone(1320, 0.12, { type: "sine", gain: 0.035, delay: 0.14 });
    },
    level: () => {
      tone(520, 0.09, { type: "sine", gain: 0.04 });
      tone(700, 0.1, { type: "sine", gain: 0.04, delay: 0.08 });
    },
    start: () => {
      tone(520, 0.1, { type: "sine", gain: 0.05 });
      tone(780, 0.14, { type: "sine", gain: 0.04, delay: 0.08 });
    },
    click: () => tone(440, 0.05, { type: "sine", gain: 0.03 }),
    pause: () => tone(320, 0.1, { type: "sine", gain: 0.035 }),
    // 方块类游戏用的短音：移动、旋转要轻，别吵。
    move: () => tone(300, 0.035, { type: "square", gain: 0.014 }),
    rotate: () => tone(430, 0.05, { type: "triangle", gain: 0.028 }),
    hold: () => {
      tone(520, 0.06, { type: "triangle", gain: 0.03 });
      tone(690, 0.07, { type: "triangle", gain: 0.024, delay: 0.05 });
    },
    drop: () => {
      tone(220, 0.09, { type: "sawtooth", gain: 0.03, slide: -110 });
      tone(90, 0.14, { type: "sine", gain: 0.045, delay: 0.03 });
    },
    lock: () => {
      tone(180, 0.07, { type: "square", gain: 0.024 });
      tone(120, 0.09, { type: "sine", gain: 0.03, delay: 0.03 });
    },
    clear: () => {
      tone(620, 0.08, { type: "triangle", gain: 0.04 });
      tone(820, 0.09, { type: "triangle", gain: 0.036, delay: 0.06 });
      tone(1040, 0.11, { type: "sine", gain: 0.03, delay: 0.12 });
    },
    bigclear: () => {
      tone(660, 0.09, { type: "triangle", gain: 0.045 });
      tone(880, 0.09, { type: "triangle", gain: 0.042, delay: 0.07 });
      tone(1100, 0.1, { type: "triangle", gain: 0.038, delay: 0.14 });
      tone(1320, 0.16, { type: "sine", gain: 0.034, delay: 0.21 });
    },
    over: () => {
      tone(360, 0.2, { type: "sawtooth", gain: 0.03, slide: -170 });
      tone(190, 0.3, { type: "sine", gain: 0.04, delay: 0.1 });
    },
    best: () => {
      tone(660, 0.1, { type: "triangle", gain: 0.05 });
      tone(880, 0.1, { type: "triangle", gain: 0.05, delay: 0.09 });
      tone(1180, 0.16, { type: "triangle", gain: 0.045, delay: 0.18 });
    }
  };

  return {
    unlock() {
      const audio = ensure();

      if (audio && audio.state === "suspended") {
        void audio.resume();
      }
    },
    play(name) {
      presets[name]?.();
    },
    setMuted(value) {
      muted = value;
    }
  };
}
