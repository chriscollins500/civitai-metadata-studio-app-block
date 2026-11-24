import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import Studio from "../src/engine.mjs";
import { layout, website } from "../website/layout.mjs";
import { pages } from "../website/pages.mjs";
import { root } from "./output-paths.mjs";

const output = join(root, "build", "site");
const assets = [
  ["app-block/listing/icon.png", "studio-icon.png"],
  ["app-block/listing/cover.png", "studio-cover.png"],
  ["website/assets/studio.css", "studio.css"],
  ["website/assets/instrument-serif.woff2", "instrument-serif.woff2"],
  ["website/assets/instrument-serif-italic.woff2", "instrument-serif-italic.woff2"],
  ["website/assets/OFL-Instrument-Serif.txt", "OFL-Instrument-Serif.txt"],
  ["website/assets/aurora-observatory.webp", "aurora-observatory.webp"],
  ["website/assets/aurora-observatory.png", "aurora-observatory.png"],
  ["website/assets/aurora-observatory-source.png", "aurora-observatory-source.png"],
];
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const manifest = await readJson("package.json");
assert.equal(manifest.homepage, website, "Use the Pages home for the repository’s package homepage.");
assert.match(manifest.version, /^[0-9]+\.[0-9]+\.[0-9]+$/u, "Expected a tagged stable App Block release.");
const release = await readJson("releases/" + manifest.version + ".json");
const hosted = await readJson("releases/live.json");
assert.equal(release.version, manifest.version);
assert.equal(hosted.referenceVersion, release.version);
assert.match(hosted.version, /^[0-9]+\.[0-9]+\.[0-9]+$/u, "Expected a versioned Civitai deployment.");
for (const artifact of [release.productionHtml, release.archive, hosted.html]) {
  assert.match(artifact.sha256, /^[a-f0-9]{64}$/u, "Invalid release digest.");
  assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0, "Invalid release size.");
}
assert.equal(release.archive.filename, "civitai-metadata-studio-app-block-" + release.version + ".zip");

async function inspectPng(filename) {
  const bytes = await readFile(join(root, "website", "assets", filename));
  const inspection = await Studio.png.inspect(new File([bytes], filename, { type: "image/png" }));
  const pixels = createHash("sha256");
  for (const chunk of inspection.chunks) {
    if (chunk.type === "IDAT") pixels.update(bytes.subarray(chunk.offset, chunk.offset + chunk.totalLength));
  }
  return { inspection, encodedPixels: pixels.digest("hex") };
}

const example = await inspectPng("aurora-observatory.png");
const original = await inspectPng("aurora-observatory-source.png");
assert.equal(example.encodedPixels, original.encodedPixels, "The example must keep the source’s encoded image.");
assert.ok(original.inspection.chunks.some(({ type }) => type === "caBX"), "Keep the original content-credentials chunk.");
const { a1111, width, height } = example.inspection;
assert.ok(a1111?.fields.positivePrompt && a1111.fields.negativePrompt);
assert.equal(a1111.resources.length, 0, "The example should not trigger an automatic resource lookup.");
assert.equal(a1111.rawSettings.Size, width + "x" + height);
const settings = ["Steps", "Sampler", "CFG scale", "Seed"].map((label) => {
  const value = a1111.rawSettings[label];
  assert.ok(value, "Missing example setting " + label + ".");
  return [label, value];
});
const sample = { width, height, prompt: a1111.fields.positivePrompt, negativePrompt: a1111.fields.negativePrompt, settings };

const htmlPages = new Map(pages.map((page) => {
  const filename = page.notFound ? page.path : page.path + "index.html";
  return [filename, layout(page, page.render({ release, hosted, sample }))];
}));
const expected = new Set([...htmlPages.keys(), ...assets.map(([, name]) => "assets/" + name), "sitemap.xml"]);
const home = new URL(website);
const pageIds = new Map([...htmlPages].map(([name, markup]) => [
  name,
  new Set([...markup.matchAll(/(?:^|\s)id="([^"]+)"/gu)].map(([, id]) => id)),
]));

let links = 0;
for (const [name, markup] of htmlPages) {
  assert.ok(pageIds.get(name).has("main"), name + " is missing the skip-link destination.");
  for (const [, value] of markup.matchAll(/\s(?:href|src)="([^"]+)"/gu)) {
    const url = new URL(value.replaceAll("&amp;", "&"), new URL(name, home));
    assert.equal(url.protocol, "https:", name + " has a non-HTTPS destination.");
    if (url.origin !== home.origin) continue;
    assert.ok(url.pathname.startsWith(home.pathname), name + " has a same-site link outside Pages.");
    const path = url.pathname.slice(home.pathname.length);
    const filename = url.pathname.endsWith("/") ? path + "index.html" : path;
    assert.ok(expected.has(filename), name + " links to a missing file " + filename + ".");
    if (url.hash) assert.ok(pageIds.get(filename)?.has(decodeURIComponent(url.hash.slice(1))), name + " links to a missing fragment " + value + ".");
    links += 1;
  }
}

await mkdir(output, { recursive: true });
const existingFiles = (await readdir(output, { recursive: true, withFileTypes: true }))
  .filter((entry) => !entry.isDirectory());
for (const entry of existingFiles) {
  const relative = join(entry.parentPath, entry.name).slice(output.length + 1).replaceAll("\\", "/");
  assert.ok(entry.isFile() && expected.has(relative), "Unexpected website output: " + relative);
}

for (const [source, name] of assets) {
  const destination = join(output, "assets", name);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, source), destination);
}
for (const [filename, markup] of htmlPages) {
  const destination = join(output, filename);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, markup);
}
const canonicalUrls = pages.filter((page) => !page.notFound).map((page) => new URL(page.path, home).href);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...canonicalUrls.map((url) => '  <url><loc>' + url + '</loc></url>'),
  '</urlset>',
  "",
].join("\n");
await writeFile(join(output, "sitemap.xml"), sitemap);
console.log("Built " + canonicalUrls.length + " GitHub Pages routes, a custom 404, and " + assets.length + " public assets.");
console.log("Verified " + links + " internal links and the example PNG’s metadata and encoded pixels.");
