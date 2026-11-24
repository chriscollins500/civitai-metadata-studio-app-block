import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { root, appBlockDirectory } from "./output-paths.mjs";
import { buildDate, normalizeBuildText } from "./release-attestation.mjs";
import Studio from "../src/engine.mjs";

const manifestText = await readFile(join(root, "app-block/block.manifest.json"), "utf8");
const manifest = JSON.parse(manifestText);
const provenance = JSON.parse(await readFile(join(root, "app-block/protocol-provenance.json"), "utf8"));
const referenceText = await readFile(join(root, "app-block/reference-data.json"), "utf8");
if (createHash("sha256").update(referenceText).digest("hex") !== provenance.referenceSnapshot.sha256) throw new Error("Official reference snapshot checksum differs from its reviewed provenance.");
const referenceData = JSON.parse(referenceText);
const reference = {};
for (const key of ["ModelType", "ModelFileType", "BaseModel", "ActiveBaseModel", "BaseModelType"]) {
  const values = referenceData[key];
  if (!Array.isArray(values) || values.length > 2000 || values.some((value) => typeof value !== "string" || !value || value.length > 160)) throw new Error("Official reference snapshot shape/bounds changed.");
  reference[key] = [...new Set(values)];
}
reference.referenceSource = { kind: "bundled", date: provenance.referenceSnapshot.accessedOn, url: provenance.referenceSnapshot.sourceUrl };
// Public data, not executable source. Escape HTML parser sentinels even if a
// future untrusted API string contains a closing script tag.
const referenceScript = `globalThis.CMStudio.environment.referenceData = ${JSON.stringify(reference).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029")};`;
const engine = await readFile(join(root, "src/engine.mjs"), "utf8");
const sources = ["src/app-block/environment.js", ...[...engine.matchAll(/^import "\.\/(.+)";/gm)].map((match) => `src/${match[1]}`),
  "src/app-block/bridge.js", "src/app-block/exporter.js", "src/app/ui.js", "src/app-block/ui.js", "src/app/main.js"];
const read = async (path) => normalizeBuildText(await readFile(join(root, path), "utf8"));
const [template, css, hostedCss, fragment, license, ...modules] = await Promise.all([
  read("src/index.template.html"), read("src/styles.css"), read("src/app-block/styles.css"), read("src/app-block/ui.fragment.html"), read("LICENSE"), ...sources.map(read)
]);
const script = `/* Civitai Metadata Studio App Block ${manifest.version} · ${buildDate(process.env.SOURCE_DATE_EPOCH)} · shared engine ${Studio.constants.APP_VERSION} */\n${modules[0]}\n${referenceScript}\n${modules.slice(1).join("\n\n")}\n`;
const scriptHash = createHash("sha256").update(script).digest("base64");
const html = template.replace("%%LICENSE%%", license.trim()).replace("%%SCRIPT_HASH%%", scriptHash)
  .replace("%%STYLES%%", `${css}\n${hostedCss}`).replace("%%SCRIPT%%", () => script)
  .replace("</header>", `</header>\n${fragment}`);
const allowlist = ["index.html", "block.manifest.json", "LICENSE", "SHA256SUMS.txt"];
await mkdir(appBlockDirectory, { recursive: true });
for (const entry of await readdir(appBlockDirectory)) if (!allowlist.includes(entry)) throw new Error(`Unexpected file in the bundle directory: ${entry}`);
const files = new Map([["index.html", html], ["block.manifest.json", normalizeBuildText(manifestText)], ["LICENSE", license]]);
files.set("SHA256SUMS.txt", [...files].map(([name, content]) => `${createHash("sha256").update(content).digest("hex")}  ${name}\n`).join(""));
for (const [name, content] of files) await writeFile(join(appBlockDirectory, name), content, "utf8");
const entries = [...files].map(([name, content]) => ({ name, blob: new Blob([content]), date: new Date(1980, 0, 1, 0, 0, 0) }));
const zip = await Studio.zip.build(entries);
const zipPath = join(root, `build/civitai-metadata-studio-app-block-${manifest.version}.zip`);
await writeFile(zipPath, Buffer.from(await zip.arrayBuffer()));
console.log(`Built local App Block ${manifest.version}: ${appBlockDirectory}`);
console.log(`Allowlisted archive: ${zipPath}`);
console.log(`ZIP SHA256 ${createHash("sha256").update(Buffer.from(await zip.arrayBuffer())).digest("hex")}`);
