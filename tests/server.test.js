import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import { games, gameEntryUrl, readyGames } from "../src/games.js";

let server;
let base = "";

before(async () => {
  const app = await createApp({ port: 0 });
  server = app.server;
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("大厅与游戏页", () => {
  test("首页只保留游戏聚合，没有推荐位和统计条", async () => {
    const response = await fetch(`${base}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(html, /摸鱼小游戏/);
    assert.match(html, /贪吃蛇/);
    assert.match(html, /\/play\/snake/);
    assert.match(html, /即将上线/);
    assert.doesNotMatch(html, /class="hero"/);
    assert.doesNotMatch(html, /class="metrics"/);
    assert.doesNotMatch(html, /今日已玩/);
    assert.doesNotMatch(html, /敬请期待/);
  });

  test("游戏页带上画布和状态覆盖层", async () => {
    const response = await fetch(`${base}/play/snake`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /id="canvas"/);
    assert.match(html, /id="overlay"/);
    assert.match(html, /id="overlayButton"/);
    assert.match(html, /\/games\/snake\/index\.js/);
    assert.doesNotMatch(html, /is-embed/);
  });

  test("embed=1 时隐藏站点外壳", async () => {
    const html = await (await fetch(`${base}/play/snake?embed=1`)).text();

    assert.match(html, /class="game-page is-embed"/);
  });

  test("不存在的游戏返回 404 页面", async () => {
    const response = await fetch(`${base}/play/not-a-game`, {
      headers: { accept: "text/html" }
    });

    assert.equal(response.status, 404);
    assert.match(await response.text(), /没有这个游戏/);
  });

  test("未上线的游戏不给进", async () => {
    const response = await fetch(`${base}/play/2048`, { headers: { accept: "text/html" } });

    assert.equal(response.status, 404);
  });

  test("嵌入演示页可以打开", async () => {
    const response = await fetch(`${base}/embed-demo`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Sub2ApiGames\.mount/);
  });
});

describe("接口", () => {
  test("/api/games 返回可玩列表和地址", async () => {
    const response = await fetch(`${base}/api/games`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(payload.ok, true);
    assert.equal(payload.games.length, games.length);
    assert.equal(payload.playable, readyGames.length);

    const snake = payload.games.find((game) => game.id === "snake");
    assert.equal(snake.url, "/play/snake");
    assert.equal(payload.games.find((game) => game.id === "2048").url, "");
  });

  test("/api/games/:id 单条查询", async () => {
    const payload = await (await fetch(`${base}/api/games/snake`)).json();

    assert.equal(payload.game.id, "snake");
  });

  test("/api/games/:id 找不到时 404", async () => {
    const response = await fetch(`${base}/api/games/nope`);

    assert.equal(response.status, 404);
  });

  test("/healthz", async () => {
    const payload = await (await fetch(`${base}/healthz`)).json();

    assert.equal(payload.ok, true);
    assert.equal(payload.service, "sub2api-games");
  });

  test("未知路径：浏览器拿 HTML，接口拿 JSON", async () => {
    const html = await fetch(`${base}/nope`, { headers: { accept: "text/html" } });
    const json = await fetch(`${base}/nope`, { headers: { accept: "application/json" } });

    assert.equal(html.status, 404);
    assert.match(await html.text(), /404/);
    assert.equal(json.status, 404);
    assert.equal((await json.json()).error, "not_found");
  });
});

describe("静态资源", () => {
  test("样式和脚本按类型返回", async () => {
    const css = await fetch(`${base}/styles.css`);
    const snake = await fetch(`${base}/games/snake/index.js`);

    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type"), /text\/css/);
    assert.match(await snake.text(), /startGame/);
  });

  test("带 gzip 时压缩且带 ETag", async () => {
    const response = await fetch(`${base}/styles.css`, {
      headers: { "accept-encoding": "gzip" }
    });

    assert.equal(response.headers.get("content-encoding"), "gzip");
    assert.ok(response.headers.get("etag"));
    assert.ok((await response.text()).includes("--radius-lg"));
  });

  test("ETag 命中返回 304", async () => {
    const first = await fetch(`${base}/styles.css`);
    const etag = first.headers.get("etag");
    const second = await fetch(`${base}/styles.css`, {
      headers: { "if-none-match": etag }
    });

    assert.equal(second.status, 304);
  });

  test("HEAD 不带正文", async () => {
    const response = await fetch(`${base}/styles.css`, { method: "HEAD" });
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body, "");
    assert.ok(Number(response.headers.get("content-length")) > 0);
  });

  test("服务端不暴露 public 目录以外的文件", async () => {
    const response = await fetch(`${base}/../src/config.js`);

    assert.ok(response.status >= 400);
  });
});

describe("basename 部署", () => {
  test("PUBLIC_BASE_PATH 生效", async () => {
    const app = await createApp({ publicBasePath: "/games" });

    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const root = `http://127.0.0.1:${app.server.address().port}`;

    try {
      assert.equal((await fetch(`${root}/games/`)).status, 200);
      assert.equal((await fetch(`${root}/games/play/snake`)).status, 200);
      assert.equal((await fetch(`${root}/games/styles.css`)).status, 200);
      assert.equal((await fetch(`${root}/`)).status, 404);

      const payload = await (await fetch(`${root}/games/api/games`)).json();
      assert.equal(payload.games.find((game) => game.id === "snake").url, "/games/play/snake");
    } finally {
      await new Promise((resolve) => app.server.close(resolve));
    }
  });
});

describe("游戏注册表", () => {
  test("每个已上线游戏都有对应的前端模块", async () => {
    for (const game of readyGames) {
      const response = await fetch(`${base}${gameEntryUrl(game)}`);
      assert.equal(response.status, 200, `${game.id} 缺少 public/games/${game.id}/index.js`);
      assert.match(await response.text(), /startGame\(/);
    }
  });

  test("id 不重复", () => {
    const ids = games.map((game) => game.id);

    assert.equal(new Set(ids).size, ids.length);
  });
});
