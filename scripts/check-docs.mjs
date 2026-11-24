import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, posix, resolve, relative, isAbsolute } from "node:path";
import { root } from "./output-paths.mjs";

const files = ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SUPPORT.md", "SECURITY.md", "CODE_OF_CONDUCT.md",
  ...((await readdir(join(root, "docs"))).filter(name => name.endsWith(".md")).map(name => "docs/" + name))];
let links = 0;
for (const file of files) {
  const content = (await readFile(join(root, file), "utf8")).replace(/^ {0,3}\x60{3}[\s\S]*?^ {0,3}\x60{3}[^\n]*/gmu, "");
  assert.match(content, /^# .+/m, file + " needs a page title.");
  for (const [, destination] of content.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/gu)) {
    if (/^(https:\/\/|#)/u.test(destination)) continue;
    const path = decodeURIComponent(destination.split("#")[0]);
    const target = resolve(root, dirname(file), posix.normalize(path));
    const remainder = relative(root, target);
    assert.ok(remainder && !remainder.startsWith("..") && !isAbsolute(remainder), file + " has an out-of-tree link.");
    const info = await stat(target).catch(() => null);
    assert.ok(info?.isFile() || info?.isDirectory(), file + " links to a missing path " + destination);
    links += 1;
  }
}
console.log("Documentation navigation verified · " + files.length + " pages · " + links + " local links.");
