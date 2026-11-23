import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["src", "public", "scripts", "tests"];
const files = [];

for (const dir of targets) {
  files.push(...(await collect(path.join(root, dir))));
}

const failed = [];

for (const file of files.sort()) {
  // 用 inherit 而不是默认管道：某些受限环境下管道会 EPERM。
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: ["ignore", "inherit", "inherit"]
  });

  if (result.status !== 0) {
    failed.push(path.relative(root, file));
    console.error(`✗ ${path.relative(root, file)}`);
  }
}

if (failed.length > 0) {
  console.error(`\n${failed.length} / ${files.length} 个文件语法检查未通过。`);
  process.exit(1);
}

console.log(`✓ ${files.length} 个文件语法检查通过。`);

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...(await collect(full)));
      continue;
    }

    if (/\.(js|mjs)$/.test(entry.name)) {
      found.push(full);
    }
  }

  return found;
}
