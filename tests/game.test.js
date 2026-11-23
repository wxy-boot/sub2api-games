import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * 用最小的 DOM 桩把浏览器端代码跑起来：验证 shell 的状态机、贪吃蛇的碰撞、
 * 以及存档写入。这里不渲染真实画面，但会真的调用每一帧的 update / draw。
 */

const ELEMENT_IDS = [
  "stage",
  "canvas",
  "overlay",
  "overlayTitle",
  "overlayText",
  "overlayStats",
  "overlayButton",
  "overlayHint",
  "scoreValue",
  "bestValue",
  "clockValue",
  "stats",
  "soundButton",
  "toast",
  "dpad"
];

const elements = new Map();
const storage = new Map();
const windowListeners = new Map();
const documentListeners = new Map();
let rafCallback = null;

function createElement(tag = "div") {
  const listeners = new Map();
  const classes = new Set();

  return {
    tagName: String(tag).toUpperCase(),
    className: "",
    textContent: "",
    title: "",
    hidden: false,
    disabled: false,
    width: 0,
    height: 0,
    style: {},
    dataset: {},
    attrs: {},
    children: [],
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name) => (classes.has(name) ? classes.delete(name) : classes.add(name))
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }

      listeners.get(type).push(handler);
    },
    removeEventListener() {},
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    closest() {
      return null;
    },
    getBoundingClientRect() {
      return { width: 480, height: 480, left: 0, top: 0 };
    },
    querySelectorAll() {
      return [];
    },
    dispatch(type, event = {}) {
      for (const handler of listeners.get(type) || []) {
        handler({ preventDefault() {}, ...event });
      }
    }
  };
}

function createContext() {
  const gradients = () => ({ addColorStop() {} });

  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === "createLinearGradient" || prop === "createRadialGradient") {
          return gradients;
        }

        if (prop === "measureText") {
          return () => ({ width: 10 });
        }

        if (prop in target) {
          return target[prop];
        }

        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    }
  );
}

function setupDom() {
  const body = createElement("body");
  body.dataset.game = "snake";
  body.dataset.bestKey = "snake";
  body.dataset.scoreLabel = "最高分";

  const wrap = createElement("div");
  wrap.clientWidth = 480;

  const canvas = createElement("canvas");
  canvas.getContext = () => createContext();

  const stage = createElement("div");
  stage.clientWidth = 480;
  stage.parentElement = wrap;
  wrap.append(stage);

  elements.set("stage", stage);
  elements.set("canvas", canvas);

  for (const id of ELEMENT_IDS) {
    if (!elements.has(id)) {
      elements.set(id, createElement("div"));
    }
  }

  const document = {
    body,
    head: createElement("head"),
    hidden: false,
    createElement,
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: () => [],
    addEventListener(type, handler) {
      if (!documentListeners.has(type)) {
        documentListeners.set(type, []);
      }

      documentListeners.get(type).push(handler);
    }
  };

  const windowObject = {
    document,
    devicePixelRatio: 2,
    innerWidth: 1200,
    innerHeight: 900,
    location: { href: "http://localhost/play/snake" },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    },
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, []);
      }

      windowListeners.get(type).push(handler);
    },
    removeEventListener() {},
    requestAnimationFrame(callback) {
      rafCallback = callback;
      return 1;
    },
    cancelAnimationFrame() {},
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id)
  };

  windowObject.parent = windowObject;
  windowObject.window = windowObject;

  globalThis.window = windowObject;
  globalThis.document = document;
  globalThis.requestAnimationFrame = windowObject.requestAnimationFrame;
  globalThis.devicePixelRatio = 2;

  return windowObject;
}

function keydown(key) {
  for (const handler of windowListeners.get("keydown") || []) {
    handler({ key, code: key === " " ? "Space" : key, preventDefault() {}, metaKey: false, ctrlKey: false, altKey: false });
  }
}

let now = 0;

function frames(count, stepMs = 16) {
  for (let i = 0; i < count; i += 1) {
    now += stepMs;
    const callback = rafCallback;
    rafCallback = null;
    callback(now);
  }
}

const windowObject = setupDom();

await import("../public/games/snake.js");

const overlay = elements.get("overlay");
const score = elements.get("scoreValue");

test("载入后处于待开始状态，画面已经画了一帧", () => {
  assert.equal(overlay.dataset.state, "idle");
  assert.equal(score.textContent, "0");
  assert.notEqual(rafCallback, null);
});

test("按方向键会自动开局", () => {
  frames(2);
  keydown("ArrowRight");

  assert.equal(overlay.dataset.state, "running");
  assert.equal(score.textContent, "0");
});

test("撞墙后进入结束状态并写入本地存档", () => {
  // 从中心一直往右，大约 1.4 秒撞到围栏。
  frames(160);

  assert.equal(overlay.dataset.state, "over");

  const record = JSON.parse(storage.get("sub2api-games:play"));
  assert.equal(record.total, 1);
  assert.equal(record.todayCount, 1);
  assert.ok(record.longest >= 1);
});

test("空格暂停、再按继续", () => {
  keydown("Enter");
  frames(4);
  assert.equal(overlay.dataset.state, "running");

  keydown(" ");
  assert.equal(overlay.dataset.state, "paused");

  keydown(" ");
  assert.equal(overlay.dataset.state, "running");
});

test("切到后台自动暂停", () => {
  for (const handler of documentListeners.get("visibilitychange") || []) {
    handler();
  }

  const hidden = windowObject.document;
  hidden.hidden = true;

  for (const handler of documentListeners.get("visibilitychange") || []) {
    handler();
  }

  assert.equal(overlay.dataset.state, "paused");
});

test("父页面通知任务完成时，游戏暂停并弹出提示", () => {
  keydown(" "); // 先继续
  assert.equal(overlay.dataset.state, "running");

  for (const handler of windowListeners.get("message") || []) {
    handler({ data: { target: "sub2api-games", type: "task-done", name: "重构计费模块" } });
  }

  assert.equal(overlay.dataset.state, "paused");
  assert.equal(elements.get("toast").hidden, false);
  assert.match(elements.get("toast").textContent, /重构计费模块/);
});

test("长时间空跑不会抛异常", () => {
  keydown("Enter");

  for (let i = 0; i < 400; i += 1) {
    frames(1, 32);
    keydown(i % 7 === 0 ? "ArrowDown" : "ArrowRight");
  }

  assert.ok(["running", "over", "paused"].includes(overlay.dataset.state));
});
