import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import { siteDirectory, verifyPublishedSite, verifySiteOutput } from "./site-output.mjs";

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--live"), "Usage: npm run site:verify [-- --live]");
const inventory = await verifySiteOutput(siteDirectory);
const expectedDigest = process.env.EXPECTED_MANIFEST_SHA256;
if (expectedDigest !== undefined) assert.equal(inventory.sha256, expectedDigest, "The independently rebuilt Pages manifest differs from the build job.");

if (args[0] === "--live") await verifyPublishedSite(inventory);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, "sha256=" + inventory.sha256 + "\n");
}
const scope = args[0] === "--live" ? "Published GitHub Pages" : "Local GitHub Pages";
console.log(scope + " verified " + inventory.files.length + " files. deployment.json SHA-256 " + inventory.sha256 + ".");
