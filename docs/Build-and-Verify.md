# Build and verify

Use Node.js 24 or later and npm. The first public source release uses Node.js 26.13.0 for verification. Node’s built-in filesystem, crypto, compression and test libraries cover the basic path, so you can build directly after cloning.

```sh
git clone https://github.com/chriscollins500/civitai-metadata-studio-app-block.git
cd civitai-metadata-studio-app-block
git checkout v0.1.1
npm run reproduce
```

This builds from the pinned epoch in [app-block/build-epoch.txt](../app-block/build-epoch.txt), checks the manifest, CSP and packaging, and validates the HTML and ZIP against their recorded SHA-256 hashes. The built files are in `build/app-block/` and the ZIP is in `build/`. [Release record](../releases/0.1.1.json)

## Check the hosted Civitai deployment

Switch to the default branch for the current hosted build proof.

```sh
git switch main
npm run verify:live
```

This checks the historical source and ZIP, then renders the version recorded in [the hosted build record](../releases/live.json). It reads the public catalog on both Civitai domains and checks the listing, App Block ID, public page, hosted URL, and Source and Support links. It fetches the production HTML with normal TLS verification and compares the complete bytes. The default branch's `npm run reproduce` also verifies the hosted build record offline. Use the tagged `npm run reproduce` to check the historical GitHub release by itself.

## Verify the GitHub Pages website

Check out the deployment's reviewed source revision and run the website build. The first verification checks the local artifact. With `--live`, it compares the served manifest and each file in that artifact against the local build, using the website's normal route prefix.

```sh
npm run site:build
npm run site:verify
npm run site:verify -- --live
```

The Pages workflow can sign its manifest and independently rebuild and verify the published files. To verify a Pages signature, use the reviewed deployment commit SHA for `<deployment-commit>`. This signature check applies to Pages deployments made with the manifest signing job.

```sh
gh attestation verify build/site/deployment.json \
  --repo chriscollins500/civitai-metadata-studio-app-block \
  --signer-workflow chriscollins500/civitai-metadata-studio-app-block/.github/workflows/pages.yml \
  --source-ref refs/heads/main \
  --source-digest <deployment-commit> \
  --deny-self-hosted-runners
```

See the release guide for the original App Block ZIP signature and separate Civitai HTML proof. [Release provenance](Release-Provenance.md) · [Pages workflow](../.github/workflows/pages.yml)

## Run the other checks

| Command | Evidence |
| --- | --- |
| `npm run check` | JavaScript and type-declaration syntax |
| `npm run docs:check` | Page titles and internal documentation links |
| `npm test` | Shared formats, editing, lossless payloads, identity, cache, bridge, and preview regressions |
| `npm run verify` | Canonical snapshot checksums, manifest semantics, CSP, and exact four-file ZIP contents |
| `npm run verify:schema` | Full Draft 2020-12 manifest validation using Python with the jsonschema package available |
| `npm run test:browser` | A local synthetic host in Chrome with an existing Playwright installation |
| `npm run ci` | Syntax, docs, automated tests, and structural bundle verification |
| `npm run site:build` | Static Pages output, internal links and fragments, and the downloadable example’s metadata and encoded image |
| `npm run site:verify` | Exact allowlisted Pages output and its deterministic SHA-256 manifest |
| `npm run wiki:build` | GitHub Wiki versions of the canonical docs and their shared navigation |

Set `CM_STUDIO_PYTHON` to an existing Python executable if it is named differently on your machine. For the browser check, set `CM_STUDIO_PLAYWRIGHT` to the installed package’s `index.js` and use `npm run test:browser -- msedge` for Edge. The browser harness uses a synthetic opaque iframe, captures only synthetic files, and builds a local reference copy for testing edit handoffs. A served loopback preview is also available after `npm run build` via `npm run preview`. It exposes the four bundle files on port 5186. The production save path requires Civitai’s parent bridge.

## Inspect the archive

| Entry | Role |
| --- | --- |
| `index.html` | App UI, shared metadata engine, and host adapter |
| `block.manifest.json` | Civitai App Block contract and version |
| `LICENSE` | MIT license |
| `SHA256SUMS.txt` | SHA-256 for the preceding three files |

[Architecture](Architecture.md) · [Release provenance](Release-Provenance.md) · [Maintainer guide](Maintainer-Guide.md)
