import assert from "node:assert/strict";
import { test } from "node:test";
import { createHarness } from "./helpers/dom.js";

/**
 * 用最小 DOM 桩把浏览器端代码跑起来：验证 shell 的状态机、贪吃蛇的碰撞、
 * 以及存档写入。这里不渲染真实画面，但会真的调用每一帧的 update / draw。
 */

const harness = createHarness({ game: "snake", bestKey: "snake" });

await import("../public/games/snake/index.js");

const { overlay, score, storage, keydown, frames, fireDocument, fireWindow, elements } = harness;

test("载入后处于待开始状态，画面已经画了一帧", () => {
  assert.equal(overlay.dataset.state, "idle");
  assert.equal(score.textContent, "0");
  assert.equal(harness.hasRaf(), true);
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
  fireDocument("visibilitychange");
  harness.document.hidden = true;
  fireDocument("visibilitychange");

  assert.equal(overlay.dataset.state, "paused");
});

test("父页面通知任务完成时，游戏暂停并弹出提示", () => {
  keydown(" "); // 先继续
  assert.equal(overlay.dataset.state, "running");

  fireWindow("message", {
    data: { target: "sub2api-games", type: "task-done", name: "重构计费模块" }
  });

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
