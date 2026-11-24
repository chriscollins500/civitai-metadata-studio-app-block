# Release provenance

Version **0.1.1** is the first public source release of the hosted App Block. The shared engine starts from the standalone 1.0.1 baseline at commit `6682f2a550a75fe6d849f35012915c5e19c96695`. This source export retains the hosted changes and exact inputs that build the reviewed Civitai HTML. [Upstream source at that commit](https://github.com/chriscollins500/civitai-metadata-studio/tree/6682f2a550a75fe6d849f35012915c5e19c96695)

| Reference artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Civitai production `index.html` | 444139 | `860c80e4ca714600469f43cccda5b711216cc3ba8c3a1bdb53ed0cafc766be48` |
| Reproducible local App Block ZIP | 446870 | `186ea99fce4313bc6eacb3d17ddf829468696d0b3fa7c40a339f43b43761f92b` |
| Official CLI 0.1.150 submission ZIP | 105006 | `431567dfd7fff1ca96b7baf690113b09fdbae74a8f6faf3c431f04fc61dc68c4` |

The two ZIP forms store the same four entries at different compression settings. The published App Block ZIP is the reproducible local form. Its release checksum is next to the download. The ZIP also has a checksum file for its contents.

The official CLI ZIP also records the source files’ modification times. We reproduced its complete bytes with CLI `0.1.150` on a Windows host in the `America/New_York` time zone. After building, copy the four files to a temporary directory, set their `LastWriteTimeUtc` to `2026-11-22T03:09:21Z`, and package that directory with `civitai app submit <directory> --package-only -o <zip-file>`. The historical entry timestamp is recorded alongside the ZIP hash. [Official CLI release](https://github.com/civitai/cli/releases/tag/v0.1.150)

The build uses UTC epoch `1795305600`, which records the original November 22, 2026 build date. Civitai restored the approved deployment on November 23. The direct HTML comparison checks bytes, and the earlier production smoke test saved an 8192 × 8192 synthetic PNG through each host. Both files preserved their image payload and original ComfyUI workflow. The final outer iframe sandbox attribute was not independently inspected in production. [Recorded release values](../releases/0.1.1.json) · [Live entry](https://civitai-metadata-studio.civit.ai/)

[Build and verify](Build-and-Verify.md) · [Changelog](../CHANGELOG.md) · [Releases](https://github.com/chriscollins500/civitai-metadata-studio-app-block/releases)
