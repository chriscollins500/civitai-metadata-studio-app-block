import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, rmdir, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { catalogUrl, civitaiSites, storeSignInUrl, validateHostedRecord, verifyHostedBytes, verifyHostedCatalogs } from "../scripts/hosted-deployment.mjs";
import { createSiteManifest, manifestFile, siteFiles, verifyPublishedSite, verifySiteOutput } from "../scripts/site-output.mjs";
import { website } from "../website/layout.mjs";

const hosted = JSON.parse(await readFile(new URL("../releases/live.json", import.meta.url), "utf8"));
const project = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const expectedLinks = { source: project.repository.url.replace(/\.git$/u, ""), support: project.bugs.url };

test("first launch keeps the Store on the chosen Civitai site", () => {
  for (const site of civitaiSites) {
    const url = new URL(storeSignInUrl(site));
    assert.equal(url.origin, site.origin);
    assert.equal(url.pathname, "/login");
    assert.deepEqual([...url.searchParams], [["returnUrl", "/apps/store"]]);
  }
});

test("both anonymous Civitai catalogs must match the recorded deployment", async () => {
  validateHostedRecord(hosted, project.version);
  const validListing = {
    id: hosted.catalog.listingId, slug: hosted.catalog.slug, kind: "onsite",
    sourceRepoUrl: expectedLinks.source + "/", issueTrackerUrl: expectedLinks.support,
    kindData: {
      kind: "onsite", appBlockId: hosted.catalog.appBlockId, liveUrl: hosted.html.url.slice(0, -1), hasPage: true
    }
  };
  const visited = new Set();
  const accept = await verifyHostedCatalogs(hosted, expectedLinks, async (url, options) => {
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "manual");
    assert.ok(!visited.has(url), "Each catalog should be requested once.");
    visited.add(url);
    return Response.json(validListing);
  });
  assert.deepEqual(visited, new Set(civitaiSites.map((site) => catalogUrl(site, hosted))));
  assert.deepEqual(accept.map(({ listingId }) => listingId), civitaiSites.map(() => hosted.catalog.listingId));

  for (const [listing, message] of [
    [{ ...validListing, issueTrackerUrl: expectedLinks.source }, /Support link/],
    [{ ...validListing, kindData: { ...validListing.kindData, hasPage: false } }, /page availability/],
  ]) {
    await assert.rejects(verifyHostedCatalogs(hosted, expectedLinks, async (url) =>
      Response.json(new URL(url).hostname === "civitai.red" ? listing : validListing)), message);
  }
  let redRequests = 0;
  await assert.rejects(verifyHostedCatalogs(hosted, expectedLinks, async (url) => {
    if (new URL(url).hostname === "civitai.red") {
      redRequests += 1;
      return new Response(null, { status: 429, headers: { "retry-after": "1" } });
    }
    return Response.json(validListing);
  }), /civitai\.red\/.*HTTP 429/u);
  assert.equal(redRequests, 1);
});

test("the hosted HTML comparison detects a same-length edit", async () => {
  const rebuilt = Buffer.from("<p>a</p>");
  const reply = (body) => async () => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
  await verifyHostedBytes(hosted, rebuilt, reply(rebuilt));
  await assert.rejects(verifyHostedBytes(hosted, rebuilt, reply("<p>b</p>")), /Live HTML differs/u);
});

async function writeSiteFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "metadata-studio-site-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const path of siteFiles) {
    if (path === manifestFile) continue;
    const file = join(directory, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, "first " + path + "\n");
  }
  const manifest = await createSiteManifest(directory);
  await writeFile(join(directory, manifestFile), manifest.body);
  const responses = new Map();
  for (const path of siteFiles) {
    const route = path.replace(/(^|\/)index\.html$/u, "$1");
    responses.set(new URL(route, website).href, await readFile(join(directory, path)));
  }
  return { directory, manifest, responses };
}

test("a normal Pages build verifies and unexpected local content is rejected", async (t) => {
  const { directory, manifest } = await writeSiteFixture(t);
  assert.equal((await verifySiteOutput(directory)).sha256, manifest.sha256);

  await writeFile(join(directory, "index.html"), "other index.html\n");
  await assert.rejects(verifySiteOutput(directory), /differs from deployment\.json/u);

  const extra = join(directory, "unexpected.txt");
  await writeFile(extra, "extra");
  await assert.rejects(verifySiteOutput(directory), /Unexpected site output: unexpected\.txt/u);
});

test("an allowed Pages path must be a real directory", async (t) => {
  const { directory } = await writeSiteFixture(t);
  await unlink(join(directory, "guide", "index.html"));
  await rmdir(join(directory, "guide"));
  try {
    await symlink(join(directory, "privacy"), join(directory, "guide"), "junction");
  } catch (error) {
    if (error.code !== "EPERM" && error.code !== "EACCES") throw error;
    t.skip("This filesystem context disallows creating a directory link.");
    return;
  }
  await assert.rejects(verifySiteOutput(directory), /Unexpected site output: guide/u);
});

test("published Pages content must match an independently built manifest and files", async (t) => {
  const { directory, manifest, responses } = await writeSiteFixture(t);
  const checked = new Set();
  const manifestUrl = new URL(manifestFile, website).href;
  const guideUrl = new URL("guide/", website).href;
  const request = async (url, options) => {
    assert.ok(responses.has(url), "Use canonical, prefixed routes.");
    assert.ok(!checked.has(url), "Request each file only once.");
    assert.equal(options.redirect, "manual");
    assert.equal(options.credentials, "omit");
    checked.add(url);
    return new Response(responses.get(url), { headers: { "content-type": "application/json" } });
  };
  await verifyPublishedSite(manifest, request);
  assert.equal(checked.size, siteFiles.size);

  responses.set(guideUrl, Buffer.from("other guide/index.html\n"));
  checked.clear();
  await assert.rejects(verifyPublishedSite(manifest, request), /guide\/ differs/u);

  await writeFile(join(directory, "guide/index.html"), responses.get(guideUrl));
  responses.set(manifestUrl, (await createSiteManifest(directory)).body);
  checked.clear();
  await assert.rejects(verifyPublishedSite(manifest, request), /differs from the local manifest/u);
  assert.deepEqual([...checked], [manifestUrl]);

  responses.set(manifestUrl, manifest.body);
  responses.set(guideUrl, Buffer.alloc(responses.get(guideUrl).length + 1));
  checked.clear();
  await assert.rejects(verifyPublishedSite(manifest, request), /exceeded its .*verification limit/u);

  checked.clear();
  await assert.rejects(verifyPublishedSite(manifest, async (url, options) =>
    url === guideUrl ? Response.redirect("https://example.invalid/guide/") : request(url, options)), /guide\/ returned HTTP 302/u);
});
