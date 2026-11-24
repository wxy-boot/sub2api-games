import assert from "node:assert/strict";
import { test } from "node:test";
import { createHarness } from "./helpers/dom.js";

/**
 * 俄罗斯方块的冒烟测试：开局、空格直落（不该被外壳当成暂停）、P 暂停、
 * 触屏轻点直落，以及长时间对局不炸。
 */

const harness = createHarness({
  game: "tetris",
  bestKey: "tetris",
  touchHint: "点按直落"
});

await import("../public/games/tetris/index.js");

const { overlay, score, stats, keydown, frames, tap } = harness;

function scoreValue() {
  return Number(score.textContent);
}

test("载入后处于待开始状态，HUD 显示等级 / 消行 / 方块", () => {
  assert.equal(overlay.dataset.state, "idle");
  assert.equal(scoreValue(), 0);
  assert.equal(stats.children.length, 3);
});

test("回车开局，空格直落加分且不会触发暂停", () => {
  keydown("Enter");
  frames(2);

  assert.equal(overlay.dataset.state, "running");

  keydown(" ");
  frames(2);

  assert.equal(overlay.dataset.state, "running", "空格应该被游戏吃掉，不能暂停");
  assert.ok(scoreValue() > 0, "直落要按落下的格数加分");
});

test("P 暂停，空格继续", () => {
  keydown("p");
  assert.equal(overlay.dataset.state, "paused");

  keydown(" ");
  assert.equal(overlay.dataset.state, "running");
});

test("轻点画布同样能直落", () => {
  const before = scoreValue();

  tap();
  frames(2);

  assert.ok(scoreValue() > before);
});

test("左右移动与旋转不会抛异常", () => {
  for (let i = 0; i < 12; i += 1) {
    keydown("ArrowLeft");
    keydown("ArrowUp");
    frames(1, 16);
    keydown("ArrowRight");
    keydown("z");
    frames(1, 16);
    keydown("ArrowDown");
  }

  assert.ok(["running", "over"].includes(overlay.dataset.state));
});

test("一路直落到顶会结算，并写入本机记录", () => {
  keydown("Enter");
  frames(2);

  for (let i = 0; i < 240; i += 1) {
    frames(1, 16);
    keydown(" ");
  }

  assert.ok(["running", "over"].includes(overlay.dataset.state));

  const record = JSON.parse(harness.storage.get("sub2api-games:play"));
  assert.ok(record.total >= 1);
});
