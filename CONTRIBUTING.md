# Contributing

## Rule #1

**Everything in this project must operate at frontier level, beyond the bleeding edge, in philosophy, methodology, and action.** Describe the benefit and tradeoffs of a change. Make the acceptance check concrete, then verify the real output.

## Find the right project

This repository owns Civitai App Block behavior and packaging. The standalone repository is the upstream home for the shared metadata engine and portable edition. Start shared parser, writer, or identity changes there, then record the upstream commit when bringing them into a hosted release. [Architecture](docs/Architecture.md) · [Standalone project](https://github.com/chriscollins500/civitai-metadata-studio)

## Prepare a change

1. Use the Node version in [.node-version](.node-version), or another supported Node.js version.
2. Read the relevant guide and reproduce the problem from a small synthetic fixture.
3. Keep the existing metadata model and use exact evidence to identify resources. Preserve original carrier bytes and the encoded pixel or frame payload.
4. Run `npm run ci` and the checks relevant to the change. For docs and packaging changes that should leave the release intact, also run `npm run reproduce`.
5. Open a pull request with the expected behavior, evidence, and test results. Include known limitations.

For public documentation and website changes, run `npm run site:build` and `npm run wiki:build`. Update the versioned guide before refreshing its Wiki mirror. [Website and Wiki maintenance](docs/Maintainer-Guide.md#maintain-the-project-website-and-wiki)

Use a synthetic example for files, screenshots, and logs. Keep any user media, credentials, prompts, and full workstation paths outside pull requests. [Build and verify](docs/Build-and-Verify.md) · [Security](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md)
