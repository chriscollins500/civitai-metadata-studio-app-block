import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { website } from "../website/layout.mjs";
import { pages } from "../website/pages.mjs";
import { root } from "./output-paths.mjs";
import { readPublicBytes } from "./public-bytes.mjs";

export const siteDirectory = join(root, "build", "site");
export const manifestFile = "deployment.json";
export const siteAssets = [
  ["app-block/listing/icon.png", "studio-icon.png"],
  ["app-block/listing/cover.png", "studio-cover.png"],
  ["website/assets/studio.css", "studio.css"],
  ["website/assets/instrument-serif.woff2", "instrument-serif.woff2"],
  ["website/assets/instrument-serif-italic.woff2", "instrument-serif-italic.woff2"],
  ["website/assets/OFL-Instrument-Serif.txt", "OFL-Instrument-Serif.txt"],
  ["website/assets/aurora-observatory-480.webp", "aurora-observatory-480.webp"],
  ["website/assets/aurora-observatory.webp", "aurora-observatory.webp"],
  ["website/assets/aurora-observatory.png", "aurora-observatory.png"],
  ["website/assets/aurora-observatory-source.png", "aurora-observatory-source.png"],
];
export const pageFilename = (page) => page.notFound ? page.path : page.path + "index.html";
const contentFiles = [
  ...pages.map(pageFilename),
  ...siteAssets.map(([, name]) => "assets/" + name),
  "sitemap.xml",
].sort();
export const siteFiles = new Set([...contentFiles, manifestFile]);
const directories = new Set(contentFiles.map(posix.dirname).filter((path) => path !== "."));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function assertSiteLayout(directory) {
  for (const path of [dirname(directory), directory]) {
    try {
      assert.ok((await lstat(path)).isDirectory(), "Expected an ordinary directory: " + path);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
  async function visit(path) {
    const entries = await readdir(join(directory, path), { withFileTypes: true });
    for (const entry of entries) {
      const name = posix.join(path, entry.name);
      if (entry.isDirectory() && directories.has(name)) await visit(name);
      else assert.ok(entry.isFile() && siteFiles.has(name), "Unexpected site output: " + name);
    }
  }
  await visit("");
}

export async function createSiteManifest(directory) {
  const files = await Promise.all(contentFiles.map(async (path) => {
    const bytes = await readFile(join(directory, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  }));
  const manifest = { schemaVersion: 1, baseUrl: website, files };
  const body = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  return { files, body, sha256: sha256(body) };
}

export async function verifySiteOutput(directory) {
  await assertSiteLayout(directory);
  const expected = await createSiteManifest(directory);
  const actual = await readFile(join(directory, manifestFile));
  assert.ok(actual.equals(expected.body), "Site output differs from deployment.json. Rebuild with npm run site:build.");
  return expected;
}

export async function verifyPublishedSite(inventory, request = fetch) {
  const manifestUrl = new URL(manifestFile, website);
  const actual = await readPublicBytes(manifestUrl, inventory.body.length, { type: "application/json", request });
  assert.ok(actual.equals(inventory.body), manifestUrl.href + " differs from the local manifest. Check your source revision and the Pages deployment.");

  for (const { path, bytes, sha256: expectedSha } of inventory.files) {
    const url = new URL(path.replace(/(^|\/)index\.html$/u, "$1"), website);
    const content = await readPublicBytes(url, bytes, { request });
    assert.ok(content.length === bytes && sha256(content) === expectedSha, url.href + " differs from the locally built file.");
  }
}
