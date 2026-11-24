import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { appBlockDirectory } from "./output-paths.mjs";

const names = ["index.html", "block.manifest.json", "LICENSE", "SHA256SUMS.txt"];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Serve an immutable, audited build snapshot. Never expose the workbench or log
// request URLs: the tunnel's entry URL can contain a short-lived credential.
export async function startAppBlockPreview({ directory = appBlockDirectory, port = 5186, lifetimeMs = 3_600_000 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid preview port.");
  if (!Number.isFinite(lifetimeMs) || lifetimeMs <= 0 || lifetimeMs > 3_600_000) throw new Error("Preview lifetime must be at most one hour.");
  const entries = await readdir(directory);
  if (entries.length !== names.length || names.some((name) => !entries.includes(name))) throw new Error("Preview directory differs from the four-file bundle allowlist.");
  const files = new Map();
  for (const name of names) {
    const path = join(directory, name), info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024 * 1024) throw new Error("Preview requires bounded regular bundle files.");
    files.set(name, await readFile(path));
  }
  const sums = files.get("SHA256SUMS.txt").toString("utf8").trim().split(/\r?\n/u);
  const expected = new Map(sums.map((line) => line.split("  ")));
  if (expected.size !== 3 || names.slice(0, 3).some((name) => expected.get(digest(files.get(name))) !== name)) throw new Error("Preview bundle checksums do not match.");
  const server = createServer({ maxHeaderSize: 16_384 }, (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "frame-ancestors https://civitai.red");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, HEAD");
    const localPort = server.address()?.port;
    const host = request.headers.host || "";
    if (!["127.0.0.1:" + localPort, "localhost:" + localPort].includes(host) && !/^dev-[a-f0-9]{16}\.civit\.ai(?::443)?$/u.test(host)) {
      response.writeHead(421).end("Unrecognized preview host."); return;
    }
    if (!["GET", "HEAD"].includes(request.method)) { response.setHeader("Allow", "GET, HEAD"); response.writeHead(405).end("Read-only preview."); return; }
    const raw = request.url || "";
    if (!raw.startsWith("/") || raw.length > 8192) { response.writeHead(400).end("Invalid request."); return; }
    // Do not normalize/decode paths into an allowed filename.
    const path = raw.split("?", 1)[0];
    const name = path === "/" ? "index.html" : path.slice(1);
    if (!files.has(name)) { response.writeHead(404).end("Not found."); return; }
    const bytes = files.get(name);
    response.setHeader("Content-Type", name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".json") ? "application/json; charset=utf-8" : "text/plain; charset=utf-8");
    response.setHeader("Content-Length", bytes.length);
    response.writeHead(200).end(request.method === "HEAD" ? undefined : bytes);
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  await new Promise((accept, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", accept); });
  const close = () => new Promise((accept, reject) => { server.close((error) => error ? reject(error) : accept()); server.closeIdleConnections(); });
  const timer = setTimeout(() => { void close(); }, lifetimeMs);
  timer.unref(); server.once("close", () => clearTimeout(timer));
  return { server, close, origin: `http://127.0.0.1:${server.address().port}`, htmlSha256: digest(files.get("index.html")), expiresAt: new Date(Date.now() + lifetimeMs).toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const preview = await startAppBlockPreview({ port: Number(process.argv[2] || 5186) });
  console.log(JSON.stringify({ origin: preview.origin, htmlSha256: preview.htmlSha256, expiresAt: preview.expiresAt, files: names }));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void preview.close(); });
}
