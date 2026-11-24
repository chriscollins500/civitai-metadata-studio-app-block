# Security policy

## Supported release

Security reports are welcome for the current hosted App Block. Identify which live host exposed the behavior and the version if you know it. [Hosted build proof](https://chriscollins500.github.io/civitai-metadata-studio-app-block/project/#release) · [Signed GitHub release](https://github.com/chriscollins500/civitai-metadata-studio-app-block/releases/latest)

## Report privately

Use GitHub’s private vulnerability reporting form for suspected data leaks, script execution, unsafe files, or host permission issues. Describe the affected version, the smallest reproducible steps, and the impact. Synthetic fixtures are enough to demonstrate the behavior. Keep credentials, private prompts, workflows, full local paths, and identifying media out of the initial report. [Report a vulnerability](https://github.com/chriscollins500/civitai-metadata-studio-app-block/security/advisories/new)

Use public issues for ordinary problems with metadata, downloads, or layout. [Support](SUPPORT.md)

## Repository checks

Dependabot tracks the GitHub Actions used by the verification and Pages workflows and groups routine updates into one pull request. GitHub also tracks dependency advisories and can propose security fixes. The App Block and website builds have no npm dependencies. CodeQL scans JavaScript, TypeScript, and GitHub Actions with its extended security suite. The repository’s Security tab shows the latest analysis and alerts. [Workflow runs](https://github.com/chriscollins500/civitai-metadata-studio-app-block/actions) · [Verify release assets](https://chriscollins500.github.io/civitai-metadata-studio-app-block/project/#release)

## Data and permissions

The editor processes local media in the iframe. Exact public identity requests and explicit catalog queries use Civitai’s public API. An explicit export sends the finished file to Civitai’s parent page in the same tab. The parent can read the complete export, including retained metadata. The app requests zero app scopes and uses a bounded session cache. [Privacy and exports](docs/Privacy-and-Exports.md) · [Architecture](docs/Architecture.md)
