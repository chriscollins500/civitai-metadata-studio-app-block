# Getting started

Open Metadata Studio on the Civitai site you already use. Pick a PNG, JPEG, or WebP you generated that still has its original metadata. Export a test copy before editing a whole batch. [Civitai.com](https://civitai.com/apps/run/civitai-metadata-studio) · [Civitai.red](https://civitai.red/apps/run/civitai-metadata-studio)

## Make your first edit

1. Open a file with the app’s local picker or drop it into the editor.
2. Look at the prompt, seed, sampler and image size. The editor takes the initial width and height from the actual image.
3. Change one detail, such as a misspelled word in the prompt. Review any differences or conflicts before saving.
4. Choose **Save new copy**. Read the first-export disclosure and confirm if you want the Civitai page to start the download.
5. Open the downloaded file to confirm the change. The original file is still where you left it.

The app recognizes generation metadata from formats including A1111 and ComfyUI. A file that has been resized, converted, or shared through another service may only carry part of its recipe. Fields that have no evidence can be filled in manually.

## Check a model or LoRA

Use **Resources** to see which models or add-ons the image mentions. A full hash or exact Civitai version ID can anchor a match. The editor shows conflicting claims for review. If you search by name, select the correct version yourself. An exact resource link opens on the current Civitai site.

## Bring in a public Civitai recipe

With a local image open, use **Import a Civitai image recipe** and enter a public image URL or ID. Studio fills missing fields it can identify and sends disagreements to **Review**. The current host’s public catalog rules still apply. The editor uses the public image ID to retrieve the information that Civitai exposes.

## Continue with larger files or automation

Download the full standalone HTML from GitHub and open it in your browser. Its optional local companion supports automation. Start there when the source file or finished export is too large for the hosted route, or when you want to keep the finished file outside Civitai’s parent page. [Standalone download](https://github.com/chriscollins500/civitai-metadata-studio/releases/latest) · [Standalone getting started](https://github.com/chriscollins500/civitai-metadata-studio/wiki/Getting-Started)

[Privacy and export limits](Privacy-and-Exports.md) · [Troubleshooting](Troubleshooting.md) · [Documentation home](../README.md)
