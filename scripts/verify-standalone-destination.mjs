import assert from "node:assert/strict";

const standaloneUrl = "https://github.com/chriscollins500/civitai-metadata-studio";

export function verifyStandaloneDestination(markup, script) {
  const fields = (markup.match(/<input(?=\s)[^<>]*>/gu) ?? [])
    .filter((input) => /\sid="standaloneUrl"(?=\s|\/?>)/u.test(input));
  assert.equal(fields.length, 1, "Expected exactly one standalone URL field.");
  const displayedUrl = fields[0].match(/\svalue="([^"]*)"/u)?.[1];
  assert.equal(displayedUrl, standaloneUrl, "The displayed standalone URL must match the approved repository.");

  const clipboardUrls = [...script.matchAll(/^[ \t]*standalone:[ \t]*"([^"\r\n]*)",?[ \t]*$/gmu)]
    .map(([, url]) => url);
  assert.deepEqual(clipboardUrls, [standaloneUrl], "The copied standalone URL must match the approved repository.");
}
