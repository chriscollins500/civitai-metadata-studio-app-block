import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appBlockDirectory, root } from "./output-paths.mjs";
import { renderAppBlock } from "./render-app-block.mjs";
import { validateHostedRecord, verifyHostedBytes, verifyHostedCatalogs } from "./hosted-deployment.mjs";

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

function assertArtifact(name, bytes, expected) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(bytes.length, expected.bytes, name + " byte length differs from the release record.");
  assert.equal(hash, expected.sha256, name + " SHA-256 differs from the release record.");
  console.log(name + " · " + bytes.length + " bytes · SHA-256 " + hash);
}

assertArtifact("index.html (signed source release " + release.version + ")", html, release.productionHtml);
assertArtifact(archiveName, archive, release.archive);

const hosted = JSON.parse(await readFile(join(root, "releases", "live.json"), "utf8"));
validateHostedRecord(hosted, release.version);
const hostedBuild = await renderAppBlock(hosted.version, epoch);
const hostedHtml = Buffer.from(hostedBuild.html);
assertArtifact("index.html (hosted " + hosted.version + ")", hostedHtml, hosted.html);

if (args[0] === "--live") {
  const catalogs = await verifyHostedCatalogs(hosted, {
    source: packageJson.repository.url.replace(/\.git$/u, ""), support: packageJson.bugs.url
  });
  await verifyHostedBytes(hosted, hostedHtml);
  for (const { label, listingId } of catalogs) console.log(label + " catalog matches " + listingId + ".");
  console.log("Live HTML matches rebuilt hosted " + hosted.version + " byte for byte · " + new Date().toISOString());
}
