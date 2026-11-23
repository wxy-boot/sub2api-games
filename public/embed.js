/**
 * sub2api 嵌入 SDK（普通脚本，不依赖框架，约 5KB）。
 *
 *   <script src="https://你的域名/games/embed.js"></script>
 *   <script>Sub2ApiGames.mount({ game: "snake" });</script>
 *
 * 父页面可以在智能体跑完时调 Sub2ApiGames.notifyTaskDone({ name: "重构计费" })，
 * 游戏会自动暂停并弹一条提示，把人叫回来。
 */
(function () {
  "use strict";

  if (window.Sub2ApiGames) {
    return;
  }

  var current = document.currentScript;
  var scriptBase = current && current.src ? current.src.replace(/\/embed\.js(\?.*)?$/, "") : "";

  var DEFAULTS = {
    src: scriptBase,
    game: "snake",
    position: "bottom-right",
    label: "摸鱼一下",
    accent: "#0f9e91",
    theme: "light",
    width: 380,
    height: 620,
    onEvent: null
  };

  var SNAKE_ICON =
    '<svg viewBox="0 0 32 32" aria-hidden="true">' +
    '<path d="M6 25c5.6 0 4.8-8.6 10.2-8.6S20.4 8 25 8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="25" cy="8" r="4.2" fill="#fff"/>' +
    '<circle cx="26" cy="7" r="1.15" fill="#0f9e91"/></svg>';

  var STYLE_ID = "s2g-styles";
  var state = {
    options: null,
    button: null,
    panel: null,
    frame: null,
    toast: null,
    open: false
  };

  function merge(options) {
    var merged = {};

    for (var key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        merged[key] = options && options[key] !== undefined ? options[key] : DEFAULTS[key];
      }
    }

    merged.src = String(merged.src || "").replace(/\/+$/, "");
    return merged;
  }

  function injectStyles(accent) {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".s2g-button{position:fixed;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;",
      "padding:9px 15px 9px 12px;border:0;border-radius:999px;background:" + accent + ";color:#fff;",
      "font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;",
      "box-shadow:0 8px 22px rgba(16,24,40,.22);cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}",
      ".s2g-button:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(16,24,40,.26)}",
      ".s2g-button:active{transform:translateY(0)}",
      ".s2g-button svg{width:22px;height:22px;flex:none}",
      ".s2g-button[data-pos='bottom-right']{right:20px;bottom:20px}",
      ".s2g-button[data-pos='bottom-left']{left:20px;bottom:20px}",
      ".s2g-panel{position:fixed;z-index:2147483001;display:flex;flex-direction:column;overflow:hidden;",
      "background:#fff;border:1px solid #e6eaf0;border-radius:16px;box-shadow:0 24px 64px rgba(16,24,40,.18);",
      "opacity:0;transform:translateY(10px) scale(.99);pointer-events:none;transition:opacity .18s ease,transform .18s ease}",
      ".s2g-panel[data-pos='bottom-right']{right:20px;bottom:84px}",
      ".s2g-panel[data-pos='bottom-left']{left:20px;bottom:84px}",
      ".s2g-panel.is-open{opacity:1;transform:none;pointer-events:auto}",
      ".s2g-head{display:flex;align-items:center;gap:8px;height:40px;padding:0 8px 0 14px;",
      "border-bottom:1px solid #eef2f6;background:#fff}",
      ".s2g-title{flex:1;color:#16202b;font:600 12.5px/1 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif}",
      ".s2g-link,.s2g-close{display:inline-flex;align-items:center;justify-content:center;height:26px;",
      "padding:0 9px;border:0;border-radius:7px;background:transparent;color:#7b8a9c;",
      "font:500 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;",
      "text-decoration:none;cursor:pointer}",
      ".s2g-link:hover,.s2g-close:hover{background:#f2f5f8;color:#16202b}",
      ".s2g-frame{flex:1;width:100%;border:0;background:#f4f6f9}",
      ".s2g-toast{position:fixed;z-index:2147483002;max-width:280px;padding:9px 14px;border-radius:10px;",
      "background:rgba(20,32,43,.94);color:#fff;font:600 12px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;",
      "box-shadow:0 12px 30px rgba(16,24,40,.24);opacity:0;transition:opacity .2s ease}",
      ".s2g-toast.is-on{opacity:1}",
      "@media (max-width:560px){.s2g-panel[data-pos]{left:0;right:0;bottom:0;top:0;border-radius:0;border:0;",
      "width:auto!important;height:auto!important}}",
      "@media (prefers-reduced-motion:reduce){.s2g-panel,.s2g-button{transition:none}}"
    ].join("");
    document.head.appendChild(style);
  }

  function mount(options) {
    if (state.button) {
      return api;
    }

    var merged = merge(options);

    if (!merged.src) {
      console.warn("[sub2api-games] mount() 需要一个 src（游戏服务的地址）。");
      return api;
    }

    state.options = merged;
    injectStyles(merged.accent);

    var button = document.createElement("button");
    button.type = "button";
    button.className = "s2g-button";
    button.dataset.pos = merged.position;
    button.innerHTML = SNAKE_ICON + "<span>" + escapeText(merged.label) + "</span>";
    button.style.background = merged.accent;
    button.addEventListener("click", toggle);
    document.body.appendChild(button);

    state.button = button;
    return api;
  }

  function ensurePanel() {
    if (state.panel) {
      return state.panel;
    }

    var options = state.options;
    var panel = document.createElement("div");
    panel.className = "s2g-panel";
    panel.dataset.pos = options.position;
    panel.style.width = Math.round(options.width) + "px";
    panel.style.height = "min(" + Math.round(options.height) + "px, calc(100vh - 116px))";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "摸鱼小游戏");

    var head = document.createElement("div");
    head.className = "s2g-head";

    var title = document.createElement("span");
    title.className = "s2g-title";
    title.textContent = "摸鱼小游戏";

    var link = document.createElement("a");
    link.className = "s2g-link";
    link.href = options.src + "/play/" + encodeURIComponent(options.game);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "新窗口";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "s2g-close";
    close.textContent = "收起";
    close.addEventListener("click", hide);

    head.append(title, link, close);

    var frame = document.createElement("iframe");
    frame.className = "s2g-frame";
    frame.title = "摸鱼小游戏";
    frame.loading = "lazy";
    frame.allow = "autoplay; fullscreen";
    frame.src =
      options.src +
      "/play/" +
      encodeURIComponent(options.game) +
      "?ui_mode=embedded&theme=" +
      encodeURIComponent(options.theme || "light");

    panel.append(head, frame);
    document.body.appendChild(panel);

    state.panel = panel;
    state.frame = frame;

    window.addEventListener("message", onMessage);
    document.addEventListener("keydown", onKeydown);

    return panel;
  }

  function show() {
    var panel = ensurePanel();
    state.open = true;
    panel.classList.add("is-open");
    post("resume");
  }

  function hide() {
    if (!state.panel) {
      return;
    }

    state.open = false;
    state.panel.classList.remove("is-open");
    post("pause");
  }

  function toggle() {
    if (state.open) {
      hide();
      return;
    }

    show();
  }

  function onKeydown(event) {
    if (event.key === "Escape" && state.open) {
      hide();
    }
  }

  function onMessage(event) {
    var data = event.data;

    if (!data || data.source !== "sub2api-games") {
      if (event.data && event.data.target === "sub2api-games") {
        return;
      }

      return;
    }

    if (typeof state.options.onEvent === "function") {
      try {
        state.options.onEvent(data);
      } catch (error) {
        console.warn("[sub2api-games] onEvent 回调出错", error);
      }
    }
  }

  function post(type, payload) {
    if (!state.frame || !state.frame.contentWindow) {
      return;
    }

    var message = { target: "sub2api-games", type: type };

    if (payload) {
      for (var key in payload) {
        message[key] = payload[key];
      }
    }

    state.frame.contentWindow.postMessage(message, "*");
  }

  /** 智能体跑完时调用：游戏自动暂停 + 弹提示。 */
  function notifyTaskDone(payload) {
    var name = payload && payload.name ? String(payload.name) : "";
    post("task-done", { name: name });

    if (!state.open) {
      showToast(name ? "「" + name + "」跑完了" : "任务跑完了，去大厅看看");
    }
  }

  function showToast(text) {
    if (!state.toast) {
      var toast = document.createElement("div");
      toast.className = "s2g-toast";
      document.body.appendChild(toast);
      state.toast = toast;
    }

    var pos = state.options ? state.options.position : "bottom-right";
    state.toast.style[pos === "bottom-left" ? "left" : "right"] = "20px";
    state.toast.style[pos === "bottom-left" ? "right" : "left"] = "auto";
    state.toast.style.bottom = "84px";
    state.toast.textContent = text;
    state.toast.classList.add("is-on");

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      state.toast.classList.remove("is-on");
    }, 5200);
  }

  function unmount() {
    hide();

    if (state.button) {
      state.button.remove();
    }

    if (state.panel) {
      state.panel.remove();
    }

    if (state.toast) {
      state.toast.remove();
    }

    state.button = null;
    state.panel = null;
    state.frame = null;
    state.toast = null;
    state.options = null;
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  var api = {
    mount: mount,
    open: show,
    close: hide,
    toggle: toggle,
    notifyTaskDone: notifyTaskDone,
    unmount: unmount
  };

  window.Sub2ApiGames = api;
})();
