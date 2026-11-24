import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { request } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startAppBlockPreview } from "../scripts/serve-app-block-preview.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "studio-preview-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = { "index.html": "<!doctype html><title>Synthetic preview</title>", "block.manifest.json": "{}", "LICENSE": "Synthetic license" };
  files["SHA256SUMS.txt"] = Object.entries(files).map(([name, bytes]) => `${hash(bytes)}  ${name}\n`).join("");
  await Promise.all(Object.entries(files).map(([name, bytes]) => writeFile(join(directory, name), bytes)));
  return { directory, files };
}
function get(origin, path, headers = {}, method = "GET") {
  return new Promise((accept, reject) => {
    const req = request(origin + path, { method, headers }, (res) => {
      const chunks = []; res.on("data", (chunk) => chunks.push(chunk)); res.on("end", () => accept({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject); req.end();
  });
}

test("public preview serves only checksum-verified snapshots, with opaque-frame headers and no writable routes", async (t) => {
  const { directory, files } = await fixture(t);
  const preview = await startAppBlockPreview({ directory, port: 0 });
  t.after(preview.close);
  const main = await get(preview.origin, "/?dev=SYNTHETIC_CREDENTIAL_DO_NOT_LOG");
  assert.equal(main.status, 200); assert.equal(main.body, files["index.html"]);
  assert.equal(main.headers["access-control-allow-origin"], "*");
  assert.equal(main.headers["content-security-policy"], "frame-ancestors https://civitai.red");
  assert.equal(main.headers["cache-control"], "no-store");
  assert.equal(main.headers["x-content-type-options"], "nosniff");
  assert.equal((await get(preview.origin, "/index.html", {}, "HEAD")).body, "");
  assert.equal((await get(preview.origin, "/index.html", {}, "POST")).status, 405);
  for (const path of ["/.git/config", "/HANDOFF.md", "/../SECURITY.md", "/%2e%2e/SECURITY.md", "/index.html/secret", "/%69ndex.html"]) assert.equal((await get(preview.origin, path)).status, 404);
  assert.equal((await get(preview.origin, "/", { Host: "evil.example" })).status, 421);
  assert.equal((await get(preview.origin, "/", { Host: "dev-0123456789abcdef.civit.ai" })).status, 200);
  await writeFile(join(directory, "index.html"), "CHANGED_AFTER_START");
  assert.equal((await get(preview.origin, "/")).body, files["index.html"]);
  assert.equal(preview.htmlSha256, hash(files["index.html"]));
});

test("preview refuses unexpected files and checksum drift before listening", async (t) => {
  const { directory } = await fixture(t);
  await writeFile(join(directory, "private.txt"), "SYNTHETIC_PRIVATE_DATA");
  await assert.rejects(startAppBlockPreview({ directory, port: 0 }), /allowlist/);
  await rm(join(directory, "private.txt"));
  await writeFile(join(directory, "LICENSE"), "MISMATCH");
  await assert.rejects(startAppBlockPreview({ directory, port: 0 }), /checksums/);
});
