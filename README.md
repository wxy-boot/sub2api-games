# sub2api-games

sub2api 的小游戏厅：等待任务时可以玩一局，任务完成时游戏自动暂停。

服务端只提供静态资源和两个 JSON 接口，零依赖，Node 22.5+ 直接跑。

## 快速开始

```bash
node src/server.js          # http://127.0.0.1:8790
npm run dev                 # 改代码自动重启
npm run check               # 全量语法检查
npm run test:direct         # 跑测试（逐文件直跑）
```

`.env` 可选：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8790` | 监听端口 |
| `PUBLIC_BASE_PATH` | `/` | 反代到 `/games/` 这类子路径时填 `/games` |
| `GAMES_TITLE` | `摸鱼小游戏` | 大厅标题 |
| `GAMES_SUBTITLE` | 见 `src/config.js` | 只写进 meta description |
| `GAMES_SITE_NAME` / `GAMES_SITE_URL` | 空 | 右上角「返回 xxx」按钮，两个都填才显示 |
| `GAMES_STATIC_MAX_AGE` | `3600` | 静态资源浏览器缓存秒数 |
| `GAMES_ALLOW_EMBED` | `true` | 允许被 iframe 嵌入；关闭后发 `X-Frame-Options: SAMEORIGIN` |

页面参数（大厅和游戏页都支持）：

| 参数 | 取值 | 说明 |
| --- | --- | --- |
| `theme` | `light`（默认）/ `dark` / `auto` | 主题；`auto` 跟随系统 |
| `ui_mode` | `embedded` | 去掉页头与侧栏，收紧内边距，适配 iframe |
| `embed` | `1` | 等价于 `ui_mode=embedded` |

## 目录结构

```
src/
  server.js      入口：监听端口、优雅退出
  app.js         路由：大厅 / 游戏页 / 接口 / 静态资源
  config.js      环境变量
  games.js       游戏注册表（大厅、游戏页、/api/games 都从这里取）
  pages.js       服务端渲染的 HTML 模板
  http.js        响应封装 + 静态资源（内存 + ETag + gzip）
  log.js         JSON 行日志
public/
  styles.css     全部样式（浅色默认，深色跟随 data-theme）
  hub.js         大厅页：回填本机最高分
  shell.js       游戏外壳：画布、循环、输入、音效、存档、postMessage
  games/snake.js 贪吃蛇（纯 Canvas，无贴图）
  embed.js       嵌入 SDK（普通脚本，约 6KB）
  embed-demo.js  嵌入演示页的接线
tests/
  server.test.js 路由、缓存、basename、注册表
  game.test.js   用 DOM 桩把游戏真跑一遍
scripts/check.mjs 全量 node --check
```

## 路由

| 路径 | 说明 |
| --- | --- |
| `/` | 大厅 |
| `/play/snake` | 游戏页 |
| `/api/games` | 游戏列表 JSON（带 CORS） |
| `/api/games/:id` | 单个游戏信息 |
| `/healthz` | 健康检查 |
| `/embed-demo` | 嵌入效果演示 |

## 加一个新游戏

1. 在 `public/games/` 下新建模块：

```js
import { startGame } from "../shell.js";

startGame((env) => {
  const { ctx, api } = env;      // env.size 是画布的 CSS 像素边长（正方形）

  return {
    reset() {},                   // 开局 / 重开时调用，务必把所有状态清零
    update(dt) {},                // dt 秒；只在运行中调用
    draw(dt) {},                  // 每帧调用；暂停时只在需要时调用
    onDirection(dir) {}           // "up" | "down" | "left" | "right"
  };
});
```

2. 在 `src/games.js` 的 `games` 数组里加一条记录，`status: "ready"`，填好 `name` / `tagline` / `description` / `tags` / `art`。`controls` 用 `{ keys: ["空格"], label: "暂停 / 继续" }` 的形式，会渲染成键帽；`touch: true` 的行只在触屏设备显示。

`api` 提供：

| 方法 | 说明 |
| --- | --- |
| `api.setScore(n)` | 更新分数（外壳负责显示、最高分与存档） |
| `api.setStats({ 长度: 3 })` | 右侧 HUD 的附加指标 |
| `api.gameOver({ score, stats })` | 结束本局，弹结算面板 |
| `api.sound(name)` | `eat` / `golden` / `level` / `start` / `click` / `pause` / `over` / `best`，WebAudio 现场合成 |
| `api.storage.get/set/getJson/setJson` | 带前缀的 localStorage 封装，隐私模式也不会抛错 |

外壳负责：画布尺寸与 DPR 自适应、失焦自动暂停、键盘与滑动输入、音效开关、最高分与本机记录、和父页面通信。**游戏模块不需要碰 DOM。**

## 嵌进 sub2api

三种方式，从轻到重：

**1. 一个链接**

主站侧边栏加一条「摸鱼小游戏」，`target="_blank"` 打开 `/games/`。

**2. iframe 直接嵌**

```html
<iframe src="https://example.com/games/play/snake?theme=light&ui_mode=embedded"
        style="width:100%;height:min(640px,80vh);border:0;border-radius:16px"></iframe>
```

**3. 悬浮球 + 抽屉（推荐）**

```html
<script src="https://example.com/games/embed.js"></script>
<script>
  Sub2ApiGames.mount({
    game: "snake",
    position: "bottom-right",   // bottom-left
    label: "摸鱼一下",
    accent: "#0f9e91",
    theme: "light",            // 与主站保持一致；深色传 dark
    onEvent(event) { /* ready | state | score | over */ }
  });

  // 任务跑完时调一下，游戏会自动暂停并把人叫回来
  Sub2ApiGames.notifyTaskDone({ name: "重构计费模块" });
</script>
```

另外提供 `open()` / `close()` / `toggle()` / `unmount()`。

### postMessage 协议

iframe → 父页面（`source: "sub2api-games"`）：

| type | 附带字段 | 时机 |
| --- | --- | --- |
| `ready` | `best` | 游戏加载完成 |
| `state` | `state`（`running` / `paused`） | 状态变化 |
| `score` | `score`、`best` | 分数变化 |
| `over` | `score`、`best`、`stats` | 一局结束 |

父页面 → iframe（`target: "sub2api-games"`）：

| type | 作用 |
| --- | --- |
| `pause` / `resume` | 收起抽屉时暂停，展开时继续 |
| `task-done` | 暂停并提示任务已完成 |

## 部署

```bash
docker compose up -d          # 端口 8790
```

反代到子路径时同时设 `PUBLIC_BASE_PATH=/games`，并把 `/games/` 整个转发过来（静态资源、`/play/*`、`/api/*` 都在同一前缀下）。

## 测试

```bash
npm run check
npm run test:direct
```

`tests/game.test.js` 用最小 DOM 桩把浏览器代码跑起来，覆盖开局、撞墙判负、结算写档、空格暂停、切后台自动暂停、父页面 `task-done` 通知。
