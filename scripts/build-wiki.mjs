import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { links, repo, website, wiki } from "../website/layout.mjs";
import { root } from "./output-paths.mjs";

const guides = [
  ["Getting-Started", "Getting started", "Open the App Block and make your first edit."],
  ["Privacy-and-Exports", "Privacy and exports", "Understand the save boundary and size limits."],
  ["Troubleshooting", "Troubleshooting", "Recover from missing settings, uncertain matches, or a missing download."],
  ["Architecture", "Architecture", "Follow the shared metadata engine and Civitai bridge."],
  ["Build-and-Verify", "Build and verify", "Run tests and reproduce the packaged App Block."],
  ["Release-Provenance", "Release provenance", "Check the exact release artifacts and signed attestation."],
  ["Maintainer-Guide", "Maintainer guide", "Maintain the app, project website, and wiki."],
];
const sourcePath = repo + "/blob/main/";
const guideRoutes = new Map(guides.map(([slug]) => ["docs/" + slug + ".md", wiki + "/" + slug]));
const output = join(root, "build", "wiki");
const markdownLink = (label, url) => "[" + label + "](" + url + ")";
const homeLink = markdownLink("Project website", website);
const getStarted = markdownLink("First-time guide", website + "guide/#launch");
const support = markdownLink("Support guide", sourcePath + "SUPPORT.md");
const guideList = guides.map(([slug, title]) => "- " + markdownLink(title, wiki + "/" + slug));
const files = new Map([
  ["Home.md", [
    "# Civitai Metadata Studio App Block", "",
    "Read and correct the generation settings inside an AI image. Save a copy with the same encoded pixels and verify the source behind the hosted version.", "",
    homeLink + " · " + getStarted + " · " + markdownLink("Download the example PNG", website + "assets/aurora-observatory.png"), "",
    "## Use the app", "",
    "On your first visit, sign in to Civitai, choose **Apps → Browse the store**, find **Civitai Metadata Studio**, and choose **Open**. To return, use **My apps** in the same browser.", "",
    markdownLink("Civitai.com homepage", links.civitaiCom) + " · " + markdownLink("Civitai.red homepage", links.civitaiRed), "",
    "## Guides", "",
    ...guides.map(([, , description], index) => guideList[index] + " — " + description), "",
    "## Ask a question or check a release", "",
    markdownLink("Discussions", links.discussions) + " · " + support + " · " + markdownLink("Signed releases", links.releases) + " · " + markdownLink("Standalone downloads", links.download), "",
    "The wiki mirrors the " + markdownLink("versioned guides", repo + "/tree/main/docs") + ".", "",
  ].join("\n")],
  ["_Sidebar.md", [
    "### App Block wiki", "",
    "- " + markdownLink("Wiki home", wiki),
    ...guideList, "",
    "### Project and support", "",
    "- " + homeLink,
    "- " + getStarted,
    "- " + support,
    "- " + markdownLink("App Block releases", links.releases),
    "- " + markdownLink("Standalone downloads", links.download), "",
  ].join("\n")],
  ["_Footer.md", [
    homeLink, markdownLink("Source", repo), markdownLink("Discussion", links.discussions),
    markdownLink("Report an issue", links.issues), markdownLink("Security policy", links.security),
  ].join(" · ") + "\n"],
]);

function wikiLinks(content) {
  return content.split(/^```/mu).map((section, i) => {
    if (i % 2) return section;
    return section.replace(/(\[[^\]\n]+\]\()([^) \t\n]+)(\))/gu, (link, start, destination, end) => {
      if (destination.startsWith("https://") || destination.startsWith("#")) return link;
      const [relativePath, fragment] = destination.split("#", 2);
      const path = posix.normalize(posix.join("docs", decodeURIComponent(relativePath)));
      assert.ok(!path.startsWith("../") && !posix.isAbsolute(path), "Wiki source link escapes the repository: " + destination);
      const absolute = guideRoutes.get(path) ?? sourcePath + path.split("/").map(encodeURIComponent).join("/");
      return start + absolute + (fragment === undefined ? "" : "#" + fragment) + end;
    });
  }).join("```");
}

for (const [slug] of guides) {
  const filename = slug + ".md";
  const source = await readFile(join(root, "docs", filename), "utf8");
  const page = wikiLinks(source).replace(/\r\n/gu, "\n");
  const attribution = "\n\n" + markdownLink("Versioned guide", sourcePath + "docs/" + filename) + " · " + homeLink;
  files.set(filename, page.replace(/^# [^\n]+/u, (title) => title + attribution));
}

await mkdir(output, { recursive: true });
for (const [name, content] of files) {
  await writeFile(join(output, name), content);
}
console.log("Built " + guides.length + " Wiki guides with shared home, sidebar, and footer.");
