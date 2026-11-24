import test from "node:test";
import assert from "node:assert/strict";
import { verifyStandaloneDestination } from "../scripts/verify-standalone-destination.mjs";

const approved = "https://github.com/chriscollins500/civitai-metadata-studio";
const different = approved + "-documentation";
const field = (url) => `<input id="standaloneUrl" type="url" readonly value="${url}">`;
const contract = (url) => `  standalone: "${url}"\n`;

test("bundle verifier accepts the approved displayed and copied standalone URLs", () => {
  assert.doesNotThrow(() => verifyStandaloneDestination(field(approved), contract(approved)));
});

test("bundle verifier rejects a different displayed URL even with an approved URL elsewhere", () => {
  assert.throws(() => verifyStandaloneDestination(field(different) + `<p>${approved}</p>`, contract(approved)),
    /displayed standalone URL/);
});

test("bundle verifier rejects a different or ambiguous clipboard destination", () => {
  assert.throws(() => verifyStandaloneDestination(field(approved), contract(different)), /copied standalone URL/);
  assert.throws(() => verifyStandaloneDestination(field(approved), contract(approved) + contract(different)),
    /copied standalone URL/);
});
