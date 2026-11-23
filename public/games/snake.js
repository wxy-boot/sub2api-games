import { startGame } from "../shell.js";

/**
 * 贪吃蛇。
 * 逻辑按格推进，渲染按步进进度插值，所以移动是连续的；
 * 蛇身用一条连续路径绘制，转弯处是圆的，不会出现一格格方块；蛇头是俯视的蛇，会吐信。
 */

const COLS = 20;
const ROWS = 20;
const BASE_SPEED = 7.4; // 格/秒
const SPEED_STEP = 0.36;
const MAX_SPEED = 15;
const GOLDEN_EVERY = 5;
const COMBO_WINDOW = 2.6;
const CHOMP_TIME = 0.26;
const MAX_PARTICLES = 120;
const TAU = Math.PI * 2;

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

startGame((env) => {
  const { ctx, api } = env;

  const state = {
    body: [],
    prev: [],
    dir: DIRS.right,
    queue: [],
    food: { x: 0, y: 0, golden: false },
    eaten: 0,
    score: 0,
    speed: BASE_SPEED,
    acc: 0,
    dead: false,
    t: 0,
    combo: 0,
    comboTimer: 0,
    level: 1,
    chomp: 0,
    foodAge: 1,
    particles: [],
    pops: [],
    banner: null,
    flash: 0,
    shake: 0,
    headAngle: 0
  };

  let size = 0;
  let pad = 0;
  let cell = 0;
  let ox = 0;
  let oy = 0;
  let paletteCache = null;

  // ---------------------------------------------------------------- 逻辑

  function reset() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);

    state.body = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy }
    ];
    state.prev = state.body.map((seg) => ({ ...seg }));
    state.dir = DIRS.right;
    state.queue = [];
    state.eaten = 0;
    state.score = 0;
    state.speed = BASE_SPEED;
    state.acc = 0;
    state.dead = false;
    state.t = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.level = 1;
    state.chomp = 0;
    state.foodAge = 1;
    state.particles = [];
    state.pops = [];
    state.banner = null;
    state.flash = 0;
    state.shake = 0;
    state.headAngle = 0;

    placeFood();
    api.setScore(0);
    syncStats();
  }

  function syncStats() {
    api.setStats({
      长度: state.body.length,
      已吃: state.eaten,
      连击: `×${multiplier()}`
    });
  }

  function multiplier() {
    return Math.min(4, 1 + Math.floor(state.combo / 2));
  }

  function placeFood() {
    const taken = new Set(state.body.map((seg) => `${seg.x},${seg.y}`));
    const free = [];

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!taken.has(`${x},${y}`)) {
          free.push({ x, y });
        }
      }
    }

    if (free.length === 0) {
      state.food = { x: -1, y: -1, golden: false };
      return;
    }

    const spot = free[Math.floor(Math.random() * free.length)];
    const golden = (state.eaten + 1) % GOLDEN_EVERY === 0;
    state.food = { ...spot, golden };
    state.foodAge = 0;
  }

  function step() {
    if (state.dead) {
      return;
    }

    state.prev = state.body.map((seg) => ({ ...seg }));

    const next = state.queue.shift();

    if (next) {
      state.dir = next;
    }

    const head = state.body[0];
    const nx = head.x + state.dir.x;
    const ny = head.y + state.dir.y;
    const growing = state.food.x === nx && state.food.y === ny;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      die();
      return;
    }

    // 尾巴这一步会挪走，所以撞到自己的尾巴尖不算死（除非正在变长）。
    const limit = growing ? state.body.length : state.body.length - 1;

    for (let i = 0; i < limit; i += 1) {
      if (state.body[i].x === nx && state.body[i].y === ny) {
        die();
        return;
      }
    }

    state.body.unshift({ x: nx, y: ny });

    if (growing) {
      eat();
    } else {
      state.body.pop();
    }
  }

  function eat() {
    const golden = state.food.golden;
    const base = golden ? 30 : 10;

    state.eaten += 1;
    state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
    state.comboTimer = COMBO_WINDOW;

    const mult = multiplier();
    const gain = base * mult;

    state.score += gain;
    state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.eaten * SPEED_STEP);
    state.chomp = CHOMP_TIME;

    burst(state.food.x, state.food.y, golden ? "#f7c95e" : "#ff8078", golden ? 16 : 9);
    state.pops.push({
      x: state.food.x,
      y: state.food.y,
      text: `+${gain}`,
      note: mult > 1 ? `×${mult}` : "",
      life: 1,
      golden
    });

    if (golden) {
      const tail = state.body[state.body.length - 1];
      state.body.push({ ...tail });
      state.prev.push({ ...tail });
    }

    api.setScore(state.score);
    api.sound(golden ? "golden" : "eat");
    syncStats();

    const nextLevel = Math.floor(state.eaten / GOLDEN_EVERY) + 1;

    if (nextLevel > state.level) {
      state.level = nextLevel;
      state.banner = { text: `LEVEL ${state.level}`, sub: "速度提升", life: 1.4, max: 1.4 };
      api.sound("level");
    }

    placeFood();
  }

  function die() {
    if (state.dead) {
      return;
    }

    state.dead = true;
    state.flash = 0.75;
    state.shake = env.reduceMotion ? 0 : 0.4;
    state.chomp = 0;

    const head = state.body[0];
    burst(head.x, head.y, "#2dd4bf", 18, 1.4);

    api.gameOver({
      score: state.score,
      stats: { 长度: state.body.length, 已吃: state.eaten }
    });
  }

  // ---------------------------------------------------------------- 绘制

  function layout() {
    size = Math.min(env.size.width, env.size.height);
    pad = Math.round(size * 0.022);
    cell = (size - pad * 2) / COLS;
    ox = pad;
    oy = pad;
  }

  function center(x, y) {
    return { x: ox + x * cell + cell / 2, y: oy + y * cell + cell / 2 };
  }

  function palette() {
    if (paletteCache) {
      return paletteCache;
    }

    const fallback = {
      boardA: "#f9fcfb",
      boardB: "#eef4f1",
      grid: "rgba(15, 158, 145, 0.09)",
      edge: "rgba(15, 158, 145, 0.2)",
      ink: "#16202b",
      vignette: "rgba(20, 64, 57, 0.05)",
      sub: "rgba(22, 32, 43, 0.6)",
      glow: "rgba(15, 158, 145, 0.07)",
      gutter: "#e7efec",
      wall: "#5f807a",
      wallTop: "rgba(255, 255, 255, 0.55)",
      wallShadow: "rgba(16, 58, 52, 0.18)",
      hudBg: "rgba(255, 255, 255, 0.9)",
      hudLine: "rgba(16, 24, 40, 0.08)",
      hudInk: "#16202b",
      hudLabel: "rgba(22, 32, 43, 0.55)",
      gold: "#b7791f"
    };

    paletteCache = fallback;

    try {
      const el = document.documentElement;
      const style = el && typeof getComputedStyle === "function" ? getComputedStyle(el) : null;

      if (style) {
        const read = (name, fb) => (style.getPropertyValue(name) || "").trim() || fb;
        paletteCache = {
          boardA: read("--snake-board-a", fallback.boardA),
          boardB: read("--snake-board-b", fallback.boardB),
          grid: read("--snake-grid", fallback.grid),
          edge: read("--snake-edge", fallback.edge),
          ink: read("--snake-ink", fallback.ink),
          vignette: read("--snake-vignette", fallback.vignette),
          sub: read("--snake-sub", fallback.sub),
          glow: read("--snake-glow", fallback.glow),
          gutter: read("--snake-gutter", fallback.gutter),
          wall: read("--snake-wall", fallback.wall),
          wallTop: read("--snake-wall-top", fallback.wallTop),
          wallShadow: read("--snake-wall-shadow", fallback.wallShadow),
          hudBg: read("--snake-hud-bg", fallback.hudBg),
          hudLine: read("--snake-hud-line", fallback.hudLine),
          hudInk: read("--snake-hud-ink", fallback.hudInk),
          hudLabel: read("--snake-hud-label", fallback.hudLabel),
          gold: read("--snake-gold", fallback.gold)
        };
      }
    } catch {
      paletteCache = fallback;
    }

    return paletteCache;
  }

  function draw(dt = 0) {
    if (state.dead) {
      stepEffects(dt);
    }

    if (!size || Math.abs(size - Math.min(env.size.width, env.size.height)) > 0.5) {
      layout();
    }

    if (!size) {
      return;
    }

    const p = palette();

    drawField(p);

    ctx.save();

    if (state.shake > 0) {
      const amount = state.shake * cell * 0.5;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }

    drawFood(p);
    drawSnake(p);
    drawParticles();
    drawPops(p);
    drawBanner(p);
    drawHud(p);
    ctx.restore();

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(226, 72, 68, ${state.flash * 0.26})`;
      ctx.fillRect(0, 0, size, size);
    }
  }

  function drawField(p) {
    const x0 = ox;
    const y0 = oy;
    const w = COLS * cell;
    const h = ROWS * cell;
    const wall = Math.max(6, Math.round(cell * 0.22));

    // 墙外底色
    ctx.fillStyle = p.gutter;
    ctx.fillRect(0, 0, size, size);

    // 棋盘
    const grad = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
    grad.addColorStop(0, p.boardA);
    grad.addColorStop(1, p.boardB);
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, w, h);

    // 环境光与暗角，只作用在棋盘内
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();

    const glow = ctx.createRadialGradient(x0 + w * 0.5, y0 + h * 0.2, 0, x0 + w * 0.5, y0 + h * 0.3, w * 0.9);
    glow.addColorStop(0, p.glow);
    glow.addColorStop(1, "rgba(15, 158, 145, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x0, y0, w, h);

    // 网格
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;

    for (let i = 1; i < COLS; i += 1) {
      const x = Math.round(x0 + i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + h);
      ctx.stroke();
    }

    for (let i = 1; i < ROWS; i += 1) {
      const y = Math.round(y0 + i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(
      x0 + w / 2,
      y0 + h / 2,
      w * 0.3,
      x0 + w / 2,
      y0 + h / 2,
      w * 0.74
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, p.vignette);
    ctx.fillStyle = vignette;
    ctx.fillRect(x0, y0, w, h);
    ctx.restore();

    // 贴着碰撞线画出来的实墙：内边缘正好落在格子边界上
    const shade = Math.max(cell * 0.6, wall * 1.7);

    const top = ctx.createLinearGradient(0, y0, 0, y0 + shade);
    top.addColorStop(0, p.wallShadow);
    top.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = top;
    ctx.fillRect(x0, y0, w, shade);

    const bottom = ctx.createLinearGradient(0, y0 + h, 0, y0 + h - shade);
    bottom.addColorStop(0, p.wallShadow);
    bottom.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = bottom;
    ctx.fillRect(x0, y0 + h - shade, w, shade);

    const left = ctx.createLinearGradient(x0, 0, x0 + shade, 0);
    left.addColorStop(0, p.wallShadow);
    left.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = left;
    ctx.fillRect(x0, y0, shade, h);

    const right = ctx.createLinearGradient(x0 + w, 0, x0 + w - shade, 0);
    right.addColorStop(0, p.wallShadow);
    right.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = right;
    ctx.fillRect(x0 + w - shade, y0, shade, h);

    const radius = Math.max(3, wall * 0.55);

    ctx.strokeStyle = p.wall;
    ctx.lineWidth = wall;
    ctx.beginPath();
    ctx.roundRect(x0 - wall / 2, y0 - wall / 2, w + wall, h + wall, radius);
    ctx.stroke();

    // 墙体内沿高光
    ctx.strokeStyle = p.wallTop;
    ctx.lineWidth = Math.max(1, wall * 0.24);
    ctx.beginPath();
    ctx.roundRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1, Math.max(2, radius * 0.7));
    ctx.stroke();
  }

  function drawFood(p) {
    const food = state.food;

    if (food.x < 0) {
      return;
    }

    const { x, y } = center(food.x, food.y);
    const grow = easeOutBack(Math.min(1, state.foodAge / 0.3));
    const pulse = 1 + Math.sin(state.t * 4.2) * 0.05;
    const isGold = food.golden;
    const r = cell * 0.3 * grow * pulse;
    const tint = isGold ? "245, 181, 68" : "236, 84, 84";

    ctx.save();

    // 光晕
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, cell * 0.86);
    glow.addColorStop(0, `rgba(${tint}, 0.34)`);
    glow.addColorStop(0.55, `rgba(${tint}, 0.12)`);
    glow.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.86, 0, TAU);
    ctx.fill();

    // 旋转虚线环
    ctx.translate(x, y);
    ctx.rotate(state.t * (isGold ? 1.1 : 0.55));
    ctx.strokeStyle = `rgba(${tint}, ${isGold ? 0.55 : 0.3})`;
    ctx.lineWidth = Math.max(1, cell * 0.045);
    ctx.setLineDash([cell * 0.16, cell * 0.2]);
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.46, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-state.t * (isGold ? 1.1 : 0.55));

    // 落地阴影
    ctx.fillStyle = "rgba(2, 18, 16, 0.22)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.9, r * 0.82, r * 0.28, 0, 0, TAU);
    ctx.fill();

    // 果肉
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.36, r * 0.12, 0, 0, r);
    body.addColorStop(0, isGold ? "#ffe6a3" : "#ff9a92");
    body.addColorStop(0.7, isGold ? "#f3b53f" : "#dc4a4a");
    body.addColorStop(1, isGold ? "#d18f1c" : "#b62f36");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    // 高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.36, r * 0.22, r * 0.13, -0.6, 0, TAU);
    ctx.fill();

    // 叶子
    ctx.fillStyle = "#4ba36a";
    ctx.beginPath();
    ctx.ellipse(r * 0.16, -r * 0.94, r * 0.34, r * 0.15, -0.5, 0, TAU);
    ctx.fill();

    // 金色果子的星芒
    if (isGold) {
      ctx.fillStyle = "rgba(255, 236, 176, 0.9)";

      for (let i = 0; i < 4; i += 1) {
        const a = state.t * 1.8 + (i * TAU) / 4;
        const dist = cell * 0.52;
        const sx = Math.cos(a) * dist;
        const sy = Math.sin(a) * dist;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, cell * 0.045), 0, TAU);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function bodyPoints() {
    const stepTime = 1 / state.speed;
    const raw = state.dead ? 1 : Math.min(1, state.acc / stepTime);
    const points = [];

    for (let i = 0; i < state.body.length; i += 1) {
      const to = state.body[i];
      const from = state.prev[i] || to;
      const x = from.x + (to.x - from.x) * raw;
      const y = from.y + (to.y - from.y) * raw;
      points.push(center(x, y));
    }

    return points;
  }

  function strokeChain(points, width, style, offsetY = 0) {
    if (points.length === 0) {
      return;
    }

    ctx.strokeStyle = style;
    ctx.lineWidth = Math.max(1, width);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y + offsetY);

    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y + offsetY);
    }

    ctx.stroke();
  }

  function drawSnake(p) {
    const points = bodyPoints();

    if (points.length === 0) {
      return;
    }

    const r = cell * 0.44;
    const intro = Math.min(1, Math.max(0.001, state.t / 0.2));

    ctx.save();
    ctx.globalAlpha = intro * (state.dead ? 0.75 : 1);

    strokeChain(points, r * 2 + cell * 0.1, "rgba(0, 0, 0, 0.24)", cell * 0.1);
    strokeChain(points, r * 2 + cell * 0.16, "rgba(4, 34, 31, 0.92)");

    const head = points[0];
    const tail = points[points.length - 1];
    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, "#0d766c");
    grad.addColorStop(0.55, "#22b6a5");
    grad.addColorStop(1, "#5fe3cf");
    strokeChain(points, r * 2, grad);

    // 脊背虚线，顺着移动方向缓慢流动
    ctx.setLineDash([cell * 0.34, cell * 0.46]);
    ctx.lineDashOffset = -state.t * cell * 0.9;
    strokeChain(points, cell * 0.13, "rgba(255, 255, 255, 0.2)");
    ctx.setLineDash([]);

    ctx.restore();

    drawHead(head.x, head.y, cell * 0.56, intro);
  }

  function drawHead(x, y, r, intro) {
    const angle = state.headAngle;
    const bob = state.dead || intro < 1 ? 0 : Math.sin(state.t * 9) * r * 0.03;

    ctx.save();
    ctx.globalAlpha = intro;
    ctx.translate(x, y + bob);

    // 投影
    ctx.fillStyle = "rgba(2, 18, 16, 0.24)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 1.02, r * 0.38, 0, 0, TAU);
    ctx.fill();

    ctx.rotate(angle);

    // 吐信：每隔两秒多伸一次舌头
    if (!state.dead) {
      const phase = (state.t % 1.5) / 1.5;
      const flick = phase < 0.2 ? Math.sin((phase / 0.2) * Math.PI) : 0;

      if (flick > 0.05) {
        const len = r * (0.45 + flick * 0.55);
        ctx.strokeStyle = "#d84b45";
        ctx.lineWidth = Math.max(1.2, r * 0.11);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(r * 0.98, 0);
        ctx.lineTo(r * 0.98 + len * 0.55, 0);
        ctx.moveTo(r * 0.98 + len * 0.5, 0);
        ctx.lineTo(r * 0.98 + len, -r * 0.3);
        ctx.moveTo(r * 0.98 + len * 0.5, 0);
        ctx.lineTo(r * 0.98 + len, r * 0.3);
        ctx.stroke();
      }
    }

    // 头部：俯视椭圆，与身体同色系
    const headGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.36, r * 0.1, 0, 0, r * 1.2);
    headGrad.addColorStop(0, "#9df7ea");
    headGrad.addColorStop(0.62, "#3ad3bf");
    headGrad.addColorStop(1, "#12a191");
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(r * 0.07, 0, r * 1.13, r * 0.98, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(4, 34, 31, 0.85)";
    ctx.lineWidth = Math.max(1.4, r * 0.08);
    ctx.stroke();

    // 头顶高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.36, r * 0.52, r * 0.2, -0.3, 0, TAU);
    ctx.fill();

    // 两只眼睛：俯视视角，长在头两侧
    const eyeX = r * 0.34;
    const eyeY = r * 0.5;
    const eyeR = Math.max(2.2, r * 0.3);
    const target = center(state.food.x, state.food.y);
    const look = Math.atan2(target.y - y, target.x - x) - angle;
    const shiftX = state.dead ? 0 : Math.cos(look) * eyeR * 0.18;
    const shiftY = state.dead ? 0 : Math.sin(look) * eyeR * 0.1;

    for (const side of [-1, 1]) {
      const cy = eyeY * side;

      if (state.dead) {
        ctx.strokeStyle = "#12302c";
        ctx.lineWidth = Math.max(1.4, r * 0.08);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(eyeX - eyeR * 0.62, cy - eyeR * 0.62);
        ctx.lineTo(eyeX + eyeR * 0.62, cy + eyeR * 0.62);
        ctx.moveTo(eyeX + eyeR * 0.62, cy - eyeR * 0.62);
        ctx.lineTo(eyeX - eyeR * 0.62, cy + eyeR * 0.62);
        ctx.stroke();
        continue;
      }

      ctx.fillStyle = "#f7fffb";
      ctx.beginPath();
      ctx.ellipse(eyeX, cy, eyeR, eyeR * 0.9, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(6, 44, 40, 0.5)";
      ctx.lineWidth = Math.max(1, r * 0.045);
      ctx.stroke();

      ctx.fillStyle = "#16202b";
      ctx.beginPath();
      ctx.ellipse(eyeX + shiftX, cy + shiftY, eyeR * 0.34, eyeR * 0.72, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(eyeX + shiftX - eyeR * 0.16, cy + shiftY - eyeR * 0.3, eyeR * 0.14, 0, TAU);
      ctx.fill();
    }

    // 鼻孔
    if (!state.dead) {
      ctx.fillStyle = "rgba(6, 44, 40, 0.5)";
      ctx.beginPath();
      ctx.arc(r * 0.9, -r * 0.16, Math.max(0.7, r * 0.045), 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.9, r * 0.16, Math.max(0.7, r * 0.045), 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  // 嵌入模式或窄屏下没有可见侧栏，把分数与连击直接画在画布上。
  function drawHud(p) {
    if (!(env.isEmbed || env.compact) || state.dead) {
      return;
    }

    const h = Math.max(22, Math.min(34, size * 0.06));
    const x = ox + size * 0.016;
    const y = oy + size * 0.016;
    const valueFont = `800 ${Math.round(h * 0.5)}px "Avenir Next", "PingFang SC", sans-serif`;
    const labelFont = `600 ${Math.round(h * 0.28)}px "Avenir Next", "PingFang SC", sans-serif`;
    const text = String(state.score);

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    ctx.font = labelFont;
    const labelWidth = ctx.measureText("得分").width;
    ctx.font = valueFont;
    const valueWidth = ctx.measureText(text).width;
    const width = labelWidth + valueWidth + h * 1.2;

    ctx.fillStyle = p.hudBg;
    ctx.beginPath();
    ctx.roundRect(x, y, width, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = p.hudLine;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = p.hudLabel;
    ctx.font = labelFont;
    ctx.fillText("得分", x + h * 0.42, y + h / 2 + 0.5);

    ctx.fillStyle = p.hudInk;
    ctx.font = valueFont;
    ctx.fillText(text, x + h * 0.42 + labelWidth + h * 0.34, y + h / 2 + 1);

    if (state.combo > 1) {
      const combo = `×${multiplier()}`;
      ctx.font = `800 ${Math.round(h * 0.42)}px "Avenir Next", "PingFang SC", sans-serif`;
      const comboWidth = ctx.measureText(combo).width + h * 0.8;
      const rx = ox + COLS * cell - size * 0.016 - comboWidth;

      ctx.fillStyle = "rgba(245, 181, 68, 0.18)";
      ctx.beginPath();
      ctx.roundRect(rx, y, comboWidth, h, h / 2);
      ctx.fill();
      ctx.fillStyle = "#f5b544";
      ctx.fillText(combo, rx + h * 0.4, y + h / 2 + 1);
    }

    ctx.restore();
  }

  function burst(cx, cy, color, count, force = 1) {
    if (!size) {
      return;
    }

    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= MAX_PARTICLES) {
        break;
      }

      const angle = Math.random() * TAU;
      const speed = (cell * (1.6 + Math.random() * 3.4)) * force;

      state.particles.push({
        x: ox + cx * cell + cell / 2,
        y: oy + cy * cell + cell / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - cell * 1.2,
        life: 0.55 + Math.random() * 0.4,
        max: 0.95,
        size: cell * (0.05 + Math.random() * 0.08),
        color
      });
    }
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

      const { x, y } = center(pop.x, pop.y);
      const age = 1 - pop.life;
      const rise = easeOutCubic(Math.min(1, age * 1.6)) * cell * 1.7;
      const scale = 1 + Math.min(1, age * 5) * 0.18;

      ctx.save();
      ctx.globalAlpha = Math.min(1, pop.life * 1.6);
      ctx.translate(x, y - rise);
      ctx.scale(scale, scale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = pop.golden ? "#ffd166" : p.ink;
      ctx.font = `800 ${Math.round(cell * 0.5)}px "Avenir Next", "PingFang SC", sans-serif`;
      ctx.fillText(pop.text, 0, 0);

      if (pop.note) {
        ctx.fillStyle = pop.golden ? "#f5b544" : "#5fe3cf";
        ctx.font = `700 ${Math.round(cell * 0.3)}px "Avenir Next", "PingFang SC", sans-serif`;
        ctx.fillText(pop.note, cell * 0.52, -cell * 0.05);
      }

      ctx.restore();
    }
  }

  function drawBanner(p) {
    if (!state.banner || state.banner.life <= 0) {
      return;
    }

    const banner = state.banner;
    const progress = 1 - banner.life / banner.max;
    const alpha = Math.min(1, (1 - progress) * 3);
    const y = oy + cell * 1.8 - progress * cell * 0.4;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(4, 24, 28, 0.55)";
    ctx.beginPath();
    ctx.roundRect(size / 2 - cell * 3.1, y - cell * 0.62, cell * 6.2, cell * 1.24, cell * 0.62);
    ctx.fill();
    ctx.fillStyle = "#5fe3cf";
    ctx.font = `800 ${Math.round(cell * 0.42)}px "Avenir Next", "PingFang SC", sans-serif`;
    ctx.fillText(banner.text, size / 2, y - cell * 0.1);
    ctx.fillStyle = p.sub;
    ctx.font = `600 ${Math.round(cell * 0.26)}px "Avenir Next", "PingFang SC", sans-serif`;
    ctx.fillText(banner.sub, size / 2, y + cell * 0.34);
    ctx.restore();
  }

  // ---------------------------------------------------------------- 动效时间

  function stepEffects(dt) {
    state.t += dt;
    state.foodAge += dt;

    if (state.comboTimer > 0) {
      state.comboTimer = Math.max(0, state.comboTimer - dt);

      if (state.comboTimer === 0 && state.combo > 0) {
        state.combo = 0;
        syncStats();
      }
    }

    if (state.chomp > 0) {
      state.chomp = Math.max(0, state.chomp - dt);
    }

    if (state.flash > 0) {
      state.flash = Math.max(0, state.flash - dt * 1.6);
    }

    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 1.8);
    }

    for (const particle of state.particles) {
      particle.life -= dt;
      particle.vy += cell * 14 * dt;
      particle.vx *= 0.985;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }

    state.particles = state.particles.filter((particle) => particle.life > 0);

    for (const pop of state.pops) {
      pop.life -= dt * 1.15;
    }

    state.pops = state.pops.filter((pop) => pop.life > 0);

    if (state.banner) {
      state.banner.life -= dt;

      if (state.banner.life <= 0) {
        state.banner = null;
      }
    }

    if (!state.dead) {
      const target = Math.atan2(state.dir.y, state.dir.x);
      let diff = ((target - state.headAngle + Math.PI * 3) % TAU) - Math.PI;
      state.headAngle += diff * Math.min(1, dt * 16);
    }
  }

  // 更新循环：动画时间、飘分、死亡闪红
  function update(dt) {
    stepEffects(dt);

    if (state.dead) {
      return;
    }

    state.acc += dt;
    const stepTime = 1 / state.speed;
    let guard = 0;

    while (state.acc >= stepTime && guard < 8) {
      state.acc -= stepTime;
      guard += 1;
      step();

      if (state.dead) {
        break;
      }
    }
  }

  function onDirection(dir) {
    const next = DIRS[dir];

    if (!next) {
      return;
    }

    const last = state.queue.length > 0 ? state.queue[state.queue.length - 1] : state.dir;

    if (last.x === next.x && last.y === next.y) {
      return;
    }

    // 不能 180 度掉头
    if (last.x + next.x === 0 && last.y + next.y === 0) {
      return;
    }

    if (state.queue.length < 2) {
      state.queue.push(next);
    }
  }

  return { reset, update, draw, onDirection };
});

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}
