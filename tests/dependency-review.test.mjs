import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewDependencies } from "../scripts/review-dependencies.mjs";

const commits = { base: "a".repeat(40), head: "b".repeat(40) };
const advisory = { severity: "moderate", advisory_ghsa_id: "GHSA-aaaa-bbbb-cccc" };
const change = (changeType, advisories = []) => ({ change_type: changeType, vulnerabilities: advisories });

test("dependency review accepts clean additions and removals of known vulnerable dependencies", async () => {
  const additions = await reviewDependencies(commits, async () => Response.json([
    change("added"), change("removed", [advisory]), change("added", [{ ...advisory, severity: "low" }])
  ]));
  assert.equal(additions, 2);
});

test("dependency review reads every page from the same exact GitHub comparison", async () => {
  const pages = [];
  await assert.rejects(reviewDependencies({ ...commits, token: "test-token" }, async (target, options) => {
    const url = new URL(target);
    assert.equal(url.origin, "https://api.github.com");
    assert.equal(url.pathname, "/repos/chriscollins500/civitai-metadata-studio-app-block/dependency-graph/compare/" + commits.base + "..." + commits.head);
    assert.equal(options.headers.authorization, "Bearer test-token");
    assert.equal(options.redirect, "manual");
    const page = url.searchParams.get("page");
    pages.push(page);
    if (page === "1") return Response.json([change("added")], {
      headers: { link: '<https://example.invalid/skip-the-advisory>; rel="next"' }
    });
    return Response.json([change("added", [advisory])]);
  }), /moderate-or-higher GitHub advisories\.\nhttps:\/\/github\.com\/advisories\/GHSA-aaaa-bbbb-cccc/u);
  assert.deepEqual(pages, ["1", "2"]);
});

test("dependency review requires complete, bounded results for valid commit IDs", async () => {
  await assert.rejects(reviewDependencies({ ...commits, head: "../../" }, async () => {
    assert.fail("Reject the head before requesting the graph.");
  }), /exact base and head/u);
  await assert.rejects(reviewDependencies(commits, async () => Response.json([], {
    headers: { "x-github-dependency-graph-snapshot-warnings": "U25hcHNob3QgcGVuZGluZw==" }
  })), /incomplete dependency snapshots/u);
  await assert.rejects(reviewDependencies(commits, async () => Response.json([{ change_type: "added" }])),
    /did not include advisory data/u);
  await assert.rejects(reviewDependencies(commits, async () => Response.redirect("https://example.invalid/")),
    /returned HTTP 302/u);

  let requests = 0;
  await assert.rejects(reviewDependencies(commits, async (url) => {
    requests += 1;
    return Response.json([], { headers: { link: "<" + url + '>; rel="next"' } });
  }), /exceeded 10 pages/u);
  assert.equal(requests, 10);
});
