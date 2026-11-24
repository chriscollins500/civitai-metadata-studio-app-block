(() => {
  "use strict";
  const Studio = globalThis.CMStudio ||= {};
  Studio.environment = { kind: "app-block", cacheMode: "memory" };
  // Wire contract and source pins are recorded in app-block/protocol-provenance.json.
  Studio.appBlockContract = Object.freeze({
    origins: Object.freeze(["https://civitai.com", "https://civitai.red", "https://civitai.green"]),
    ordinaryBytes: 50 * 1024 * 1024,
    zipBytes: 256 * 1024 * 1024,
    ordinaryWindowBytes: 100 * 1024 * 1024,
    windowMs: 10_000,
    windowCount: 5,
    zipEntries: 10_000,
    standalone: "https://github.com/chriscollins500/civitai-metadata-studio"
  });
})();
