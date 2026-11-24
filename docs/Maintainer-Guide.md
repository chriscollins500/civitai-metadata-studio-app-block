# Maintainer guide

## Keep the two editions in step

Start from an explicit upstream engine commit. Reuse the same metadata record, resource verification rules, and format writers in both editions. Keep the Civitai-specific changes in the host adapter wherever the shared design allows. Record the upstream commit and any host-specific changes with the release.

## Review a candidate

1. Describe the benefit, tradeoffs and acceptance check in the pull request.
2. Run `npm run ci`. Use synthetic files for the browser, format, privacy, identity and export checks that the change affects.
3. Build the exact four-file candidate. Inspect its size, hashes, manifest, and archive entry names.
4. If checking the Civitai contract, run the official CLI against the built directory. The package-only command writes a local ZIP.
5. Record the exact build inputs and epoch, keep Civitai approval evidence and Git provenance, and compare the production HTML after Civitai deploys.
6. Give the GitHub release an explicit, verified tag and checksum. Publish new versions with new tags.

```sh
civitai app validate --strict build/app-block
civitai app submit build/app-block --package-only -o build/civitai-cli-package.zip
```

The GitHub workflow verifies the source and artifacts. The Civitai listing and deployment use Civitai’s own review process. Check the current official documentation before changing its manifest, permissions or host contract. [Official pack and submit documentation](https://developer.civitai.com/apps/guide/packaging) · [Review and deploy](https://developer.civitai.com/apps/guide/review-and-deploy)

## Maintain the project website and wiki

Update the canonical guides in `docs/` and the reader-facing Pages copy in `website/pages.mjs`. Pages reads release hashes and sizes from the versioned release record. The home page reads its example fields from the actual downloadable PNG.

After a Civitai deployment, record the verified version, HTML size, digest, and verification date in `releases/live.json`. Check the reconstructed HTML against the host. The signed GitHub release and its historical reference stay tied to their tag.

```sh
npm run site:build
npm run wiki:build
```

The website build writes its public allowlist to `build/site/`. GitHub checks it on pull requests and deploys the verified artifact from `main`. Preview Pages under `/civitai-metadata-studio-app-block/`, which is the same base path as the published site. A site-only change can run `npm run reproduce` to verify the Civitai package bytes.

The Wiki build mirrors the canonical guides into `build/wiki/`, rewrites their navigation, and generates the Wiki home, sidebar, and footer. Copy the generated Markdown files into the public `.wiki.git` checkout, review the diff, and commit the changed pages there. GitHub tracks the Wiki in its own repository.

The downloadable PNG carries deliberately authored example settings. Its encoded image matches the unmodified synthetic artwork kept alongside it. The smaller WebP is loaded for the visual preview. The website bundles Instrument Serif’s Latin font files and the original SIL Open Font License for local loading. [Instrument Serif source](https://github.com/google/fonts/tree/main/ofl/instrumentserif) · [Project website](https://chriscollins500.github.io/civitai-metadata-studio-app-block/) · [Pages workflow](../.github/workflows/pages.yml)

## Preserve public and private boundaries

Use test data you can share. Keep authentication, local settings, diagnostic media, workstation paths, and private workbench history out of source and release assets. For issues, route public reproducible App Block behavior here and send vulnerabilities through the private security form. [Security](../SECURITY.md) · [Contributing](../CONTRIBUTING.md)

[Build and verify](Build-and-Verify.md) · [Release provenance](Release-Provenance.md)
