import { startGame } from "../../shell.js";

/**
 * 俄罗斯方块。
 *
 * 10×20 的棋盘，七种方块按 7-bag 随机落下，带落点阴影、三格预览和暂存。
 * 旋转不追求完整 SRS，只做「水平 ±1/±2、上抬一格」的简易踢墙，手感够用；
 * 长按左右靠 DAS/ARR 自己算，不依赖系统的按键重复。
 */

const COLS = 10;
const ROWS = 20;
const TAU = Math.PI * 2;

const DAS_DELAY = 0.15; // 长按后开始连发前的等待
const ARR = 0.048; // 连发间隔
const SOFT_FACTOR = 18; // 软降时重力加速倍数
const LOCK_DELAY = 0.42;
const LOCK_RESET_LIMIT = 12;
const CLEAR_TIME = 0.32;
const NEXT_COUNT = 3;
const QUEUE_MIN = NEXT_COUNT + 1;
const MAX_PARTICLES = 200;

const PIECES = {
  I: { color: "#22d3ee", mat: ["....", "####", "....", "...."] },
  J: { color: "#5b8def", mat: ["#..", "###", "..."] },
  L: { color: "#f2913d", mat: ["..#", "###", "..."] },
  O: { color: "#f2c94c", mat: ["##", "##"] },
  S: { color: "#3fbf7f", mat: [".##", "##.", "..."] },
  T: { color: "#a970f2", mat: [".#.", "###", "..."] },
  Z: { color: "#e86a6a", mat: ["##.", ".##", "..."] }
};

const TYPES = Object.keys(PIECES);
const LINE_SCORE = { 1: 100, 2: 300, 3: 500, 4: 800 };
const LINE_LABEL = { 1: "SINGLE", 2: "DOUBLE", 3: "TRIPLE", 4: "TETRIS!" };
const KICKS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-2, 0],
  [2, 0],
  [-1, -1],
  [1, -1]
];

startGame((env) => {
  const { ctx, api } = env;

  const state = {
    board: [],
    piece: null,
    queue: [],
    bag: [],
    hold: null,
    holdUsed: false,
    score: 0,
    lines: 0,
    level: 1,
    pieces: 0,
    combo: -1,
    b2b: false,
    gravityAcc: 0,
    lockTimer: 0,
    lockResets: 0,
    clearing: null,
    dead: false,
    t: 0,
    particles: [],
    pops: [],
    banner: null,
    flash: 0,
    shake: 0
  };

  const input = { dir: 0, das: 0, arr: 0, soft: false };

  let size = 0;
  let cell = 0;
  let boardX = 0;
  let boardY = 0;
  let boardW = 0;
  let boardH = 0;
  let leftX = 0;
  let rightX = 0;
  let sideY = 0;
  let sideW = 0;
  let sideH = 0;
  let paletteCache = null;
  const blockCache = new Map();

  // ---------------------------------------------------------------- 逻辑

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  }

  function reset() {
    state.board = emptyBoard();
    state.piece = null;
    state.queue = [];
    state.bag = [];
    state.hold = null;
    state.holdUsed = false;
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.pieces = 0;
    state.combo = -1;
    state.b2b = false;
    state.gravityAcc = 0;
    state.lockTimer = 0;
    state.lockResets = 0;
    state.clearing = null;
    state.dead = false;
    state.t = 0;
    state.particles = [];
    state.pops = [];
    state.banner = null;
    state.flash = 0;
    state.shake = 0;
    input.dir = 0;
    input.das = 0;
    input.arr = 0;
    input.soft = false;

    refillQueue();
    spawnNext();
    api.setScore(0);
    syncStats();
  }

  function syncStats() {
    api.setStats({ 等级: state.level, 消行: state.lines, 方块: state.pieces });
  }

  function addScore(amount) {
    state.score += Math.round(amount);
    api.setScore(state.score);
  }

  function gravityFor(level) {
    return Math.max(0.045, 0.78 * 0.845 ** (level - 1));
  }

  function refillQueue() {
    while (state.queue.length < QUEUE_MIN) {
      if (state.bag.length === 0) {
        state.bag = [...TYPES];

        for (let i = state.bag.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
        }
      }

      state.queue.push(state.bag.pop());
    }
  }

  function takeFromQueue() {
    const type = state.queue.shift();
    refillQueue();
    return type;
  }

  function makePiece(type) {
    const mat = PIECES[type].mat.map((row) => row.split(""));
    const topRow = mat.findIndex((row) => row.includes("#"));
    const width = mat[0].length;

    return {
      type,
      mat,
      x: Math.floor((COLS - width) / 2),
      // 让方块最高的那一行正好落在棋盘第 0 行
      y: -Math.max(0, topRow)
    };
  }

  function collides(mat, px, py) {
    for (let y = 0; y < mat.length; y += 1) {
      for (let x = 0; x < mat[y].length; x += 1) {
        if (mat[y][x] !== "#") {
          continue;
        }

        const bx = px + x;
        const by = py + y;

        if (bx < 0 || bx >= COLS || by >= ROWS) {
          return true;
        }

        // 棋盘上方（by < 0）算空的，方块出生时有一半在棋盘外
        if (by >= 0 && state.board[by][bx]) {
          return true;
        }
      }
    }

    return false;
  }

  function placePiece(type) {
    if (!type) {
      return;
    }

    const piece = makePiece(type);
    state.gravityAcc = 0;
    state.lockTimer = 0;
    state.lockResets = 0;

    if (collides(piece.mat, piece.x, piece.y)) {
      state.piece = null;
      topOut();
      return;
    }

    state.piece = piece;
  }

  function spawnNext() {
    state.holdUsed = false;
    placePiece(takeFromQueue());
  }

  function tryMove(dx, dy) {
    const piece = state.piece;

    if (!piece) {
      return false;
    }

    if (collides(piece.mat, piece.x + dx, piece.y + dy)) {
      return false;
    }

    piece.x += dx;
    piece.y += dy;

    if ((dx !== 0 || dy < 0) && state.lockResets < LOCK_RESET_LIMIT) {
      state.lockTimer = 0;
      state.lockResets += 1;
    }

    return true;
  }

  function rotateMat(mat) {
    const n = mat.length;
    const out = Array.from({ length: n }, () => new Array(n).fill("."));

    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        out[x][n - 1 - y] = mat[y][x];
      }
    }

    return out;
  }

  function rotatePiece(times = 1) {
    const piece = state.piece;

    if (!piece || state.clearing) {
      return;
    }

    let mat = piece.mat;

    for (let i = 0; i < times; i += 1) {
      mat = rotateMat(mat);
    }

    for (const [dx, dy] of KICKS) {
      if (!collides(mat, piece.x + dx, piece.y + dy)) {
        piece.mat = mat;
        piece.x += dx;
        piece.y += dy;

        if (state.lockResets < LOCK_RESET_LIMIT) {
          state.lockTimer = 0;
          state.lockResets += 1;
        }

        api.sound("rotate");
        return;
      }
    }
  }

  function shift(dir) {
    if (!state.piece || state.clearing) {
      return;
    }

    if (tryMove(dir, 0)) {
      api.sound("move");
    }
  }

  function doHold() {
    if (!state.piece || state.clearing || state.holdUsed) {
      return;
    }

    const current = state.piece.type;
    const swap = state.hold;

    state.hold = current;
    state.holdUsed = true;

    if (swap) {
      placePiece(swap);
    } else {
      placePiece(takeFromQueue());
    }

    api.sound("hold");
  }

  function hardDrop() {
    const piece = state.piece;

    if (!piece || state.clearing) {
      return;
    }

    let dist = 0;

    while (tryMove(0, 1)) {
      dist += 1;
    }

    if (dist > 0) {
      addScore(dist * 2);
    }

    if (!env.reduceMotion) {
      state.shake = Math.min(0.3, 0.1 + dist * 0.014);
    }

    api.sound("drop");
    lockPiece();
  }

  function lockPiece() {
    const piece = state.piece;

    if (!piece) {
      return;
    }

    let overflow = true;

    for (let y = 0; y < piece.mat.length; y += 1) {
      for (let x = 0; x < piece.mat[y].length; x += 1) {
        if (piece.mat[y][x] !== "#") {
          continue;
        }

        const by = piece.y + y;
        const bx = piece.x + x;

        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          state.board[by][bx] = piece.type;
          overflow = false;
        }
      }
    }

    state.piece = null;
    state.pieces += 1;

    if (overflow) {
      topOut();
      return;
    }

    const rows = [];

    for (let y = 0; y < ROWS; y += 1) {
      if (state.board[y].every((value) => value)) {
        rows.push(y);
      }
    }

    syncStats();

    if (rows.length > 0) {
      startClear(rows);
      return;
    }

    state.combo = -1;
    api.sound("lock");
    spawnNext();
  }

  function startClear(rows) {
    const count = rows.length;
    const gain = LINE_SCORE[count] || 100;
    const level = state.level;

    state.combo += 1;

    let total = gain * level;

    if (count === 4 && state.b2b) {
      total = Math.round(total * 1.5);
    }

    if (state.combo > 0) {
      total += 50 * state.combo * level;
    }

    state.b2b = count === 4;
    state.lines += count;
    addScore(total);

    state.clearing = { rows: rows.slice(), t: 0, max: CLEAR_TIME };
    api.sound(count === 4 ? "bigclear" : "clear");

    for (const row of rows) {
      for (let x = 0; x < COLS; x += 1) {
        const type = state.board[row][x];

        if (type) {
          burst(x, row, PIECES[type].color, count === 4 ? 4 : 3);
        }
      }
    }

    const middle = rows.reduce((sum, row) => sum + row, 0) / rows.length;

    state.pops.push({
      text: `+${total}`,
      note: LINE_LABEL[count] || "",
      x: COLS / 2,
      row: middle,
      life: 1.2,
      big: count === 4
    });

    if (count === 4) {
      state.flash = 0.7;
      state.banner = { text: "TETRIS!", sub: "四行清除", life: 1.3, max: 1.3 };
    } else if (count >= 2) {
      state.banner = {
        text: LINE_LABEL[count],
        sub: `+${total}`,
        life: 1.1,
        max: 1.1
      };
    }

    const nextLevel = 1 + Math.floor(state.lines / 10);

    if (nextLevel > state.level) {
      state.level = nextLevel;
      state.banner = { text: `LEVEL ${state.level}`, sub: "速度提升", life: 1.3, max: 1.3 };
      api.sound("level");
      syncStats();
    }
  }

  function applyClear() {
    const rows = state.clearing ? state.clearing.rows : [];
    const kept = state.board.filter((_row, index) => !rows.includes(index));

    while (kept.length < ROWS) {
      kept.unshift(new Array(COLS).fill(null));
    }

    state.board = kept;
    state.clearing = null;
    spawnNext();
    syncStats();
  }

  function topOut() {
    if (state.dead) {
      return;
    }

    state.dead = true;
    state.piece = null;
    state.flash = 0.6;
    state.shake = env.reduceMotion ? 0 : 0.45;

    api.gameOver({
      score: state.score,
      stats: { 等级: state.level, 消行: state.lines, 方块: state.pieces }
    });
  }

  // ---------------------------------------------------------------- 输入

  function onKey(key) {
    const phase = api.getState();

    if (key === "p" || key === "P" || key === "Escape") {
      if (phase === "idle") {
        return false;
      }

      api.togglePause();
      return true;
    }

    if (phase !== "running") {
      return false;
    }

    if (state.dead) {
      return true;
    }

    switch (key) {
      case "ArrowLeft":
      case "a":
      case "A":
        input.dir = -1;
        input.das = DAS_DELAY;
        input.arr = ARR;
        shift(-1);
        return true;
      case "ArrowRight":
      case "d":
      case "D":
        input.dir = 1;
        input.das = DAS_DELAY;
        input.arr = ARR;
        shift(1);
        return true;
      case "ArrowDown":
      case "s":
      case "S":
        input.soft = true;

        if (tryMove(0, 1)) {
          addScore(1);
        }

        return true;
      case "ArrowUp":
      case "x":
      case "X":
        rotatePiece(1);
        return true;
      case "z":
      case "Z":
        rotatePiece(3);
        return true;
      case " ":
      case "Spacebar":
        hardDrop();
        return true;
      case "c":
      case "C":
        doHold();
        return true;
      default:
        return false;
    }
  }

  function onKeyUp(key) {
    if (
      (key === "ArrowLeft" || key === "a" || key === "A") && input.dir === -1
    ) {
      input.dir = 0;
    }

    if (
      (key === "ArrowRight" || key === "d" || key === "D") && input.dir === 1
    ) {
      input.dir = 0;
    }

    if (key === "ArrowDown" || key === "s" || key === "S") {
      input.soft = false;
    }
  }

  // 触屏方向键与滑动：上=旋转，下=软降一格，左右=移动；轻点画布=直落。
  function onDirection(dir) {
    if (state.dead || state.clearing || !state.piece) {
      return;
    }

    if (dir === "left") {
      shift(-1);
      return;
    }

    if (dir === "right") {
      shift(1);
      return;
    }

    if (dir === "up") {
      rotatePiece(1);
      return;
    }

    if (dir === "down" && tryMove(0, 1)) {
      addScore(1);
    }
  }

  function onTap() {
    hardDrop();
  }

  // ---------------------------------------------------------------- 布局

  function layout() {
    size = Math.min(env.size.width, env.size.height);

    if (!size) {
      return;
    }

    const outer = Math.round(size * 0.026);
    const gap = Math.max(6, size * 0.022);

    // 棋盘是 1:2，正方形画布里只能占一半宽；剩下的左右两栏放 HOLD 和 NEXT。
    cell = (size - outer * 2) / ROWS;
    boardW = cell * COLS;
    boardH = cell * ROWS;
    boardX = (size - boardW) / 2;
    boardY = outer;
    sideY = boardY;
    sideH = boardH;
    leftX = outer;
    rightX = boardX + boardW + gap;
    sideW = Math.max(18, boardX - gap - outer);

    blockCache.clear();
  }

  function palette() {
    if (paletteCache) {
      return paletteCache;
    }

    const fallback = {
      boardA: "#fbfaff",
      boardB: "#f1edfd",
      grid: "rgba(124, 92, 255, 0.08)",
      ink: "#16202b",
      sub: "rgba(22, 32, 43, 0.55)",
      vignette: "rgba(56, 32, 110, 0.07)",
      gutter: "#e9e5f7",
      frame: "rgba(124, 92, 255, 0.2)",
      glow: "rgba(124, 92, 255, 0.09)",
      panel: "rgba(255, 255, 255, 0.7)",
      panelActive: "rgba(124, 92, 255, 0.12)",
      panelLine: "rgba(16, 24, 40, 0.08)",
      panelInk: "#16202b",
      panelLabel: "rgba(22, 32, 43, 0.5)"
    };

    paletteCache = fallback;

    try {
      const el = document.documentElement;
      const style = el && typeof getComputedStyle === "function" ? getComputedStyle(el) : null;

      if (style) {
        const read = (name, fb) => (style.getPropertyValue(name) || "").trim() || fb;
        paletteCache = {
          boardA: read("--tetris-board-a", fallback.boardA),
          boardB: read("--tetris-board-b", fallback.boardB),
          grid: read("--tetris-grid", fallback.grid),
          ink: read("--tetris-ink", fallback.ink),
          sub: read("--tetris-sub", fallback.sub),
          vignette: read("--tetris-vignette", fallback.vignette),
          gutter: read("--tetris-gutter", fallback.gutter),
          frame: read("--tetris-frame", fallback.frame),
          glow: read("--tetris-glow", fallback.glow),
          panel: read("--tetris-panel", fallback.panel),
          panelActive: read("--tetris-panel-active", fallback.panelActive),
          panelLine: read("--tetris-panel-line", fallback.panelLine),
          panelInk: read("--tetris-panel-ink", fallback.panelInk),
          panelLabel: read("--tetris-panel-label", fallback.panelLabel)
        };
      }
    } catch {
      paletteCache = fallback;
    }

    return paletteCache;
  }

  // ---------------------------------------------------------------- 绘制

  /** 方块画法按（颜色 + 边长）缓存，避免每帧都建渐变。 */
  function blockPaint(color, side) {
    const key = `${color}@${side.toFixed(2)}`;
    const cached = blockCache.get(key);

    if (cached) {
      return cached;
    }

    const pad = Math.max(0.6, side * 0.05);
    const span = side - pad * 2;
    const radius = Math.max(2, span * 0.24);
    const fill = ctx.createLinearGradient(0, 0, span * 0.55, span);
    fill.addColorStop(0, shade(color, 0.26));
    fill.addColorStop(0.5, color);
    fill.addColorStop(1, shade(color, -0.32));

    const paint = {
      pad,
      span,
      radius,
      fill,
      gloss: "rgba(255, 255, 255, 0.32)",
      edge: "rgba(10, 12, 28, 0.22)",
      line: Math.max(1, span * 0.055)
    };

    // 消行动画会给每个色块生成一堆中间尺寸，缓存超过上限就整体丢掉重来
    if (blockCache.size > 256) {
      blockCache.clear();
    }

    blockCache.set(key, paint);

    return paint;
  }

  function paintBlock(px, py, side, color, alpha = 1) {
    const paint = blockPaint(color, side);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    ctx.fillStyle = paint.fill;
    ctx.beginPath();
    ctx.roundRect(paint.pad, paint.pad, paint.span, paint.span, paint.radius);
    ctx.fill();

    ctx.fillStyle = paint.gloss;
    ctx.beginPath();
    ctx.roundRect(
      paint.pad + paint.span * 0.14,
      paint.pad + paint.span * 0.1,
      paint.span * 0.72,
      paint.span * 0.2,
      paint.span * 0.1
    );
    ctx.fill();

    ctx.strokeStyle = paint.edge;
    ctx.lineWidth = paint.line;
    ctx.beginPath();
    ctx.roundRect(
      paint.pad + paint.line / 2,
      paint.pad + paint.line / 2,
      paint.span - paint.line,
      paint.span - paint.line,
      Math.max(1.5, paint.radius - paint.line / 2)
    );
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    if (!size || Math.abs(size - Math.min(env.size.width, env.size.height)) > 0.5) {
      layout();
    }

    if (!size) {
      return;
    }

    if (state.board.length === 0) {
      return;
    }

    const p = palette();

    ctx.fillStyle = p.gutter;
    ctx.fillRect(0, 0, size, size);

    ctx.save();

    if (state.shake > 0) {
      const amount = state.shake * cell * 0.45;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }

    drawBoard(p);
    drawStack();
    drawGhost();
    drawPiece();
    drawClearing();
    drawParticles();
    drawSides(p);
    drawPops(p);
    drawBanner();
    ctx.restore();

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.32})`;
      ctx.fillRect(0, 0, size, size);
    }
  }

  function drawBoard(p) {
    const radius = Math.max(3, cell * 0.45);

    // 棋盘底：竖向渐变，比外围亮一档
    const grad = ctx.createLinearGradient(boardX, boardY, boardX + boardW * 0.3, boardY + boardH);
    grad.addColorStop(0, p.boardA);
    grad.addColorStop(1, p.boardB);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardW, boardH, radius);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardW, boardH, radius);
    ctx.clip();

    // 顶部环境光
    const glow = ctx.createLinearGradient(0, boardY, 0, boardY + boardH * 0.45);
    glow.addColorStop(0, p.glow);
    glow.addColorStop(1, "rgba(124, 92, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(boardX, boardY, boardW, boardH);

    // 网格
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;

    for (let i = 1; i < COLS; i += 1) {
      const x = Math.round(boardX + i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, boardY);
      ctx.lineTo(x, boardY + boardH);
      ctx.stroke();
    }

    for (let i = 1; i < ROWS; i += 1) {
      const y = Math.round(boardY + i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(boardX, y);
      ctx.lineTo(boardX + boardW, y);
      ctx.stroke();
    }

    // 堆得太高时顶部泛红，给个危险提示
    const top = topRow();

    if (top !== null && top < ROWS * 0.3) {
      const heat = Math.min(1, (ROWS * 0.3 - top) / (ROWS * 0.3));
      const rise = ctx.createLinearGradient(0, boardY, 0, boardY + boardH * 0.45);
      rise.addColorStop(0, `rgba(226, 72, 68, ${0.16 * heat})`);
      rise.addColorStop(1, "rgba(226, 72, 68, 0)");
      ctx.fillStyle = rise;
      ctx.fillRect(boardX, boardY, boardW, boardH * 0.45);
    }

    const vignette = ctx.createRadialGradient(
      boardX + boardW / 2,
      boardY + boardH / 2,
      boardW * 0.35,
      boardX + boardW / 2,
      boardY + boardH / 2,
      boardH * 0.72
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, p.vignette);
    ctx.fillStyle = vignette;
    ctx.fillRect(boardX, boardY, boardW, boardH);
    ctx.restore();

    // 边框
    ctx.strokeStyle = p.frame;
    ctx.lineWidth = Math.max(1, cell * 0.08);
    ctx.beginPath();
    ctx.roundRect(boardX + 0.5, boardY + 0.5, boardW - 1, boardH - 1, radius);
    ctx.stroke();
  }

  function topRow() {
    for (let y = 0; y < ROWS; y += 1) {
      if (state.board[y].some((value) => value)) {
        return y;
      }
    }

    return null;
  }

  function drawStack() {
    const clearing = state.clearing ? state.clearing.rows : [];

    for (let y = 0; y < ROWS; y += 1) {
      if (clearing.includes(y)) {
        continue;
      }

      for (let x = 0; x < COLS; x += 1) {
        const type = state.board[y][x];

        if (type) {
          paintBlock(boardX + x * cell, boardY + y * cell, cell, PIECES[type].color);
        }
      }
    }
  }

  function drawGhost() {
    const piece = state.piece;

    if (!piece || state.dead) {
      return;
    }

    let gy = piece.y;

    while (!collides(piece.mat, piece.x, gy + 1)) {
      gy += 1;
    }

    if (gy === piece.y) {
      return;
    }

    const color = PIECES[piece.type].color;
    const radius = Math.max(2, cell * 0.22);

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, cell * 0.09);
    ctx.setLineDash([cell * 0.22, cell * 0.18]);

    for (let y = 0; y < piece.mat.length; y += 1) {
      for (let x = 0; x < piece.mat[y].length; x += 1) {
        if (piece.mat[y][x] !== "#") {
          continue;
        }

        const px = boardX + (piece.x + x) * cell;
        const py = boardY + (gy + y) * cell;
        const inset = cell * 0.13;

        ctx.beginPath();
        ctx.roundRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2, radius);
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawPiece() {
    const piece = state.piece;

    if (!piece || state.dead) {
      return;
    }

    ctx.save();
    ctx.shadowColor = PIECES[piece.type].color;
    ctx.shadowBlur = cell * (0.62 + Math.sin(state.t * 5) * 0.14);

    for (let y = 0; y < piece.mat.length; y += 1) {
      for (let x = 0; x < piece.mat[y].length; x += 1) {
        if (piece.mat[y][x] !== "#") {
          continue;
        }

        paintBlock(
          boardX + (piece.x + x) * cell,
          boardY + (piece.y + y) * cell,
          cell,
          PIECES[piece.type].color
        );
      }
    }

    ctx.restore();
  }

  function drawClearing() {
    if (!state.clearing) {
      return;
    }

    const { rows, t, max } = state.clearing;
    const progress = Math.min(1, t / max);

    ctx.save();

    for (const row of rows) {
      const y = boardY + row * cell;

      for (let x = 0; x < COLS; x += 1) {
        const type = state.board[row][x];

        if (!type) {
          continue;
        }

        const shrink = 1 - progress * 0.7;
        const side = cell * shrink;
        const cx = boardX + x * cell + cell / 2;
        const cy = y + cell / 2 - progress * cell * 0.7;

        paintBlock(cx - side / 2, cy - side / 2, side, PIECES[type].color, 1 - progress);
      }

      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - progress)})`;
      ctx.fillRect(boardX, y, boardW, cell);
    }

    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const alpha = Math.max(0, Math.min(1, particle.life / particle.max));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawPops(p) {
    for (const pop of state.pops) {
      if (pop.life <= 0) {
        continue;
      }

      const age = 1 - pop.life;
      const x = boardX + pop.x * cell;
      const y = boardY + pop.row * cell;
      const rise = easeOutCubic(Math.min(1, age * 1.7)) * cell * 1.6;

      ctx.save();
      ctx.globalAlpha = Math.min(1, pop.life * 1.5);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(x, y - rise);
      ctx.fillStyle = pop.big ? "#7c5cff" : p.ink;
      ctx.font = `800 ${Math.round(cell * (pop.big ? 0.62 : 0.5))}px "Avenir Next", "PingFang SC", sans-serif`;
      ctx.fillText(pop.text, 0, 0);

      if (pop.note) {
        ctx.fillStyle = pop.big ? "#a970f2" : "#7c5cff";
        ctx.font = `700 ${Math.round(cell * 0.3)}px "Avenir Next", "PingFang SC", sans-serif`;
        ctx.fillText(pop.note, 0, cell * 0.52);
      }

      ctx.restore();
    }
  }

  // 左栏 HOLD（紧凑布局时再带分数），右栏 NEXT。
  function drawSides(p) {
    const unit = Math.max(6, Math.min(sideW * 0.17, cell * 0.44));
    const labelH = unit * 1.7;
    const gap = unit * 0.9;

    const holdH = Math.min(cell * 3.3, sideH * 0.16);
    const holdY = sideY + labelH;

    drawLabel(p, "HOLD", leftX, sideY, unit);
    drawPlate(p, leftX, holdY, sideW, holdH, Boolean(state.hold) && !state.holdUsed);

    if (state.hold) {
      drawPreview(state.hold, leftX, holdY, sideW, holdH, state.holdUsed ? 0.4 : 1);
    } else {
      drawEmptySlot(p, leftX, holdY, sideW, holdH);
    }

    const nextGap = unit * 0.5;
    const nextH = Math.min(cell * 2.9, (sideH - labelH - nextGap * 2 - gap) / NEXT_COUNT);

    drawLabel(p, "NEXT", rightX, sideY, unit);

    for (let i = 0; i < NEXT_COUNT; i += 1) {
      const type = state.queue[i];
      const y = sideY + labelH + i * (nextH + nextGap);

      drawPlate(p, rightX, y, sideW, nextH, i === 0);

      if (type) {
        drawPreview(type, rightX, y, sideW, nextH, i === 0 ? 1 : 0.6);
      }
    }

    if (!env.isEmbed && !env.compact) {
      return;
    }

    // 窄屏 / 嵌入时侧栏不可见，把分数、等级、消行画到左下角。
    const available = sideH - labelH - holdH - gap;
    const statH = Math.min(sideH * 0.34, cell * 6, available);

    if (statH > unit * 2.4) {
      drawCanvasStats(p, leftX, sideY + sideH - statH, sideW, statH, unit);
    }
  }

  function drawLabel(p, text, x, y, unit) {
    ctx.fillStyle = p.panelLabel;
    ctx.font = `700 ${Math.round(unit)}px "Avenir Next", "PingFang SC", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + unit * 0.18, y + unit * 0.7);
  }

  function drawPlate(p, x, y, w, h, active) {
    const radius = Math.max(4, h * 0.18);

    ctx.fillStyle = active ? p.panelActive : p.panel;
    ctx.strokeStyle = p.panelLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
  }

  /** 没有暂存方块时，画个虚线的空槽提示这里可以放东西。 */
  function drawEmptySlot(p, x, y, w, h) {
    const inset = Math.min(w, h) * 0.2;

    ctx.save();
    ctx.strokeStyle = p.panelLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([Math.max(3, h * 0.1), Math.max(2.5, h * 0.08)]);
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(3, h * 0.12));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawPreview(type, x, y, w, h, alpha) {
    const mat = PIECES[type].mat.map((row) => row.split(""));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let row = 0; row < mat.length; row += 1) {
      for (let col = 0; col < mat[row].length; col += 1) {
        if (mat[row][col] !== "#") {
          continue;
        }

        minX = Math.min(minX, col);
        maxX = Math.max(maxX, col);
        minY = Math.min(minY, row);
        maxY = Math.max(maxY, row);
      }
    }

    if (minX === Infinity) {
      return;
    }

    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const side = Math.min((w * 0.72) / cols, (h * 0.68) / rows);
    const originX = x + (w - cols * side) / 2 - minX * side;
    const originY = y + (h - rows * side) / 2 - minY * side;

    for (let row = 0; row < mat.length; row += 1) {
      for (let col = 0; col < mat[row].length; col += 1) {
        if (mat[row][col] === "#") {
          paintBlock(originX + col * side, originY + row * side, side, PIECES[type].color, alpha);
        }
      }
    }
  }

  function drawCanvasStats(p, x, y, w, h, unit) {
    if (h <= unit * 2) {
      return;
    }

    drawPlate(p, x, y, w, h, false);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.panelLabel;
    ctx.font = `700 ${Math.round(unit * 0.86)}px "Avenir Next", "PingFang SC", sans-serif`;
    ctx.fillText("得分", x + unit * 0.8, y + unit * 1.1);

    ctx.fillStyle = p.panelInk;
    ctx.font = `800 ${Math.round(unit * 1.7)}px "Avenir Next", "PingFang SC", sans-serif`;
    ctx.fillText(String(state.score), x + unit * 0.8, y + h * 0.44);

    ctx.fillStyle = p.sub;
    ctx.font = `700 ${Math.round(unit * 0.92)}px "Avenir Next", "PingFang SC", sans-serif`;
    ctx.fillText(`LV ${state.level}`, x + unit * 0.8, y + h - unit * 1.1);
    ctx.fillText(
      `消行 ${state.lines}`,
      x + unit * 0.8 + ctx.measureText(`LV ${state.level}`).width + unit * 1.1,
      y + h - unit * 1.1
    );
  }

  function drawBanner() {
    if (!state.banner || state.banner.life <= 0) {
      return;
    }

    const banner = state.banner;
    const progress = 1 - banner.life / banner.max;
    const alpha = Math.min(1, (1 - progress) * 2.6);
    const pop = 0.84 + 0.16 * Math.min(1, progress * 8);
    const cx = boardX + boardW / 2;
    const cy = boardY + cell * 3.2 - progress * cell * 0.4;
    const titleFont = `800 ${Math.round(cell * 0.5)}px "Avenir Next", "PingFang SC", sans-serif`;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = titleFont;
    const width = Math.min(boardW * 0.94, ctx.measureText(banner.text).width + cell * 2.8);
    const height = cell * 1.6;

    ctx.translate(cx, cy);
    ctx.scale(pop, pop);

    ctx.fillStyle = "rgba(18, 12, 38, 0.78)";
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, height / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 181, 253, 0.34)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#f4efff";
    ctx.font = titleFont;
    ctx.fillText(banner.text, 0, -cell * 0.16);

    ctx.fillStyle = "rgba(224, 214, 255, 0.76)";
    ctx.font = `600 ${Math.round(cell * 0.27)}px "Avenir Next", "PingFang SC", sans-serif`;
    ctx.fillText(banner.sub, 0, cell * 0.4);
    ctx.restore();
  }

  // ---------------------------------------------------------------- 特效 / 主循环

  function burst(cx, cy, color, count) {
    if (!size) {
      return;
    }

    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= MAX_PARTICLES) {
        return;
      }

      const angle = Math.random() * TAU;
      const speed = cell * (1.4 + Math.random() * 3.2);

      state.particles.push({
        x: boardX + cx * cell + cell / 2,
        y: boardY + cy * cell + cell / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - cell * 1.1,
        life: 0.5 + Math.random() * 0.35,
        max: 0.85,
        size: cell * (0.06 + Math.random() * 0.1),
        color
      });
    }
  }

  function stepEffects(dt) {
    state.t += dt;

    if (state.flash > 0) {
      state.flash = Math.max(0, state.flash - dt * 1.7);
    }

    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 1.9);
    }

    for (const particle of state.particles) {
      particle.life -= dt;
      particle.vy += cell * 13 * dt;
      particle.vx *= 0.985;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }

    state.particles = state.particles.filter((particle) => particle.life > 0);

    for (const pop of state.pops) {
      pop.life -= dt * 1.1;
    }

    state.pops = state.pops.filter((pop) => pop.life > 0);

    if (state.banner) {
      state.banner.life -= dt;

      if (state.banner.life <= 0) {
        state.banner = null;
      }
    }
  }

  function update(dt) {
    stepEffects(dt);

    if (state.dead) {
      return;
    }

    if (state.clearing) {
      state.clearing.t += dt;

      if (state.clearing.t >= state.clearing.max) {
        applyClear();
      }

      return;
    }

    // 长按左右：先等 DAS，再按 ARR 连发
    if (input.dir !== 0) {
      if (input.das > 0) {
        input.das = Math.max(0, input.das - dt);
      } else {
        input.arr -= dt;

        while (input.arr <= 0) {
          input.arr += ARR;

          if (!tryMove(input.dir, 0)) {
            break;
          }
        }
      }
    }

    const interval = gravityFor(state.level) / (input.soft ? SOFT_FACTOR : 1);

    state.gravityAcc += dt;

    let guard = 0;

    while (state.gravityAcc >= interval && guard < 40) {
      state.gravityAcc -= interval;
      guard += 1;

      if (tryMove(0, 1)) {
        if (input.soft) {
          addScore(1);
        }
      } else {
        state.gravityAcc = 0;
        break;
      }
    }

    const piece = state.piece;

    if (piece && collides(piece.mat, piece.x, piece.y + 1)) {
      state.lockTimer += dt;

      if (state.lockTimer >= LOCK_DELAY) {
        lockPiece();
      }
    } else {
      state.lockTimer = 0;
    }
  }

  return { reset, update, draw, onKey, onKeyUp, onDirection, onTap };
});

/** amount > 0 变亮，< 0 变暗。 */
function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const ratio = Math.abs(amount);
  const mix = (channel) => Math.round((target - channel) * ratio + channel);
  const r = mix((value >> 16) & 255);
  const g = mix((value >> 8) & 255);
  const b = mix(value & 255);

  return `rgb(${r}, ${g}, ${b})`;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}
