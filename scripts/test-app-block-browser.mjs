import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { root, appBlockDirectory, standaloneDirectory } from "./output-paths.mjs";
import { Studio, imageFixture } from "../tests/fixtures.mjs";

if (!process.env.CM_STUDIO_PLAYWRIGHT) throw new Error("Set CM_STUDIO_PLAYWRIGHT to the index.js of an existing shared Playwright installation. No package or browser is installed by this script.");
const api = await import(pathToFileURL(resolve(process.env.CM_STUDIO_PLAYWRIGHT)).href);
const chromium = api.chromium || api.default.chromium;
const channel = process.argv[2] || "chrome";
assert.ok(["chrome", "msedge"].includes(channel));
const output = join(root, ".tmp/app-block-browser", channel);
await mkdir(output, { recursive: true });
const [html, standalone] = await Promise.all([
  readFile(join(appBlockDirectory, "index.html"), "utf8"), readFile(join(standaloneDirectory, "civitai-metadata-studio.html"), "utf8")
]);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const checks = [];
const requests = [];
const browser = await chromium.launch({ channel, headless: true, args: ["--disable-background-networking"] });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1000 }, serviceWorkers: "block" });
const parentHtml = `<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style></head><body><iframe id="editor" sandbox="allow-scripts" src="https://metadata.civit.ai/index.html"></iframe><script>
const editor=document.getElementById('editor'); window.hostMessages=[]; window.exports=[]; window.mockMode='ok';
editor.addEventListener('load',()=>editor.contentWindow.postMessage({type:'BLOCK_INIT',payload:{blockInstanceId:'synthetic-instance',blockId:'civitai-metadata-studio',appId:'synthetic-app',context:{slotId:'app.page',slug:'civitai-metadata-studio',subPath:'',viewerUserId:null},settings:{},viewer:null,theme:'dark',renderMode:'iframe',token:{raw:'SYNTHETIC_TOKEN_DO_NOT_RETAIN',scopes:[],expiresAt:'2099-01-01T00:00:00Z'}}},'*'));
addEventListener('message',event=>{if(event.source!==editor.contentWindow||event.origin!=='null')return;const m=event.data;if(!m||typeof m!=='object')return;window.hostMessages.push({type:m.type,keys:Object.keys(m.payload||{}),filename:m.payload?.filename,byteLength:m.payload?.bytes?.byteLength});if(m.type!=='SAVE_IMAGE')return;
if(window.mockMode==='delay')return;
if(window.mockMode==='refuse'){editor.contentWindow.postMessage({type:'SAVE_IMAGE_RESULT',payload:{requestId:m.payload.requestId,ok:false,error:'busy'}},'*');return;}
const bytes=m.payload.bytes;window.exports.push({filename:m.payload.filename,bytes:Array.from(new Uint8Array(bytes))});
const url=URL.createObjectURL(new Blob([bytes]));const a=document.createElement('a');a.href=url;a.download=m.payload.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
editor.contentWindow.postMessage({type:'SAVE_IMAGE_RESULT',payload:{requestId:m.payload.requestId,ok:true}},'*');});
<\/script></body></html>`;
await context.route("**/*", async (route) => {
  const request = route.request();
  requests.push({ url: request.url(), method: request.method(), body: request.postData() || "" });
  if (request.url() === "https://civitai.red/__local-metadata-studio-harness") return route.fulfill({ contentType: "text/html", body: parentHtml });
  if (request.url() === "https://metadata.civit.ai/index.html") return route.fulfill({ contentType: "text/html", body: html });
  if (request.url() === "https://standalone.test/index.html") return route.fulfill({ contentType: "text/html", body: standalone });
  if (request.url().startsWith("https://civitai.com/api/v1/")) return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"synthetic offline fixture"}' });
  await route.abort("blockedbyclient");
});

const page = await context.newPage();
let downloadCount = 0;
page.on("download", () => downloadCount++);
try {
  await page.goto("https://civitai.red/__local-metadata-studio-harness");
  assert.equal(await page.locator("#editor").getAttribute("sandbox"), "allow-scripts");
  const frame = await (await page.locator("#editor").elementHandle()).contentFrame();
  await frame.waitForFunction(() => globalThis.CMStudio?.hosted?.bridge.connected === true);
  assert.match(await frame.locator(".trust-list").innerText(), /Local image processing/);
  assert.doesNotMatch(await frame.locator(".trust-list").innerText(), /stay on this device/i);
  assert.equal(await frame.evaluate(() => { try { localStorage.length; return "available"; } catch (error) { return error.name; } }), "SecurityError");
  assert.equal((await frame.evaluate(async () => CMStudio.civitai.cacheStats())).backend, "memory");
  checks.push("actual opaque-origin storage denial with working session cache and handshake");
  await frame.locator("#autoVerify").setChecked(false);
  const png = Buffer.from(await imageFixture("png", { prompt: "SYNTHETIC_PRIVATE_PROMPT", name: "café.png" }).arrayBuffer());
  const workflow = Buffer.from(Studio.png.textChunk("tEXt", "prompt", '{"private":"SYNTHETIC_PRIVATE_WORKFLOW","path":"C:\\\\SYNTHETIC_PRIVATE_PATH\\\\sample.png"}'));
  const original = Buffer.concat([png.subarray(0, png.length - 12), workflow, png.subarray(png.length - 12)]);
  const file = { name: "café.png", mimeType: "image/png", buffer: original };
  await frame.locator("#fileInput").setInputFiles(file);
  await frame.waitForFunction(() => CMStudio.state.currentEntry?.state === "ready");
  await frame.locator("#positivePrompt").fill("SYNTHETIC_EDIT_TO_RECOVER");
  await frame.locator("#steps").click();
  await frame.waitForFunction(() => CMStudio.state.current.fields.positivePrompt.value === "SYNTHETIC_EDIT_TO_RECOVER");
  assert.equal(await page.evaluate(() => hostMessages.filter((message) => message.type === "SAVE_IMAGE").length), 0);
  const expected = Buffer.from(await frame.evaluate(async () => Array.from(new Uint8Array(await CMStudio.canonical.rewrite(CMStudio.state.current).arrayBuffer()))));
  await frame.locator("#saveButton").click();
  await frame.locator("#hostSaveDialog").waitFor({ state: "visible" });
  assert.equal(await frame.locator("#confirmHostSave").isDisabled(), true);
  assert.equal(await page.evaluate(() => hostMessages.filter((message) => message.type === "SAVE_IMAGE").length), 0);
  await frame.locator("#hostAcknowledgement").check();
  const firstDownload = page.waitForEvent("download");
  await frame.locator("#confirmHostSave").click();
  const downloaded = await firstDownload;
  const savedPath = join(output, "edited.png"); await downloaded.saveAs(savedPath);
  const saved = await readFile(savedPath);
  assert.equal(digest(saved), digest(expected));
  assert.equal(saved.includes(Buffer.from("SYNTHETIC_PRIVATE_WORKFLOW")), true);
  const pngPayloads = (buffer) => {
    const chunks = []; let at = 8;
    while (at < buffer.length) {
      const size = buffer.readUInt32BE(at), type = buffer.toString("ascii", at + 4, at + 8);
      assert.equal(crc32(buffer.subarray(at + 4, at + 8 + size)), buffer.readUInt32BE(at + 8 + size));
      if (["IDAT", "fdAT", "fcTL", "acTL"].includes(type)) chunks.push(buffer.subarray(at, at + size + 12));
      at += size + 12;
    }
    return Buffer.concat(chunks);
  };
  assert.deepEqual(pngPayloads(saved), pngPayloads(original));
  await frame.waitForFunction(() => CMStudio.state.busy === false && CMStudio.state.notice.message.startsWith("Download started"));
  checks.push("first-save acknowledgement precedes bytes; actual disk download equals prepared export; independent PNG CRC/payload equality; raw workflow retained");

  const beforeReference = requests.filter((request) => request.url.includes("/api/v1/")).length;
  await frame.locator("#resourcesTab").click();
  await frame.locator("#addResourceButton").click();
  assert.equal(await frame.locator("#refreshReferenceButton").textContent(), "Load reference lists");
  await frame.locator("#refreshReferenceButton").click();
  await frame.waitForFunction(() => document.getElementById("resourceDialogStatus").textContent.includes("Civitai snapshot dated"));
  assert.ok(await frame.locator("#resourceBaseModels option").count() > 100);
  assert.equal(requests.filter((request) => request.url.includes("/api/v1/")).length, beforeReference);
  await frame.locator("#closeResourceDialog").click();
  checks.push("dated hosted Civitai reference lists stay usable without the CORS-blocked endpoint or a proxy");

  const second = { name: "cafe\u0301.png", mimeType: "image/png", buffer: png };
  await frame.locator("#fileInput").setInputFiles(second);
  await frame.waitForFunction(() => CMStudio.state.entries.length === 2 && CMStudio.state.entries.every((entry) => entry.state === "ready"));
  await frame.locator("#saveButton").click();
  await frame.locator("#hostSaveDialog").waitFor({ state: "visible" });
  assert.match(await frame.locator("#hostSaveTitle").textContent(), /ZIP/);
  const beforeCancel = await page.evaluate(() => hostMessages.length);
  await frame.locator("#cancelHostSave").click();
  await frame.waitForFunction(() => CMStudio.state.busy === false);
  assert.equal(await page.evaluate(() => hostMessages.length), beforeCancel);
  await frame.locator("#saveButton").click();
  await frame.locator("#hostSaveDialog").waitFor({ state: "visible" });
  const zipDownload = page.waitForEvent("download"); await frame.locator("#confirmHostSave").click();
  const zipResult = await zipDownload; await zipResult.saveAs(join(output, "images.zip"));
  const zip = await readFile(join(output, "images.zip"));
  let at = 0; const names = [];
  while (zip.readUInt32LE(at) === 0x04034b50) {
    const length = zip.readUInt32LE(at + 18), nameLength = zip.readUInt16LE(at + 26), extra = zip.readUInt16LE(at + 28);
    const name = zip.toString("utf8", at + 30, at + 30 + nameLength); names.push(name);
    const start = at + 30 + nameLength + extra, data = zip.subarray(start, start + length);
    assert.equal(crc32(data), zip.readUInt32LE(at + 14));
    pngPayloads(data); at = start + length;
  }
  assert.equal(names.length, 2); assert.equal(new Set(names.map((name) => name.normalize("NFC").toLowerCase())).size, 2);
  checks.push("explicit ZIP packaging and cancel; actual archive CRCs and Unicode-normalized unique entry names");

  await frame.waitForFunction(() => CMStudio.state.busy === false);
  const handoffDownload = page.waitForEvent("download"); await frame.locator("#exportSessionButton").click();
  const handoffResult = await handoffDownload; const handoffPath = join(output, "edits.json"); await handoffResult.saveAs(handoffPath);
  const local = await context.newPage();
  await local.goto("https://standalone.test/index.html");
  await local.locator("#autoVerify").setChecked(false);
  await local.locator("#fileInput").setInputFiles([file, second]);
  await local.waitForFunction(() => CMStudio.state.entries.length === 2 && CMStudio.state.entries.every((entry) => entry.state === "ready"));
  await local.locator("#sessionInput").setInputFiles({ name: "edits.json", mimeType: "application/json", buffer: await readFile(handoffPath) });
  await local.waitForFunction(() => CMStudio.state.current.fields.positivePrompt.value === "SYNTHETIC_EDIT_TO_RECOVER");
  assert.match(await local.evaluate(() => CMStudio.state.notice.message), /Resumed edits/);
  assert.equal(await local.evaluate(() => CMStudio.environment), undefined);
  checks.push("downloaded hash-bound edit handoff resumes edits in separately built standalone HTML");
  await local.close();

  await page.evaluate(() => { window.mockMode = "refuse"; });
  await frame.locator("#reviewTab").click();
  const beforeRefusal = downloadCount;
  await frame.locator("#exportReportButton").click();
  await frame.waitForFunction(() => CMStudio.state.notice.message.includes("host is busy"));
  assert.equal(downloadCount, beforeRefusal);
  assert.equal(await frame.evaluate(() => CMStudio.state.current.fields.positivePrompt.value), "SYNTHETIC_EDIT_TO_RECOVER");
  await page.evaluate(() => { window.mockMode = "delay"; });
  await frame.evaluate(() => { CMStudio.hosted.bridge.timeoutMs = 40; });
  await frame.locator("#exportReportButton").click();
  await frame.waitForFunction(() => CMStudio.state.notice.message.includes("outcome is unknown"));
  await page.evaluate(() => { window.mockMode = "ok"; });
  await frame.evaluate(() => { CMStudio.hosted.bridge.timeoutMs = 30_000; });
  checks.push("host refusal and unknown timeout retain edits without false success or automatic resend");

  const layouts = [];
  for (const [width, height] of [[1600, 1000], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await frame.locator("#generationTab").click();
    await frame.locator("#generationTab").press("ArrowRight");
    assert.equal(await frame.locator("#resourcesTab").getAttribute("aria-selected"), "true");
    await frame.locator("#resourcesTab").press("Home");
    const dimensions = await frame.evaluate(() => ({
      width: innerWidth, documentWidth: document.documentElement.scrollWidth, focused: document.activeElement.id,
      headerBottom: document.querySelector(".site-header").getBoundingClientRect().bottom,
      privacyTop: document.getElementById("hostPanel").getBoundingClientRect().top,
      privacyBottom: document.getElementById("hostPanel").getBoundingClientRect().bottom,
      mainTop: document.getElementById("main").getBoundingClientRect().top,
      saveTop: document.getElementById("saveBar").getBoundingClientRect().top
    }));
    assert.ok(dimensions.documentWidth <= dimensions.width + 1, `Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`);
    assert.equal(dimensions.focused, "generationTab");
    assert.ok(dimensions.privacyTop >= dimensions.headerBottom - 1, "Privacy panel overlaps the header");
    assert.ok(dimensions.mainTop >= dimensions.privacyBottom - 1, "Main viewport overlaps the privacy panel");
    assert.ok(dimensions.privacyBottom <= dimensions.saveTop, "Privacy panel overlaps the save controls");
    assert.ok(dimensions.saveTop - dimensions.mainTop >= Math.min(180, height * .3), "Too little usable editor space remains between privacy and save controls");
    layouts.push({ width, height, ...dimensions });
    await page.screenshot({ path: join(output, `layout-${width}.png`), fullPage: true });
    if (width === 320) {
      await frame.locator("#commandsButton").click();
      await frame.locator("#commandSearch").fill("Save edit handoff");
      assert.equal(await frame.locator("#commandList button").count(), 1);
      await frame.locator("#commandSearch").fill("Resume edits");
      assert.equal(await frame.locator("#commandList button").count(), 1);
      await frame.locator("#commandSearch").fill("Clear image queue");
      assert.equal(await frame.locator("#commandList button").count(), 1);
      await frame.locator("#commandSearch").press("Escape");
      await frame.locator("#commandDialog").waitFor({ state: "hidden" });
    }
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await frame.locator("#hostPrivacyDetails").evaluate((node) => { node.open = true; });
  assert.equal(await frame.locator("#standaloneUrl").inputValue(), "https://github.com/chriscollins500/civitai-metadata-studio");
  assert.equal(await frame.locator("#standaloneUrl").getAttribute("readonly"), "");
  await frame.locator("#hostPrivacyDetails").evaluate((node) => { node.open = false; });
  checks.push("keyboard tab navigation/focus and measured horizontal overflow at desktop, mobile, and 320px; selectable standalone destination");

  await frame.locator("#headerClearQueueButton").click();
  const canvasFiles = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 4; canvas.height = 3;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#38bda5"; ctx.fillRect(0, 0, 4, 3);
    return ["image/jpeg", "image/webp"].map((mimeType) => ({ mimeType, bytes: Array.from(atob(canvas.toDataURL(mimeType, .95).split(",")[1]), (character) => character.charCodeAt(0)) }));
  });
  const nativeJpeg = Buffer.from(canvasFiles[0].bytes), nativeWebp = Buffer.from(canvasFiles[1].bytes);
  const { concatBytes, putU32be, putU32le, putU24le, putU16be } = Studio.binary;
  const frameControl = (sequence) => concatBytes(putU32be(sequence), putU32be(3), putU32be(2), putU32be(0), putU32be(0), putU16be(1), putU16be(10), Uint8Array.of(0, 0));
  const apng = Buffer.from(concatBytes(original.subarray(0, 33),
    Studio.png.chunkBytes("acTL", concatBytes(putU32be(2), putU32be(0))),
    Studio.png.chunkBytes("fcTL", frameControl(0)),
    Studio.png.chunkBytes("IDAT", deflateSync(new Uint8Array(26))),
    Studio.png.chunkBytes("fcTL", frameControl(1)),
    Studio.png.chunkBytes("fdAT", concatBytes(putU32be(2), deflateSync(new Uint8Array(26)))),
    Studio.png.chunkBytes("IEND", new Uint8Array())));
  const webpPayload = (bytes) => {
    const parts = []; let offset = 12;
    while (offset < bytes.length) {
      const type = bytes.toString("ascii", offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
      if (["VP8 ", "VP8L", "ALPH", "ANIM", "ANMF"].includes(type)) parts.push(bytes.subarray(offset, offset + 8 + length + (length % 2)));
      offset += 8 + length + (length % 2);
    }
    return Buffer.concat(parts);
  };
  const animationFrame = concatBytes(putU24le(0), putU24le(0), putU24le(3), putU24le(2), putU24le(100), Uint8Array.of(2), webpPayload(nativeWebp));
  const animatedBody = concatBytes(
    Studio.webp.chunkBytes("VP8X", concatBytes(Uint8Array.of(2, 0, 0, 0), putU24le(3), putU24le(2))),
    Studio.webp.chunkBytes("ANIM", new Uint8Array(6)),
    Studio.webp.chunkBytes("ANMF", animationFrame), Studio.webp.chunkBytes("ANMF", animationFrame));
  const animatedWebp = Buffer.from(concatBytes(new TextEncoder().encode("RIFF"), putU32le(4 + animatedBody.length), new TextEncoder().encode("WEBP"), animatedBody));
  const formatFiles = [
    { name: "native.jpg", mimeType: "image/jpeg", buffer: nativeJpeg },
    { name: "native.webp", mimeType: "image/webp", buffer: nativeWebp },
    { name: "animated.png", mimeType: "image/png", buffer: apng },
    { name: "animated.webp", mimeType: "image/webp", buffer: animatedWebp }
  ];
  await frame.locator("#fileInput").setInputFiles(formatFiles);
  await frame.waitForFunction(() => CMStudio.state.entries.length === 4 && CMStudio.state.entries.every((entry) => entry.state === "ready"));
  assert.equal(await frame.evaluate(() => CMStudio.state.entries.filter((entry) => entry.record.inspection.animated).length), 2);
  for (const [index, width] of [[2, 3], [3, 4]]) {
    await frame.evaluate((value) => CMStudio.state.select(value), index);
    await frame.waitForFunction((value) => document.getElementById("previewImage").naturalWidth === value, width);
  }
  const preparedFormats = await frame.evaluate(async () => {
    const entries = [];
    for (const entry of CMStudio.state.entries) entries.push([CMStudio.util.outputName(entry.record.fileName, "_metadata"), Array.from(new Uint8Array(await CMStudio.canonical.rewrite(entry.record).arrayBuffer()))]);
    return entries;
  });
  const expectedFormats = new Map(preparedFormats.map(([name, bytes]) => [name, Buffer.from(bytes)]));
  await frame.locator("#saveButton").click(); await frame.locator("#hostSaveDialog").waitFor({ state: "visible" });
  const formatsDownload = page.waitForEvent("download"); await frame.locator("#confirmHostSave").click();
  const formatsResult = await formatsDownload; await formatsResult.saveAs(join(output, "formats.zip"));
  const formatZip = await readFile(join(output, "formats.zip"));
  let formatAt = 0, formatCount = 0;
  while (formatZip.readUInt32LE(formatAt) === 0x04034b50) {
    const length = formatZip.readUInt32LE(formatAt + 18), nameLength = formatZip.readUInt16LE(formatAt + 26), extra = formatZip.readUInt16LE(formatAt + 28);
    const name = formatZip.toString("utf8", formatAt + 30, formatAt + 30 + nameLength), start = formatAt + 30 + nameLength + extra;
    const data = formatZip.subarray(start, start + length);
    assert.deepEqual(data, expectedFormats.get(name)); assert.equal(crc32(data), formatZip.readUInt32LE(formatAt + 14));
    if (name === "animated_metadata.png") assert.deepEqual(pngPayloads(data), pngPayloads(apng));
    if (name === "animated_metadata.webp") assert.deepEqual(webpPayload(data), webpPayload(animatedWebp));
    if (name === "native_metadata.webp") assert.deepEqual(webpPayload(data), webpPayload(nativeWebp));
    if (name === "native_metadata.jpg") {
      const scan = (bytes) => {
        let offset = 2;
        while (offset < bytes.length) { const marker = bytes[offset + 1]; if (marker === 0xda) return bytes.subarray(offset); offset += 2 + bytes.readUInt16BE(offset + 2); }
        throw new Error("JPEG scan missing");
      };
      assert.deepEqual(scan(data), scan(nativeJpeg));
    }
    formatAt = start + length; formatCount++;
  }
  assert.equal(formatCount, 4);
  checks.push("real canvas JPEG/WebP and two-frame APNG/animated WebP exports: downloaded full bytes, CRCs, image scans, and animation payloads preserved");
  await frame.waitForFunction(() => CMStudio.state.busy === false);
  await frame.locator("#headerClearQueueButton").click();
  const bigPng = Buffer.from(await imageFixture("png", { width: 8192, height: 8192, name: "synthetic-8k.png" }).arrayBuffer());
  await frame.locator("#fileInput").setInputFiles({ name: "synthetic-8k.png", mimeType: "image/png", buffer: bigPng });
  await frame.waitForFunction(() => CMStudio.state.current?.dimensions.width === 8192 && CMStudio.state.currentEntry.state === "ready");
  assert.equal(await frame.evaluate(() => CMStudio.state.current.fields.width.value), 8192);
  await frame.waitForFunction(() => document.getElementById("previewImage").naturalWidth === 8192);
  await frame.evaluate(async () => { await CMStudio.civitai.clearCache(); });
  assert.equal((await frame.evaluate(async () => CMStudio.civitai.cacheStats())).records, 0);
  checks.push("actual 8192x8192 PNG decoded preview and true-pixel edit defaults; session cache clear under denied storage");

  assert.equal(requests.some((request) => /SYNTHETIC_PRIVATE|SYNTHETIC_EDIT|SYNTHETIC_TOKEN/.test(`${request.url}${request.body}`)), false);
  const messages = await page.evaluate(() => hostMessages);
  assert.ok(messages.every((message) => ["BLOCK_READY", "SAVE_IMAGE", "NAVIGATE"].includes(message.type)));
  assert.equal(messages.filter((message) => message.type === "BLOCK_READY").length, 1);
  checks.push("intercepted network bodies/URLs contain no private markers; outbound bridge uses only approved message families");
  const report = { channel, browserVersion: browser.version(), source: "built local HTML; intercepted synthetic host, no HTTP service or live Civitai access", checks, layouts, requestCount: requests.length, messageTypes: messages.map((message) => message.type), originalSha256: digest(original), preparedSha256: digest(expected), downloadedSha256: digest(saved), appBlockHtmlSha256: digest(Buffer.from(html)), standaloneHtmlSha256: digest(Buffer.from(standalone)) };
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`${channel} ${report.browserVersion}: ${checks.length} browser checks passed.`);
  console.log(`Evidence: ${output}`);
} catch (error) {
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => {});
  console.error(error.message);
  const frame = page.frames()[1];
  if (frame) console.error(await frame.evaluate(() => ({ notice: globalThis.CMStudio?.state?.notice, host: document.getElementById("hostConnection")?.textContent })).catch(() => "No frame diagnostics"));
  process.exitCode = 1;
} finally { await browser.close(); }
