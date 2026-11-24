# Troubleshooting

| What you see | What to try |
| --- | --- |
| An image opens, but the prompt is empty | Open the original output from your generator. Copies from chat, screenshots, and social sites often have less embedded data. |
| Model details are ambiguous | Review the exact version or file hashes. A filename or display name can match several resources. |
| Public metadata is unavailable | Confirm the image is public and accessible from the current Civitai host. Paste the image ID or full image URL. |
| Verification pauses with a rate-limit message | Wait for the displayed cooldown to end before trying another lookup. |
| The hosted save asks for confirmation | Read the disclosure and choose whether to pass the finished file to the Civitai page for download. |
| A download did not appear | Check the browser’s download history and destination folder first. Keep the editor open so your edits are still available. |
| A large output cannot fit | Save with the [standalone edition](https://github.com/chriscollins500/civitai-metadata-studio/releases/latest). Keep the original file for a hash-bound handoff when using a compatible build. |
| The published hash passes, but the live comparison differs | Check whether Civitai is now serving a newer version. The tag’s committed record remains the reference for that tag. |

## Ask for help

Include the site domain, browser, file format, action you took, and exact visible message. When possible, use a small synthetic example. Keep private prompts, workflows, images, local paths and credentials out of public reports. [Support](../SUPPORT.md) · [Open a hosted-app issue](https://github.com/chriscollins500/civitai-metadata-studio-app-block/issues/new/choose)

[Privacy and exports](Privacy-and-Exports.md) · [Build and verify](Build-and-Verify.md)
