import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appBlockDirectory, root } from "./output-paths.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--live"), "Pass --live for a direct production comparison.");
const manifest = JSON.parse(await readFile(join(appBlockDirectory, "block.manifest.json"), "utf8"));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/u);
const release = JSON.parse(await readFile(join(root, "releases", manifest.version + ".json"), "utf8"));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const epoch = (await readFile(join(root, "app-block/build-epoch.txt"), "utf8")).trim();
assert.equal(release.version, manifest.version);
assert.equal(packageJson.version, manifest.version);
assert.equal(String(release.sourceDateEpoch), epoch);
assert.equal(process.env.SOURCE_DATE_EPOCH ?? epoch, epoch, "Use the release's committed build epoch.");

const html = await readFile(join(appBlockDirectory, "index.html"));
const archiveName = "civitai-metadata-studio-app-block-" + manifest.version + ".zip";
assert.equal(release.archive.filename, archiveName);
const archive = await readFile(join(root, "build", archiveName));

for (const [name, bytes, expected] of [
  ["index.html", html, release.productionHtml],
  [archiveName, archive, release.archive]
]) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(bytes.length, expected.bytes, name + " byte length differs from the release record.");
  assert.equal(hash, expected.sha256, name + " SHA-256 differs from the release record.");
  console.log(name + " · " + bytes.length + " bytes · SHA-256 " + hash);
}

if (args[0] === "--live") {
  const liveUrl = "https://civitai-metadata-studio.civit.ai/";
  assert.equal(release.productionHtml.url, liveUrl);
  const response = await fetch(liveUrl, {
    cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20_000)
  });
  assert.equal(response.status, 200, "Civitai production returned HTTP " + response.status);
  assert.match(response.headers.get("content-type") || "", /^text\/html\b/i);
  const parts = [];
  let received = 0;
  for await (const part of response.body) {
    received += part.byteLength;
    assert.ok(received <= html.length, "The live deployment grew beyond this release's recorded size.");
    parts.push(part);
  }
  const live = Buffer.concat(parts, received);
  assert.ok(html.equals(live), "Live HTML differs from this release. Check whether Civitai deployed a newer version.");
  console.log("Live HTML matches the rebuilt release byte for byte · " + new Date().toISOString());
}
