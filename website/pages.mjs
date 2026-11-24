import { anchor, at, doc, html, links, repo, standalone, wiki } from "./layout.mjs";

const samplePath = at("assets/aurora-observatory.png");
const sampleDownload = `<a class="text-link" href="${samplePath}" download>Download the example PNG</a>`;
const sampleAlt = "A copper-domed observatory above mountain clouds under a green aurora";
const waitList = [
  ["The prompt field is empty", "Try the original file from your generator. Screenshots, messaging apps, and format conversions can strip embedded generation settings."],
  ["Two resources look like a match", "Check Resources and Review for exact evidence. A model name or filename can point to several versions."],
  ["Verification pauses", "Wait for the displayed cooldown to end. A later manual lookup can use any exact evidence already in the image."],
  ["The download didn’t show up", "Check your browser’s download history and destination folder. Keep the editor open while checking so your edits stay available."],
  ["An 8K image saves but a smaller image needs ZIP", "Civitai measures the finished file in bytes. Resolution and compressed file size measure different things."],
];

function heading(title, description) {
  return `<section class="frame page-intro"><h1>${title}</h1><p>${description}</p></section>`;
}

function pathCard(href, title, description) {
  return `<a class="path-card" href="${html(href)}"><strong>${html(title)}</strong><span>${html(description)}</span></a>`;
}

function example(sample) {
  return `
    <figure class="specimen" id="example">
      <figcaption class="filebar"><strong>aurora-observatory.png</strong><span>PNG · ${sample.width} × ${sample.height}</span></figcaption>
      <img class="specimen-image" src="${at("assets/aurora-observatory.webp")}" width="960" height="640" alt="${sampleAlt}" fetchpriority="high">
      <fieldset class="sample-reader">
        <legend class="visually-hidden">Explore example metadata</legend>
        <input id="example-prompt" type="radio" name="example-metadata" checked>
        <input id="example-settings" type="radio" name="example-metadata">
        <input id="example-resource" type="radio" name="example-metadata">
        <div class="sample-controls">
          <label for="example-prompt">Prompt</label>
          <label for="example-settings">Settings</label>
          <label for="example-resource">Resources</label>
        </div>
        <div class="sample-panel prompt-panel">
          <dl class="sample-prompt">
            <div><dt>Prompt</dt><dd>${html(sample.prompt)}</dd></div>
            <div><dt>Negative prompt</dt><dd>${html(sample.negativePrompt)}</dd></div>
          </dl>
        </div>
        <div class="sample-panel settings-panel">
          <dl class="sample-settings">${sample.settings.map(([label, value]) => `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`).join("")}</dl>
        </div>
        <div class="sample-panel resource-panel">
          <p><strong>No exact resource ID in this PNG.</strong></p>
          <p>Studio verifies models from evidence such as a hash or version ID. It marks unknown versions for review.</p>
        </div>
      </fieldset>
      <div class="specimen-footer"><span>Illustrative settings embedded in the file.</span>${sampleDownload}</div>
    </figure>`;
}

function home({ sample, hosted }) {
  return `
    <section class="frame hero">
      <div class="hero-copy">
        <h1>Read the recipe <em>inside your render.</em></h1>
        <p>Find the prompt, seed, model details, and sometimes the original ComfyUI workflow. Fix what needs fixing and save a new copy with the same encoded pixels.</p>
        <div class="actions">
          ${anchor(at("guide/#launch"), "Open Metadata Studio", "button primary")}
          ${anchor(at("#example"), "Explore an example", "button secondary")}
        </div>
        <p class="hero-note">For PNG, JPEG, and WebP on Civitai.</p>
      </div>
      ${example(sample)}
    </section>
    <section class="proof-band" aria-label="Export limits and release verification">
      <div class="frame proof-inner">
        <a href="${at("privacy/#limits")}"><strong>50 MiB</strong><span>Direct download limit</span></a>
        <a href="${at("privacy/#limits")}"><strong>256 MiB</strong><span>Lossless ZIP limit</span></a>
        <a href="${at("project/#release")}"><strong>v${html(hosted.version)}</strong><span>Reproducible Civitai build</span></a>
      </div>
    </section>
    <section class="frame browse-section">
      <div class="section-heading">
        <h2>From the first file to the final copy</h2>
        <p>Start in the App Store, review what your file carries, and choose how to save it.</p>
      </div>
      <div class="path-grid">
        ${pathCard(at("guide/"), "Learn the editor", "Open the app for the first time, try the example, and verify a model version.")}
        ${pathCard(at("privacy/"), "Choose your export", "See what the Civitai page receives when you save and when a ZIP or standalone makes sense.")}
        ${pathCard(at("project/"), "Check the source", "Rebuild the hosted HTML, verify the signed GitHub ZIP, or find help.")}
      </div>
      <p class="article-link">${anchor(links.article, "Read the launch article on Civitai", "text-link")}</p>
    </section>`;
}

function guide({ sample }) {
  return `
    ${heading("Your first file, <em>step by step.</em>", "Start in Civitai’s App Store. Then use a small example to learn what Studio can recover and what it can save.")}
    <div class="frame content-grid">
      <nav class="page-nav" aria-label="On this page">
        <a href="#launch">Open on Civitai</a>
        <a href="#practice">Try the example</a>
        <a href="#resources">Verify resources</a>
        <a href="#import">Import a public recipe</a>
        <a href="#faq">Troubleshooting</a>
      </nav>
      <div class="article-flow">
        <section id="launch">
          <h2>Open on Civitai</h2>
          <ol class="steps">
            <li><strong>Sign in to the Civitai site you use.</strong> In the navigation, choose <strong>Apps</strong> and then <strong>Browse the store</strong>.</li>
            <li>Find <strong>Civitai Metadata Studio</strong> in the Store.</li>
            <li>Choose <strong>Open</strong> on its listing. Next time, find it under <strong>My apps</strong> in the same browser.</li>
          </ol>
          <div class="actions">
            ${anchor(links.storeCom, "Civitai.com App Store", "button primary")}
            ${anchor(links.storeRed, "Civitai.red App Store", "button secondary")}
          </div>
        </section>
        <section id="practice">
          <h2>Try a small edit</h2>
          <div class="practice">
            <div>
              <p>${sampleDownload}. The ${sample.width} × ${sample.height} observatory image carries example A1111 settings. Open it with the local picker or drop it into the editor.</p>
              <ol class="steps">
                <li>Read the prompt, seed, and sampler. Width and height start from the actual image pixels.</li>
                <li>Change a word in the prompt, then check <strong>Review</strong> for differences or conflicts.</li>
                <li>Choose <strong>Save new copy</strong> and read the first-save notice. Reopen the downloaded copy to confirm your edit.</li>
              </ol>
            </div>
            <img src="${at("assets/aurora-observatory.webp")}" alt="${sampleAlt}" width="960" height="640" loading="lazy">
          </div>
          <p>The original file stays in place. The saved copy keeps its encoded pixels and supported animation frames. ${anchor(at("privacy/"), "Read the save and export details", "text-link")}.</p>
        </section>
        <section id="resources">
          <h2>Verify a model or LoRA</h2>
          <p>Open <strong>Resources</strong> to see which models and add-ons the file mentions. A full hash or an exact Civitai model-version ID can anchor a match. An exact resource link opens on the Civitai site you’re using.</p>
          <p>When claims disagree, use <strong>Review</strong> to see the evidence. A name search helps you find candidates, and you choose the correct version.</p>
        </section>
        <section id="import">
          <h2>Import a public image recipe</h2>
          <p>With a local file open, choose <strong>Import a Civitai image recipe</strong> and enter a public Civitai image URL or ID. Studio can fill missing fields from what that public image shares and sends disagreements to <strong>Review</strong>.</p>
          <p>The current host’s public catalog rules control which images and details are available. The import sends the public image ID to Civitai.</p>
        </section>
        <section id="faq">
          <h2>Troubleshooting</h2>
          <div class="questions">${waitList.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join("")}</div>
          <div class="inline-links">${anchor(doc("Troubleshooting"), "Full troubleshooting guide", "text-link")}${anchor(links.discussions, "Ask a usage question", "text-link")}</div>
        </section>
      </div>
    </div>`;
}

function privacy() {
  return `
    ${heading("Know what <em>your file shares.</em>", "Inspect and edit local image metadata in the browser. On an explicit save, Civitai’s parent page receives the finished export to start its download.")}
    <div class="frame content-grid">
      <nav class="page-nav" aria-label="On this page">
        <a href="#data-flow">What goes where</a>
        <a href="#limits">Hosted limits</a>
        <a href="#standalone">Full standalone edition</a>
      </nav>
      <div class="article-flow">
        <section id="data-flow">
          <h2>What goes where</h2>
          <div class="flow-pair">
            <div><h3>Opening and editing</h3><p>Local image bytes, prompts, and workflows are processed inside the embedded editor. Its bounded identity cache is held in that session and can be cleared.</p></div>
            <div><h3>Saving a copy</h3><p>When you choose <strong>Save new copy</strong>, the finished export and a sanitized download name pass to Civitai’s parent page in the same tab. The parent can read the complete export and its retained metadata.</p></div>
          </div>
          <p>The first export explains this handoff. The reviewed host handler creates a browser download. The same boundary applies to reports, edit handoffs, and ZIPs that you choose to export. Review embedded metadata before sharing a copy. A generic filename only changes the name.</p>
          <h3>Civitai lookups</h3>
          <p>Automatic verification sends exact hashes or numeric model-version IDs to Civitai. Explicit name searches and public image imports send the search text or public image ID you submit. You can turn automatic verification off. The editor requests zero Civitai app scopes.</p>
          <div class="inline-links">
            ${anchor(doc("Privacy-and-Exports"), "Detailed privacy guide", "text-link")}
            ${anchor("https://developer.civitai.com/apps/reference/hooks/storage-and-media", "Civitai’s save contract", "text-link")}
          </div>
        </section>
        <section id="limits">
          <h2>Hosted export limits</h2>
          <dl class="limits">
            <div><dt>Up to 50 MiB</dt><dd>Save an ordinary finished file directly.</dd></div>
            <div><dt>Up to 256 MiB</dt><dd>Approve a lossless ZIP when the entire archive fits, including its overhead.</dd></div>
            <div><dt>Larger batches</dt><dd>Divide downloads into archives of complete files. Keep the tab open while the host paces downloads.</dd></div>
            <div><dt>A file that cannot fit</dt><dd>Keep the original and use the standalone edition for the export.</dd></div>
          </dl>
          <p>One MiB is 1,048,576 bytes. Limits measure finished bytes. The writers preserve the encoded pixels and supported animation frames, and retained ComfyUI prompt and workflow carriers stay byte for byte. Civitai also applies rolling download budgets.</p>
        </section>
        <section id="standalone">
          <h2>The full standalone edition</h2>
          <p>Download the portable HTML and open it in your browser for larger exports or downloads outside Civitai’s parent page. The standalone sibling offers an optional local automation companion, its own guides, and a separate issue tracker.</p>
          <div class="actions">
            ${anchor(links.download, "Download standalone", "button primary")}
            ${anchor(standalone + "/wiki", "Standalone wiki", "button secondary")}
          </div>
        </section>
      </div>
    </div>`;
}

function project({ release, hosted }) {
  const tag = "v" + release.version;
  const releasePage = links.releases + "/tag/" + tag;
  const zipFile = release.archive.filename;
  const commands = [
    "git clone " + repo + ".git",
    "cd civitai-metadata-studio-app-block",
    "npm run reproduce",
    "npm run verify:live",
  ];
  return `
    ${heading("Source you can <em>verify.</em>", "The App Block is open source. Rebuild the reviewed Civitai entry, verify the release files, and find the right channel for help or contributions.")}
    <div class="frame content-grid">
      <nav class="page-nav" aria-label="On this page">
        <a href="#release">Release proof</a>
        <a href="#build">Build and verify</a>
        <a href="#support">Get help</a>
        <a href="#maintain">Contribute</a>
      </nav>
      <div class="article-flow">
        <section id="release">
          <h2>Civitai App Block v${html(hosted.version)}</h2>
          <p>The served HTML matches this repository’s renderer byte for byte. The reference is the signed ${html(tag)} source release. Civitai’s current build changes the version banner and the corresponding script hash. Verified on ${html(hosted.verifiedOn)}.</p>
          <dl class="hashes">
            <div><dt>Hosted HTML <span>${hosted.html.bytes.toLocaleString("en-US")} bytes</span></dt><dd><code>${html(hosted.html.sha256)}</code></dd></div>
          </dl>
          <p>${anchor(repo + "/blob/main/releases/live.json", "Hosted build proof", "text-link")}.</p>
          <h3>Immutable GitHub release ${html(tag)}</h3>
          <p>GitHub publishes the original App Block ZIP, its checksum file, and a signed release attestation.</p>
          <div class="actions">
            ${anchor(releasePage, "View the verified release", "button primary")}
            ${anchor(links.releases + "/download/" + tag + "/" + zipFile, "Download developer ZIP", "button secondary")}
          </div>
          <dl class="hashes">
            <div><dt>Release HTML <span>${release.productionHtml.bytes.toLocaleString("en-US")} bytes</span></dt><dd><code>${html(release.productionHtml.sha256)}</code></dd></div>
            <div><dt>Release ZIP <span>${release.archive.bytes.toLocaleString("en-US")} bytes</span></dt><dd><code>${html(release.archive.sha256)}</code></dd></div>
          </dl>
          <div class="inline-links">
            ${anchor(doc("Release-Provenance"), "Full release provenance", "text-link")}
            ${anchor(repo + "/blob/main/releases/" + release.version + ".json", "Machine-readable record", "text-link")}
            ${anchor(repo + "/blob/main/CHANGELOG.md", "Changelog", "text-link")}
          </div>
        </section>
        <section id="build">
          <h2>Build and verify</h2>
          <p>Use Node.js 24 or later and follow <code>.node-version</code> for the recorded verification version. Run these commands from the default branch to check both records.</p>
          <pre><code>${html(commands.join("\n"))}</code></pre>
          <p><code>reproduce</code> checks the historical release and the recorded hosted HTML. <code>verify:live</code> also compares that hosted build with what Civitai serves now. To check the original publication independently, check out <code>${html(tag)}</code> and run <code>npm run reproduce</code>.</p>
          <p>To authenticate a ZIP from the immutable release, install GitHub CLI and run this beside the downloaded file.</p>
          <pre><code>${html("gh release verify-asset " + tag + " ./" + zipFile + " --repo chriscollins500/civitai-metadata-studio-app-block")}</code></pre>
          <div class="inline-links">
            ${anchor(doc("Build-and-Verify"), "Detailed build instructions", "text-link")}
            ${anchor(doc("Architecture"), "Architecture and data flow", "text-link")}
            ${anchor(repo + "/actions", "GitHub Actions", "text-link")}
          </div>
        </section>
        <section id="support">
          <h2>Get help</h2>
          <div class="support-grid">
            ${pathCard(links.discussions, "Ask a usage question", "Use GitHub Discussions for help with the hosted editor and community feedback.")}
            ${pathCard(links.issues, "Report a bug or suggest a feature", "Use the issue forms. Include the host, browser, steps, and a small synthetic example.")}
            ${pathCard(links.report, "Report a vulnerability privately", "Use GitHub private vulnerability reporting for suspected security or privacy issues.")}
            ${pathCard(standalone + "/issues", "Get standalone support", "For the portable HTML or its automation companion, use the standalone issue tracker.")}
          </div>
          <p>Keep private prompts, images, workflows, and credentials out of public reports. ${anchor(repo + "/blob/main/SUPPORT.md", "Read the support guide", "text-link")} or ${anchor(repo + "/issues/new?template=website-or-docs.yml", "report a website or docs issue", "text-link")}.</p>
        </section>
        <section id="maintain">
          <h2>Contribute</h2>
          <p>Start with a small synthetic fixture or a reproducible description. The contributing guide explains where changes to the shared engine go and what evidence to include in a pull request.</p>
          <div class="inline-links">
            ${anchor(repo + "/blob/main/CONTRIBUTING.md", "Contributing guide", "text-link")}
            ${anchor(wiki, "App Block wiki", "text-link")}
            ${anchor(doc("Maintainer-Guide"), "Maintainer guide", "text-link")}
            ${anchor(repo + "/blob/main/CODE_OF_CONDUCT.md", "Code of conduct", "text-link")}
            ${anchor(links.security, "Security policy", "text-link")}
          </div>
          <p class="small-print">The example PNG carries illustrative settings over generated artwork. The ${anchor(at("assets/aurora-observatory-source.png"), "unmodified artwork", "text-link")} retains the embedded content-credentials record. Instrument Serif is distributed under the ${anchor(at("assets/OFL-Instrument-Serif.txt"), "SIL Open Font License", "text-link")}.</p>
        </section>
      </div>
    </div>`;
}

export const pages = [
  { path: "", title: "Home", description: "See the generation settings inside an AI image, verify exact model details, and save a copy with the same encoded pixels.", render: home },
  { path: "guide/", title: "Guide", description: "Open Metadata Studio from the Civitai App Store and practice a first edit with a downloadable example.", render: guide },
  { path: "privacy/", title: "Privacy and exports", description: "What stays in your browser, what Civitai receives on explicit save, and which export sizes the hosted app supports.", render: privacy },
  { path: "project/", title: "Project and release verification", description: "Verify the App Block’s reproducible release and find the source, signed release, wiki, and support paths.", render: project },
  {
    path: "404.html", title: "Page not found", description: "Return to Civitai Metadata Studio’s home or user guide.", notFound: true,
    render: () => heading("Page <em>not found.</em>", "Try the " + anchor(at(), "home page", "text-link") + " or the " + anchor(at("guide/"), "user guide", "text-link") + "."),
  },
];
