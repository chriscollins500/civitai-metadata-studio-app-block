export const repo = "https://github.com/chriscollins500/civitai-metadata-studio-app-block";
export const standalone = "https://github.com/chriscollins500/civitai-metadata-studio";
export const website = "https://chriscollins500.github.io/civitai-metadata-studio-app-block/";
export function at(path = "") {
  const url = new URL(path, website);
  return url.pathname + url.hash;
}
export const doc = (filename) => repo + "/blob/main/docs/" + filename + ".md";
export const wiki = repo + "/wiki";
export const links = {
  civitaiCom: "https://civitai.com/",
  civitaiRed: "https://civitai.red/",
  article: "https://civitai.red/articles/39668/whats-inside-that-ai-image-meet-civitai-metadata-studio",
  issues: repo + "/issues/new/choose",
  discussions: repo + "/discussions",
  security: repo + "/security/policy",
  report: repo + "/security/advisories/new",
  releases: repo + "/releases",
  download: standalone + "/releases/latest",
};

const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const html = (value) => String(value).replace(/[&<>"']/gu, (character) => escapes[character]);
export const anchor = (href, label, style) =>
  '<a href="' + html(href) + '"' + (style ? ' class="' + html(style) + '"' : "") + ">" + html(label) + "</a>";

const nav = [
  ["", "Home"],
  ["guide/", "Guide"],
  ["privacy/", "Privacy & exports"],
  ["project/", "Project"],
];

export function layout(page, body) {
  const navigation = nav.map(([path, label]) => {
    const current = page.path === path ? ' aria-current="page"' : "";
    return '<a href="' + at(path) + '"' + current + ">" + html(label) + "</a>";
  }).join("");
  const title = page.path === "" ? "Civitai Metadata Studio" : page.title + " | Civitai Metadata Studio";
  const url = new URL(page.path, website).href;
  const meta = page.notFound
    ? '<meta name="robots" content="noindex">'
    : [
      '<link rel="canonical" href="' + html(url) + '">',
      '<meta property="og:type" content="website">',
      '<meta property="og:url" content="' + html(url) + '">',
      '<meta property="og:title" content="' + html(title) + '">',
      '<meta property="og:description" content="' + html(page.description) + '">',
      '<meta property="og:image" content="' + html(new URL("assets/studio-cover.png", website).href) + '">',
      '<meta property="og:image:alt" content="Civitai Metadata Studio illustration showing image metadata and resource verification">',
    ].join("\n    ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${html(page.description)}">
    <meta name="theme-color" content="#0b1a17">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'">
    <title>${html(title)}</title>
    ${meta}
    <link rel="icon" href="${at("assets/studio-icon.png")}" type="image/png">
    <link rel="stylesheet" href="${at("assets/studio.css")}">
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="frame header-inner">
        <a class="brand" href="${at()}" aria-label="Civitai Metadata Studio home">
          <img src="${at("assets/studio-icon.png")}" width="38" height="38" alt="">
          <span>Metadata Studio<small>Civitai App Block</small></span>
        </a>
        <nav aria-label="Main">${navigation}</nav>
        ${anchor(repo, "GitHub", "repo-link")}
      </div>
    </header>
    <main id="main" tabindex="-1">
      ${body}
    </main>
    <footer class="site-footer">
      <div class="frame footer-inner">
        <div><strong>Civitai Metadata Studio</strong><p>An open-source editor for AI image metadata.</p></div>
        <nav aria-label="Project links">
          ${anchor(wiki, "Wiki")}${anchor(links.releases, "Releases")}${anchor(repo + "/blob/main/SUPPORT.md", "Support")}${anchor(links.security, "Security")}${anchor(repo + "/blob/main/LICENSE", "MIT license")}
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}
