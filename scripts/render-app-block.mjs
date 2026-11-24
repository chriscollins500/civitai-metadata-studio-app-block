import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Studio from "../src/engine.mjs";
import { root } from "./output-paths.mjs";
import { buildDate, normalizeBuildText } from "./release-attestation.mjs";

export async function renderAppBlock(version, epoch) {
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
  const script = `/* Civitai Metadata Studio App Block ${version} · ${buildDate(epoch)} · shared engine ${Studio.constants.APP_VERSION} */\n${modules[0]}\n${referenceScript}\n${modules.slice(1).join("\n\n")}\n`;
  const scriptHash = createHash("sha256").update(script).digest("base64");
  const html = template.replace("%%LICENSE%%", license.trim()).replace("%%SCRIPT_HASH%%", scriptHash)
    .replace("%%STYLES%%", `${css}\n${hostedCss}`).replace("%%SCRIPT%%", () => script)
    .replace("</header>", `</header>\n${fragment}`);
  return { html, license };
}
