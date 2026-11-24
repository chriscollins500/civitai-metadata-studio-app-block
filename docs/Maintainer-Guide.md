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

## Preserve public and private boundaries

Use test data you can share. Keep authentication, local settings, diagnostic media, workstation paths, and private workbench history out of source and release assets. For issues, route public reproducible App Block behavior here and send vulnerabilities through the private security form. [Security](../SECURITY.md) · [Contributing](../CONTRIBUTING.md)

[Build and verify](Build-and-Verify.md) · [Release provenance](Release-Provenance.md)
