# Release provenance

Version **0.1.1** is the first public source release of the hosted App Block. The shared engine starts from the standalone 1.0.1 baseline at commit `6682f2a550a75fe6d849f35012915c5e19c96695`. This source export retains the hosted changes and exact inputs behind the reviewed Civitai HTML. [Upstream source at that commit](https://github.com/chriscollins500/civitai-metadata-studio/tree/6682f2a550a75fe6d849f35012915c5e19c96695)

## Current Civitai deployment

Civitai serves **0.1.2** on both hosts. The listing includes the GitHub Source and Support links and a screenshot. On November 24, 2026, the hosted HTML matched the shared renderer’s 0.1.2 output byte for byte. Its only differences from the original 0.1.1 HTML are the build banner’s version and the corresponding CSP script hash.

The 444,139-byte hosted HTML has SHA-256 `40bd313d1235a103760d67d4431f05656bbe86bb496defecb7f5190a8c1ddafe`. The November 28, 2026 check confirmed that both catalogs pointed to it and linked this repository as Source and its issue tracker as Support. On `main`, run `npm run verify:live` to repeat the checks. [Hosted build record](../releases/live.json) · [Civitai.com catalog](https://civitai.com/api/v1/apps/civitai-metadata-studio) · [Civitai.red catalog](https://civitai.red/api/v1/apps/civitai-metadata-studio)

## Signed GitHub release v0.1.1

| Reference artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Historical `index.html` | 444139 | `860c80e4ca714600469f43cccda5b711216cc3ba8c3a1bdb53ed0cafc766be48` |
| Reproducible local App Block ZIP | 446870 | `186ea99fce4313bc6eacb3d17ddf829468696d0b3fa7c40a339f43b43761f92b` |
| Official CLI 0.1.150 submission ZIP | 105006 | `431567dfd7fff1ca96b7baf690113b09fdbae74a8f6faf3c431f04fc61dc68c4` |

The two ZIP forms store the same four entries at different compression settings. The published App Block ZIP is the reproducible local form. Its release checksum is next to the download. The ZIP also has a checksum file for its contents.

## Verify GitHub’s signed release attestation

GitHub’s attestation binds the immutable tag, source commit, and release assets. Run GitHub CLI beside the ZIP you downloaded.

```sh
gh release verify v0.1.1 --repo chriscollins500/civitai-metadata-studio-app-block
gh release verify-asset v0.1.1 ./civitai-metadata-studio-app-block-0.1.1.zip --repo chriscollins500/civitai-metadata-studio-app-block
```

The attestation authenticates the release and its ZIP. The byte-for-byte comparison covers the separate HTML served by Civitai. [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases) · [Release verification on the project website](https://chriscollins500.github.io/civitai-metadata-studio-app-block/project/#release)

## Reproduce the Civitai package

The official CLI ZIP also records the source files’ modification times. We reproduced its complete bytes with CLI `0.1.150` on a Windows host in the `America/New_York` time zone. After building, copy the four files to a temporary directory, set their `LastWriteTimeUtc` to `2026-11-22T03:09:21Z`, and package that directory with `civitai app submit <directory> --package-only -o <zip-file>`. The historical entry timestamp is recorded alongside the ZIP hash. [Official CLI release](https://github.com/civitai/cli/releases/tag/v0.1.150)

The build uses UTC epoch `1795305600`, which records the original November 22, 2026 build date. Civitai restored the approved deployment on November 23. The direct HTML comparison checks bytes, and the earlier production smoke test saved an 8192 × 8192 synthetic PNG through each host. Both files preserved their image payload and original ComfyUI workflow. The final outer iframe sandbox attribute was not independently inspected in production. [Recorded release values](../releases/0.1.1.json) · [Live entry](https://civitai-metadata-studio.civit.ai/)

[Build and verify](Build-and-Verify.md) · [Changelog](../CHANGELOG.md) · [Releases](https://github.com/chriscollins500/civitai-metadata-studio-app-block/releases)
