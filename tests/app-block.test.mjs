import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { crc32 } from "node:zlib";
import { Studio, imageFixture, recordFixture } from "./fixtures.mjs";

const sources = Object.fromEntries(await Promise.all(["environment", "bridge", "exporter"].map(async (name) => [name, await readFile(new URL(`../src/app-block/${name}.js`, import.meta.url), "utf8")])));
function runtime() {
  const context = vm.createContext({ CMStudio: { util: Studio.util, zip: Studio.zip }, Blob, ArrayBuffer, TextEncoder, URL, AbortController, DOMException, performance, setTimeout, clearTimeout });
  for (const source of Object.values(sources)) vm.runInContext(source, context);
  return context.CMStudio;
}
function host(options) {
  const sent = [];
  const parent = { postMessage(message, origin) { sent.push({ message, origin }); } };
  const win = { parent, crypto: { randomUUID }, innerHeight: 900, addEventListener() {}, removeEventListener() {} };
  const R = runtime();
  const bridge = new R.AppBlockBridge(win, options);
  const receive = (type, payload, origin = "https://civitai.red", source = parent) => bridge.receive({ origin, source, data: { type, payload } });
  const init = { blockInstanceId: "instance-1", theme: "dark", renderMode: "iframe", context: { slotId: "app.page" }, token: { raw: "PRIVATE-TOKEN" }, viewer: { username: "PRIVATE-VIEWER" } };
  return { R, sent, parent, bridge, receive, init };
}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("host bridge rejects sibling windows, opaque and lookalike origins, and wrong surfaces", () => {
  const H = host();
  for (const origin of ["null", "https://civitai.red.evil.test", "http://civitai.red", "https://sub.civitai.red"]) H.receive("BLOCK_INIT", H.init, origin);
  H.receive("BLOCK_INIT", H.init, undefined, {});
  H.receive("BLOCK_INIT", { ...H.init, context: { slotId: "page" } });
  assert.equal(H.sent.length, 0);
  assert.equal(H.bridge.connected, false);
  H.bridge.dispose();
});

test("one validated init pins the origin; no token or viewer is retained or sent", () => {
  const themes = [];
  const H = host({ onTheme: (theme) => themes.push(theme) });
  H.receive("BLOCK_INIT", H.init);
  H.receive("BLOCK_INIT", { ...H.init, blockInstanceId: "another" }, "https://civitai.com");
  H.receive("THEME_CHANGE", { theme: "light" }, "https://civitai.com");
  H.receive("THEME_CHANGE", { theme: "light" });
  assert.deepEqual(themes, ["dark", "light"]);
  assert.equal(H.sent.length, 1);
  assert.equal(H.sent[0].message.type, "BLOCK_READY");
  assert.equal(H.sent[0].origin, "https://civitai.red");
  assert.doesNotMatch(JSON.stringify(H.sent), /PRIVATE/);
  assert.equal(H.bridge.token, undefined);
  assert.equal(H.bridge.viewer, undefined);
  H.bridge.dispose();
});

test("bytes saves await the correlated positive reply and reject any error field", async () => {
  const H = host(); H.receive("BLOCK_INIT", H.init);
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  let settled = false;
  const pending = H.bridge.save(bytes, "image.png").then(() => { settled = true; });
  const request = H.sent.at(-1).message;
  assert.deepEqual(Object.keys(request.payload).sort(), ["bytes", "filename", "requestId"]);
  assert.equal(request.payload.bytes, bytes);
  H.receive("SAVE_IMAGE_RESULT", { requestId: "wrong", ok: true });
  H.receive("SAVE_IMAGE_RESULT", { requestId: request.payload.requestId, ok: "yes" });
  await Promise.resolve(); assert.equal(settled, false);
  H.receive("SAVE_IMAGE_RESULT", { requestId: request.payload.requestId, ok: true }); await pending;
  const refused = H.bridge.save(bytes, "image.png");
  H.receive("SAVE_IMAGE_RESULT", { requestId: H.sent.at(-1).message.payload.requestId, ok: true, error: "" });
  await assert.rejects(refused, /refused/);
  H.bridge.dispose();
});

test("timeouts and suspension end pending saves without resending or private diagnostics", async () => {
  const H = host({ timeoutMs: 10 }); H.receive("BLOCK_INIT", H.init);
  await assert.rejects(H.bridge.save(new ArrayBuffer(1), "one.png"), /outcome is unknown/);
  const pending = H.bridge.save(new ArrayBuffer(1), "two.png");
  H.receive("SUSPEND"); await assert.rejects(pending, /suspended/);
  assert.deepEqual(H.sent.map((entry) => entry.message.type), ["BLOCK_READY", "SAVE_IMAGE", "SAVE_IMAGE"]);
  H.bridge.dispose();
});

test("exact resource navigation stays on the trusted parent host and refuses arbitrary links", () => {
  const H = host(); H.receive("BLOCK_INIT", H.init);
  H.bridge.navigate("https://civitai.com/models/123?modelVersionId=456");
  assert.equal(H.sent.at(-1).origin, "https://civitai.red");
  assert.equal(H.sent.at(-1).message.payload.path, "/models/123?modelVersionId=456");
  for (const url of ["javascript:alert(1)", "https://github.com/owner/repo", "https://civitai.red/models/0", "https://civitai.red/models/123?prompt=PRIVATE", "https://civitai.red/models/123?modelVersionId=1&modelVersionId=2"]) assert.throws(() => H.bridge.navigate(url));
  H.bridge.dispose();
});

test("bytes preflight refuses oversized ordinary output before posting", async () => {
  const H = host(); H.receive("BLOCK_INIT", H.init);
  await assert.rejects(H.bridge.save(new ArrayBuffer(H.R.appBlockContract.ordinaryBytes + 1), "too-big.png"), /limit/);
  assert.equal(H.sent.length, 1);
  H.bridge.dispose();
});

test("lossless plan counts exact ZIP overhead, partitions whole files, and refuses before partial export", () => {
  const E = runtime().appBlockExports;
  const input = (name, size) => ({ name, blob: new Blob([new Uint8Array(size)]) });
  assert.equal(E.planExports([input("a.png", 50)], { ordinaryBytes: 50 })[0].kind, "file");
  assert.equal(E.planExports([input("a.png", 51)], { ordinaryBytes: 50 })[0].kind, "zip");
  const part = input("a.png", 50);
  assert.equal(E.zipSize([part]), 22 + 76 + 10 + 50);
  const plan = E.planExports([part, input("b.png", 50)], { zipBytes: E.zipSize([part]) });
  assert.equal(plan.length, 2);
  assert.ok(plan.every((entry) => entry.entries.length === 1));
  assert.throws(() => E.planExports([part, input("huge.png", 500)], { zipBytes: 300 }), /no files were sent/);
});

test("archive names are basename-only, normalized, unique after truncation, and Windows-safe", () => {
  const E = runtime().appBlockExports;
  const names = ["../CON.png", "x\\cafe\u0301.png", "café.png", "A".repeat(250) + ".png", "A".repeat(250) + ".png", "evil\u202e.png", "CON.notes.png", "bad\ud800.png", "bad\ud801.png"];
  const plan = E.planExports(names.map((name) => ({ name, blob: new Blob(["image"]) })));
  const actual = plan[0].entries.map((entry) => entry.name);
  assert.equal(new Set(actual.map((name) => name.normalize("NFC").toLowerCase())).size, names.length);
  for (const name of actual) { assert.doesNotMatch(name, /[/\\\u202e]/u); assert.ok(new TextEncoder().encode(name).length <= 220); assert.equal(name.isWellFormed(), true); }
  assert.equal(actual[0], "_CON.png");
  assert.equal(actual[6], "_CON.notes.png");
});

test("shared rolling budgets include ZIP history and count limits", () => {
  const R = runtime(), E = R.appBlockExports, C = R.appBlockContract;
  assert.equal(C.ordinaryBytes, 52_428_800); assert.equal(C.zipBytes, 268_435_456);
  assert.equal(E.budgetDelay([{ at: 0, size: C.zipBytes }], 1, false, 5), 10_005);
  assert.equal(E.budgetDelay(Array.from({ length: 5 }, () => ({ at: 0, size: 1 })), 1, false, 5), 10_005);
  assert.equal(E.budgetDelay([{ at: 0, size: C.zipBytes }], 1, false, 10_001), 0);
});

test("explicit packaging passes exact image bytes inside a standard stored ZIP", async () => {
  const R = runtime(), sent = [];
  const original = await imageFixture("png").arrayBuffer();
  const exporter = R.appBlockExports.createExporter({ bridge: { connected: true, async save(bytes, name) { sent.push({ bytes, name }); } }, confirm: async () => true });
  await exporter.exportFiles([{ name: "first.png", blob: new Blob([original]) }, { name: "second.png", blob: new Blob([original]) }]);
  const zip = Buffer.from(sent[0].bytes);
  let offset = 0, entries = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 0);
    const length = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26), extraLength = zip.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const bytes = zip.subarray(start, start + length);
    assert.equal(hash(bytes), hash(Buffer.from(original)));
    assert.equal(zip.readUInt32LE(offset + 14), crc32(bytes));
    offset = start + length; entries++;
  }
  assert.equal(entries, 2); assert.equal(sent[0].name.endsWith(".zip"), true);
});

test("cancelled acknowledgement sends no bytes and a refusal ends the batch", async () => {
  const R = runtime(), sent = [];
  const exporter = R.appBlockExports.createExporter({ bridge: { connected: true, async save(...args) { sent.push(args); } }, confirm: async () => false });
  await assert.rejects(exporter.exportFiles([{ name: "one.png", blob: new Blob(["image"]) }]), /cancelled/);
  assert.equal(sent.length, 0); assert.equal(exporter.active, false);
});

test("forced session cache never touches denied storage and evicts byte-bounded groups including hot entries", async () => {
  let touched = 0;
  const context = vm.createContext({ CMStudio: { environment: { cacheMode: "memory" } }, TextEncoder, structuredClone });
  for (const key of ["localStorage", "indexedDB"]) Object.defineProperty(context, key, { get() { touched++; throw new DOMException("denied", "SecurityError"); } });
  vm.runInContext(await readFile(new URL("../src/core/identity-cache.js", import.meta.url), "utf8"), context);
  const cache = context.CMStudio.identityCache;
  for (let id = 0; id < 8; id++) await cache.set(`version:${id}`, { id, name: "X".repeat(3 * 1024 * 1024) }, { groupId: `version:${id}` });
  const stats = await cache.stats();
  assert.equal(stats.backend, "memory"); assert.ok(stats.bytes <= stats.limits.bytes);
  assert.equal((await cache.get("version:0")).hit, false);
  assert.equal((await cache.get("version:7")).hit, true);
  await cache.clear(); assert.equal((await cache.get("version:7")).hit, false);
  assert.equal((await cache.stats()).records, 0); assert.equal(touched, 0);
});

test("shared state does not announce success before hosted completion and retains edits on failure", async () => {
  const state = new Studio.AppState(); state.autoVerify = false;
  await state.addFiles([imageFixture()]); state.updateField("positivePrompt", "PRIVATE LOCAL EDIT");
  let reject;
  Studio.environment = { exportFiles: () => new Promise((_, no) => { reject = no; }) };
  try {
    const saving = state.save("_edited");
    while (!reject) await new Promise((done) => setTimeout(done, 1));
    assert.equal(state.busy, true); assert.notEqual(state.notice?.tone, "success");
    reject(new Error("refused")); await assert.rejects(saving, /refused/);
    assert.equal(state.current.fields.positivePrompt.value, "PRIVATE LOCAL EDIT"); assert.equal(state.busy, false);
  } finally { delete Studio.environment; }
});

test("hash-bound edit handoff recovers fields and selections, invalidates proof, and rejects a different original atomically", async () => {
  const original = await recordFixture();
  Studio.canonical.setField(original, "positivePrompt", "Recovered edit");
  const handoff = await Studio.editSession.create([original]);
  const target = await recordFixture();
  const updates = await Studio.editSession.prepare(handoff, [target]);
  assert.equal(updates[0].edits.fields.positivePrompt.value, "Recovered edit");
  assert.deepEqual(updates[0].edits.metadataSelections, original.metadataSelections);
  assert.equal(target.fields.positivePrompt.value, "A quiet observatory above the clouds");
  const wrong = await recordFixture({ prompt: "A different original" });
  await assert.rejects(Studio.editSession.prepare(handoff, [wrong]), /exact original/);
  assert.equal(wrong.fields.positivePrompt.value, "A different original");
  const poison = new Blob(['{"schema":"civitai-metadata-studio.edit-session","schemaVersion":1,"images":[],"__proto__":{}}']);
  await assert.rejects(Studio.editSession.prepare(poison, [target]), /unsafe key/);
});

test("ZIP overhead boundaries include the final byte and never split a file", () => {
  const E = runtime().appBlockExports;
  const entry = { name: "one.json", blob: new Blob(["{}".repeat(30)]) };
  const exact = E.zipSize([entry]);
  assert.equal(E.planExports([entry], { ordinaryBytes: 1, zipBytes: exact })[0].size, exact);
  assert.throws(() => E.planExports([entry], { ordinaryBytes: 1, zipBytes: exact - 1 }), /cannot fit/);
  assert.equal(E.planExports([entry], { ordinaryBytes: 1, zipBytes: exact + 1 })[0].size, exact);
});

test("an approved multi-ZIP batch stops after a partial refusal and reports confirmed downloads", async () => {
  const R = runtime(); let sends = 0;
  const exporter = R.appBlockExports.createExporter({
    bridge: { connected: true, async save() { if (++sends === 2) throw new Error("busy"); } }, confirm: async ({ plan }) => { assert.equal(plan.length, 2); return true; }
  });
  const blob = new Blob(["{}"]);
  const entries = Array.from({ length: 10_001 }, (_, index) => ({ name: `row-${index}.json`, blob }));
  await assert.rejects(exporter.exportFiles(entries), /1 download started.*all edits are retained/);
  assert.equal(sends, 2); assert.equal(exporter.active, false);
});

test("the download-count budget can be cancelled before the next file is sent", async () => {
  const R = runtime(); let sends = 0, waits = 0;
  const exporter = R.appBlockExports.createExporter({
    bridge: { connected: true, async save() { sends++; } }, confirm: async () => true, now: () => 0,
    wait: async (delay, signal) => { waits++; assert.ok(delay >= 10_000); exporter.cancel(); assert.equal(signal.aborted, true); throw new DOMException("stopped", "AbortError"); }
  });
  const outputs = [{ name: "one.json", blob: new Blob(["{}"]) }];
  for (let index = 0; index < 5; index++) await exporter.exportFiles(outputs);
  await assert.rejects(exporter.exportFiles(outputs), /stopped/);
  assert.equal(sends, 5); assert.equal(waits, 1);
});

test("generated malformed host replies cannot settle a pending save", async () => {
  const H = host(); H.receive("BLOCK_INIT", H.init);
  const pending = H.bridge.save(new ArrayBuffer(1), "one.png");
  const requestId = H.sent.at(-1).message.payload.requestId;
  const malformed = [null, [], {}, 0, "true", 1, "", [true]];
  for (let index = 0; index < 256; index++) {
    H.receive("SAVE_IMAGE_RESULT", { requestId, ok: malformed[index % malformed.length] });
    H.receive("SAVE_IMAGE_RESULT", { requestId, ok: true }, "https://civitai.red.evil.test");
  }
  assert.equal(H.bridge.pending.size, 1);
  H.receive("SAVE_IMAGE_RESULT", { requestId, ok: true }); await pending;
  H.receive("SAVE_IMAGE_RESULT", { requestId, ok: false, error: "late" });
  assert.equal(H.sent.length, 2); H.bridge.dispose();
});

test("hosted exports require an integrity proof even if a caller disables the standalone preference", async () => {
  const state = new Studio.AppState(); state.autoVerify = false;
  await state.addFiles([imageFixture()]); state.verifyExports = false;
  const prior = Studio.integrity; let sent = false;
  Studio.environment = { kind: "app-block", exportFiles: async () => { sent = true; } };
  Studio.integrity = { ...prior, verifyExport: async () => { throw new Error("synthetic proof failed"); } };
  try { await assert.rejects(state.save("_edited"), /proof failed/); assert.equal(sent, false); assert.equal(state.busy, false); }
  finally { Studio.integrity = prior; delete Studio.environment; }
});

test("edit handoffs retain exact resource claims while discarding imported verification authority", async () => {
  const options = { resources: [{ name: "Claimed LoRA", role: "lora", modelVersionId: 123, hashes: { SHA256: "A".repeat(64) }, weight: .7 }] };
  const source = await recordFixture(options);
  source.resources[0].verification = "verified";
  source.resources[0].verificationEvidence = { matchedBy: "SHA256", hash: "A".repeat(64) };
  source.resources[0].parserFacing = true;
  const target = await recordFixture(options);
  const file = await Studio.editSession.create([source]);
  const [update] = await Studio.editSession.prepare(file, [target]);
  assert.equal(update.edits.resources[0].modelVersionId, 123);
  assert.equal(update.edits.resources[0].hashes.SHA256, "A".repeat(64));
  assert.equal(update.edits.resources[0].verification, "unresolved");
  assert.equal(update.edits.resources[0].verificationEvidence, undefined);
  assert.equal(update.edits.resources[0].parserFacing, false);
  const bad = JSON.parse(await file.text()); bad.images[0].edits.fields.width.value = { toString: "malicious" };
  await assert.rejects(Studio.editSession.prepare(new Blob([JSON.stringify(bad)]), [target]), /invalid generation field/);
  assert.equal(target.fields.width.value, 3);
});
