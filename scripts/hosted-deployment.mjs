import assert from "node:assert/strict";
import { readPublicBytes } from "./public-bytes.mjs";

export const civitaiSites = Object.freeze([
  Object.freeze({ label: "Civitai.com", origin: "https://civitai.com" }),
  Object.freeze({ label: "Civitai.red", origin: "https://civitai.red" })
]);
const entryUrl = "https://civitai-metadata-studio.civit.ai/";
const storePath = "/apps/store";

export function storeSignInUrl({ origin }) {
  return new URL("/login?returnUrl=" + encodeURIComponent(storePath), origin).href;
}

export function catalogUrl({ origin }, { catalog }) {
  return new URL("/api/v1/apps/" + encodeURIComponent(catalog.slug), origin).href;
}

export function validateHostedRecord(hosted, releaseVersion) {
  assert.equal(hosted.referenceVersion, releaseVersion, "The hosted record must reference the signed source release.");
  assert.match(hosted.version, /^[0-9]+\.[0-9]+\.[0-9]+$/u, "Expected a stable hosted version.");
  assert.match(hosted.verifiedOn, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "Expected a recorded calendar date.");
  assert.equal(new Date(hosted.verifiedOn).toISOString().slice(0, 10), hosted.verifiedOn);
  assert.equal(hosted.html.url, entryUrl, "The hosted record must point to the exact App Block entry.");
  assert.ok(Number.isSafeInteger(hosted.html.bytes) && hosted.html.bytes > 0, "Expected a positive hosted byte count.");
  assert.match(hosted.html.sha256, /^[0-9a-f]{64}$/u, "Expected a hosted HTML SHA-256.");
  assert.equal(hosted.catalog.slug, "civitai-metadata-studio");
  assert.match(hosted.catalog.listingId, /^apl_[0-9A-Z]{26}$/u, "Expected a Civitai listing ID.");
  assert.match(hosted.catalog.appBlockId, /^apb_[0-9A-Z]{26}$/u, "Expected a Civitai App Block ID.");
}

function withoutTrailingSlash(value) {
  return typeof value === "string" ? value.replace(/\/$/u, "") : value;
}

export async function verifyHostedCatalogs(hosted, { source, support }, request = fetch) {
  return Promise.all(civitaiSites.map(async (site) => {
    const url = catalogUrl(site, hosted);
    const bytes = await readPublicBytes(url, 64 * 1024, { type: "application/json", request });
    let listing;
    try {
      listing = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new Error(url + " returned invalid catalog JSON.");
    }
    const block = listing?.kindData;
    for (const [field, actual, expected] of [
      ["listing ID", listing?.id, hosted.catalog.listingId],
      ["slug", listing?.slug, hosted.catalog.slug],
      ["listing kind", listing?.kind, "onsite"],
      ["App Block kind", block?.kind, "onsite"],
      ["App Block ID", block?.appBlockId, hosted.catalog.appBlockId],
      ["published page availability", block?.hasPage, true],
      ["hosted HTML URL", withoutTrailingSlash(block?.liveUrl), withoutTrailingSlash(hosted.html.url)],
      ["Source link", withoutTrailingSlash(listing?.sourceRepoUrl), withoutTrailingSlash(source)],
      ["Support link", withoutTrailingSlash(listing?.issueTrackerUrl), withoutTrailingSlash(support)]
    ]) {
      if (actual !== expected) throw new Error(url + " has a different " + field + " than the project records.");
    }
    return { label: site.label, listingId: hosted.catalog.listingId };
  }));
}

export async function verifyHostedBytes(hosted, rebuiltHtml, request = fetch) {
  const remote = await readPublicBytes(hosted.html.url, rebuiltHtml.length, { type: "text/html", request });
  assert.ok(rebuiltHtml.equals(remote), "Live HTML differs from hosted " + hosted.version + ". Check the deployment and its record.");
}
