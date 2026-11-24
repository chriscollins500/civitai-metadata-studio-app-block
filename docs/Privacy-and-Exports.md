# Privacy and exports

## What happens to a local file?

The embedded editor opens and processes local image bytes in your browser. It reads prompts, generation settings, and workflows locally. It uses a bounded session-memory cache for identity lookups, which you can clear. Reloading the page clears this cache and can discard unsaved edits.

Automatic Civitai identity checks use exact hashes or numeric version IDs. Name searches and public image imports send the specific search text or public image ID you submit. Turn off automatic verification if you want to decide when to request a lookup. The editor uses public Civitai endpoints and requests no Civitai app scopes.

## What happens when I save?

On **Save new copy**, a finished file and a sanitized download name go to Civitai’s parent page in the same browser tab. The parent can read all the bytes and retained metadata. The reviewed host handler uses them to start a browser download. The same boundary applies to a report, edit handoff, or ZIP that you choose to export. Optional generic filenames reduce what the filename reveals, so review the embedded metadata separately.

The writer preserves encoded pixels and supported animation frames. Original retained ComfyUI prompt and workflow carriers are preserved byte for byte. Before sharing a file, review its metadata as well as the visible image. Use standalone if you want the finished file to download outside Civitai’s parent page. [Official Civitai save contract](https://developer.civitai.com/apps/reference/hooks/storage-and-media) · [Download standalone](https://github.com/chriscollins500/civitai-metadata-studio/releases/latest)

## Hosted limits

| Finished output | Route |
| --- | --- |
| An ordinary output up to 50 MiB | Direct hosted download |
| A larger output that fits in a ZIP up to 256 MiB | Explicit lossless ZIP approval, including archive overhead |
| A batch that needs multiple archives | Divide the batch between complete files, then pace the downloads |
| A complete output that cannot fit the ZIP limit | Keep the current edit and use standalone |

One MiB is 1,048,576 bytes. Limits measure finished bytes, so a compact 8K PNG can fit even when a smaller image with a larger file size does not. Civitai also applies rolling download budgets. Keep the tab open until your downloads are confirmed. If the host does not confirm an attempted download, check Chrome’s or Edge’s download history before trying again. The app avoids automatically resending an export with an unknown outcome.

[Getting started](Getting-Started.md) · [Troubleshooting](Troubleshooting.md) · [Architecture](Architecture.md)
