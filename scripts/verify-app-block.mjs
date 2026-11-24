import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { appBlockDirectory, root } from "./output-paths.mjs";
import { verifyStandaloneDestination } from "./verify-standalone-destination.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--schema"), "Pass --schema for independent Python schema validation.");
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const provenance = JSON.parse(await readFile(join(root, "app-block/protocol-provenance.json"), "utf8"));
const actualNames = await readdir(appBlockDirectory);
assert.deepEqual(actualNames.sort(), [...provenance.bundleAllowlist].sort(), "Bundle must contain only the audited allowlist.");
const manifest = JSON.parse(await readFile(join(appBlockDirectory, "block.manifest.json"), "utf8"));
assert.deepEqual(manifest, JSON.parse(await readFile(join(root, "app-block/block.manifest.json"), "utf8")));
assert.equal(manifest.version, version);
assert.deepEqual(manifest.scopes, []);
assert.equal(manifest.iframe.sandbox, "allow-scripts");
const { minHeight, maxHeight } = manifest.iframe;
assert.ok(Number.isFinite(minHeight) && minHeight >= 40 && minHeight <= 4000, "Official CLI/platform semantics require iframe.minHeight in [40, 4000].");
assert.ok(
  maxHeight === null || (Number.isInteger(maxHeight) && maxHeight >= minHeight && maxHeight <= 4000),
  "The platform requires an explicit iframe.maxHeight of null or an integer from minHeight to 4000."
);
assert.equal(manifest.contentRating, "pg13", "The app listing must be eligible for both requested Civitai domains.");
assert.equal(manifest.iframe.src, undefined);
const referenceText = await readFile(join(root, "app-block/reference-data.json"), "utf8");
assert.equal(createHash("sha256").update(referenceText).digest("hex"), provenance.referenceSnapshot.sha256, "Official reference snapshot drifted.");
assert.equal(manifest.trustTier, undefined);
const schemaText = await readFile(join(root, "app-block/manifest.schema.json"), "utf8");
assert.equal(createHash("sha256").update(schemaText).digest("hex"), provenance.schemaSnapshotSha256, "Canonical schema snapshot drifted.");
if (args[0] === "--schema") {
  const schema = JSON.parse(schemaText);
  const code = "import json,sys; from jsonschema import Draft202012Validator; d=json.load(sys.stdin); Draft202012Validator.check_schema(d['schema']); Draft202012Validator(d['schema']).validate(d['manifest']); print('Canonical manifest schema: PASS')";
  const validation = spawnSync(process.env.CM_STUDIO_PYTHON || "python", ["-c", code], {
    input: JSON.stringify({ schema, manifest }), encoding: "utf8", windowsHide: true, timeout: 20_000
  });
  assert.equal(validation.status, 0, validation.stderr || validation.error?.message || "Canonical schema validation failed.");
  console.log(validation.stdout.trim());
}
const html = await readFile(join(appBlockDirectory, "index.html"), "utf8");
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/iu);
assert.ok(inlineScript?.[1]);
const script = inlineScript[1];
assert.equal(createHash("sha256").update(script).digest("base64"), html.match(/script-src 'sha256-([^']+)'/u)?.[1]);
assert.doesNotMatch(html, /%%[A-Z_]+%%|<script[^>]+src=|innerHTML\s*=|\beval\s*\(|new\s+Function\s*\(/iu);
assert.match(html, /connect-src https:\/\/civitai\.com; worker-src 'none'/u);
assert.match(html, /hostAcknowledgement/u);
verifyStandaloneDestination(html.slice(0, inlineScript.index), script);
assert.match(html, /Download started/u);
assert.match(html, /Load reference lists/u);
assert.match(html, /Live refresh is unavailable here; fields remain editable/u);
assert.ok(html.includes(provenance.referenceSnapshot.accessedOn));
assert.ok(html.includes(await readFile(join(root, "LICENSE"), "utf8")));
assert.doesNotMatch(html, /C:\\Users\\|C:\\Codex Projects\\|127\.0\.0\.1|localhost/iu);
const sums = await readFile(join(appBlockDirectory, "SHA256SUMS.txt"), "utf8");
const summedNames = [];
for (const line of sums.trim().split("\n")) {
  const [expected, name] = line.split("  ");
  assert.ok(provenance.bundleAllowlist.includes(name));
  summedNames.push(name);
  assert.equal(createHash("sha256").update(await readFile(join(appBlockDirectory, name))).digest("hex"), expected);
}
assert.deepEqual(summedNames.sort(), ["LICENSE", "block.manifest.json", "index.html"]);
const archivePath = join(root, `build/civitai-metadata-studio-app-block-${manifest.version}.zip`);
const archive = await readFile(archivePath);
let offset = 0;
const entries = [];
while (archive.readUInt32LE(offset) === 0x04034b50) {
  assert.equal(archive.readUInt16LE(offset + 8), 0, "Local bundle archive must use stored entries.");
  assert.equal(archive.readUInt16LE(offset + 6), 0x0800);
  const size = archive.readUInt32LE(offset + 18);
  assert.equal(archive.readUInt32LE(offset + 22), size);
  const length = archive.readUInt16LE(offset + 26), extra = archive.readUInt16LE(offset + 28);
  const name = archive.subarray(offset + 30, offset + 30 + length).toString("utf8");
  assert.ok(provenance.bundleAllowlist.includes(name));
  assert.equal(entries.includes(name), false);
  const start = offset + 30 + length + extra;
  const bytes = archive.subarray(start, start + size);
  assert.equal(crc32(bytes), archive.readUInt32LE(offset + 14));
  assert.deepEqual(bytes, await readFile(join(appBlockDirectory, name)));
  entries.push(name); offset = start + size;
}
assert.deepEqual(entries.sort(), [...provenance.bundleAllowlist].sort());
assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);
assert.equal(archive.readUInt32LE(archive.length - 6), offset);
console.log(`App Block allowlist, pinned schema/reference snapshots, CSP, manifest checks and archive CRC/bytes: PASS (${archive.length} ZIP bytes).`);
console.log(`SHA256 ${createHash("sha256").update(archive).digest("hex")}`);
