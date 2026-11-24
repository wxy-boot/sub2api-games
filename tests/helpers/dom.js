/**
 * 测试用的最小 DOM 桩。
 * 每个测试文件跑在独立进程里，所以直接在 globalThis 上装 window / document，
 * 就能把浏览器端的 shell.js + 游戏模块原样 import 进来跑。
 */

const ELEMENT_IDS = [
  "stage",
  "canvas",
  "overlay",
  "overlayBadge",
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

export function createHarness({
  game,
  bestKey = game,
  scoreLabel = "最高分",
  touchHint = "",
  stageSize = 480,
  innerWidth = 1200,
  innerHeight = 900
} = {}) {
  const elements = new Map();
  const storage = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  let rafCallback = null;
  let now = 0;

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
        return { width: stageSize, height: stageSize, left: 0, top: 0 };
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

  const body = createElement("body");
  body.dataset.game = game;
  body.dataset.bestKey = bestKey;
  body.dataset.scoreLabel = scoreLabel;

  if (touchHint) {
    body.dataset.touchHint = touchHint;
  }

  const wrap = createElement("div");
  wrap.clientWidth = stageSize;

  const canvas = createElement("canvas");
  canvas.getContext = () => createContext();

  const stage = createElement("div");
  stage.clientWidth = stageSize;
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
    innerWidth,
    innerHeight,
    location: { href: `http://localhost/play/${game}` },
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

  function keydown(key) {
    for (const handler of windowListeners.get("keydown") || []) {
      handler({
        key,
        code: key === " " ? "Space" : key,
        preventDefault() {},
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        repeat: false
      });
    }
  }

  function keyup(key) {
    for (const handler of windowListeners.get("keyup") || []) {
      handler({ key, code: key === " " ? "Space" : key, preventDefault() {} });
    }
  }

  function frames(count, stepMs = 16) {
    for (let i = 0; i < count; i += 1) {
      now += stepMs;
      const callback = rafCallback;
      rafCallback = null;
      callback(now);
    }
  }

  function fireWindow(type, event) {
    for (const handler of windowListeners.get(type) || []) {
      handler(event);
    }
  }

  function fireDocument(type, event) {
    for (const handler of documentListeners.get(type) || []) {
      handler(event);
    }
  }

  function tap() {
    stage.dispatch("pointerdown", { clientX: 100, clientY: 100 });
    stage.dispatch("pointerup", { clientX: 100, clientY: 100 });
  }

  return {
    window: windowObject,
    document,
    elements,
    storage,
    keydown,
    keyup,
    frames,
    fireWindow,
    fireDocument,
    tap,
    overlay: elements.get("overlay"),
    score: elements.get("scoreValue"),
    stats: elements.get("stats"),
    hasRaf: () => rafCallback !== null
  };
}
