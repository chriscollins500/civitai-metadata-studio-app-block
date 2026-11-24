import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const roots = ["src", "scripts", "tests", "app-block"].map((name) => new URL("../" + name + "/", import.meta.url));
let count = 0;
async function check(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (["node_modules", "test-results", "playwright-report"].includes(entry.name)) continue;
    const target = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, path);
    if (entry.isDirectory()) await check(target);
    else if (/\.(?:mjs|js|d\.ts)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ["--check", fileURLToPath(target)], { encoding: "utf8", windowsHide: true });
      if (result.status !== 0) throw new Error(result.stderr || result.error?.message || `Syntax failed: ${join(String(path), entry.name)}`);
      count += 1;
    }
  }
}
for (const root of roots) await check(root);
console.log(`Syntax checked ${count} source, script, and test modules.`);
