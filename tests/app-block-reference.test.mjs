import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Studio from "../src/engine.mjs";

test("hosted reference lists use the dated public snapshot without network; standalone retains live lookup", async (t) => {
  const originalFetch = globalThis.fetch, previousEnvironment = Studio.environment;
  t.after(() => { globalThis.fetch = originalFetch; if (previousEnvironment === undefined) delete Studio.environment; else Studio.environment = previousEnvironment; });
  const snapshot = JSON.parse(await readFile(new URL("../app-block/reference-data.json", import.meta.url), "utf8"));
  const provenance = JSON.parse(await readFile(new URL("../app-block/protocol-provenance.json", import.meta.url), "utf8"));
  const source = { kind: "bundled", date: provenance.referenceSnapshot.accessedOn, url: provenance.referenceSnapshot.sourceUrl };
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Synthetic unavailable CORS endpoint"); };
  Studio.environment = { kind: "app-block", referenceData: { ...snapshot, referenceSource: source } };
  const first = await Studio.civitai.referenceData();
  assert.deepEqual(first.referenceSource, source);
  assert.equal(first.BaseModel.length, snapshot.BaseModel.length);
  first.BaseModel.length = 0; first.referenceSource.date = "tampered";
  const second = await Studio.civitai.referenceData();
  assert.deepEqual(second.BaseModel, snapshot.BaseModel); assert.deepEqual(second.referenceSource, source);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(Studio.civitai.referenceData({ signal: cancelled.signal }), { name: "AbortError" });
  assert.equal(calls, 0);
  delete Studio.environment;
  globalThis.fetch = async (url) => { calls++; assert.equal(url, "https://civitai.com/api/v1/enums"); return new Response(JSON.stringify({ ModelType: ["Checkpoint"], BaseModel: ["LIVE_TEST_FAMILY"] })); };
  const live = await Studio.civitai.referenceData();
  assert.deepEqual(live.BaseModel, ["LIVE_TEST_FAMILY"]); assert.equal(live.referenceSource, undefined); assert.equal(calls, 1);
});
