import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { readResponseBytes } from "./public-bytes.mjs";

const comparison = "https://api.github.com/repos/chriscollins500/civitai-metadata-studio-app-block/dependency-graph/compare/";
const commit = /^[a-f0-9]{40}$/u;
const severity = ["low", "moderate", "high", "critical"];
const advisoryId = /^GHSA-(?:[0-9a-z]{4}-){2}[0-9a-z]{4}$/u;
const pageLimit = 10;

export async function reviewDependencies({ base, head, token }, request = fetch) {
  assert.ok(commit.test(base) && commit.test(head), "Dependency review requires the exact base and head commit SHAs.");
  const endpoint = comparison + base + "..." + head;
  const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2026-03-10", "user-agent": "metadata-studio-dependency-review" };
  if (token) headers.authorization = "Bearer " + token;
  const blocked = new Set();
  let additions = 0;

  for (let page = 1; page <= pageLimit; page += 1) {
    const url = endpoint + "?per_page=100&page=" + page;
    const response = await request(url, {
      headers, redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(15_000)
    });
    const changes = JSON.parse(await readResponseBytes(url, response, 256 * 1024, "application/json"));
    assert.ok(!response.headers.get("x-github-dependency-graph-snapshot-warnings")?.trim(),
      "GitHub reported incomplete dependency snapshots. Rerun after the graph finishes indexing both commits.");
    assert.ok(Array.isArray(changes), "GitHub dependency changes must be an array.");
    for (const change of changes) {
      assert.ok(["added", "removed"].includes(change?.change_type), "GitHub returned an invalid dependency change.");
      if (change.change_type === "removed") continue;
      additions += 1;
      assert.ok(Array.isArray(change.vulnerabilities), "GitHub did not include advisory data for an added dependency.");
      for (const advisory of change.vulnerabilities) {
        assert.ok(severity.includes(advisory?.severity) && advisoryId.test(advisory.advisory_ghsa_id),
          "GitHub returned an invalid dependency advisory.");
        if (advisory.severity !== "low") blocked.add(advisory.advisory_ghsa_id);
      }
    }
    if (!/<[^>]+>\s*;\s*rel="next"/iu.test(response.headers.get("link") ?? "")) {
      if (blocked.size) {
        const examples = [...blocked].slice(0, 10).map((id) => "https://github.com/advisories/" + id);
        throw new Error("Added dependencies have " + blocked.size + " moderate-or-higher GitHub advisories.\n" + examples.join("\n"));
      }
      return additions;
    }
  }
  throw new Error("GitHub dependency changes exceeded " + pageLimit + " pages. Split the dependency update and rerun.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const additions = await reviewDependencies({
    base: process.env.BASE_SHA, head: process.env.HEAD_SHA, token: process.env.GH_TOKEN
  });
  console.log("GitHub reviewed " + additions + " added dependencies. No moderate-or-higher advisories.");
}
