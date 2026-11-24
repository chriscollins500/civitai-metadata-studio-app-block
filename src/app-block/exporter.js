(() => {
  "use strict";
  const Studio = globalThis.CMStudio ||= {};
  const C = Studio.appBlockContract;
  const encoder = new TextEncoder();
  const extensions = new Set(["png", "jpg", "jpeg", "webp", "json"]);

  function safeFilename(value, fallback = "metadata.png") {
    let name = Studio.util.basename(value).toWellFormed().normalize("NFC")
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu, "_")
      .replace(/[. ]+$/u, "").trim();
    if (!name || name === "." || name === "..") name = fallback;
    const dot = name.lastIndexOf(".");
    const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
    if (!extensions.has(ext) && ext !== "zip") throw new Error("This export format is not supported by the host.");
    let stem = name.slice(0, dot).replace(/^[. ]+/u, "") || "metadata";
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(stem)) stem = `_${stem}`;
    while (encoder.encode(`${stem}.${ext}`).length > 220) stem = [...stem].slice(0, -1).join("");
    return `${stem}.${ext}`;
  }

  const zipSize = (entries) => 22 + entries.reduce((sum, entry) => sum + entry.blob.size + 76 + 2 * encoder.encode(entry.name).length, 0);

  function planExports(outputs, { generic = false, ordinaryBytes = C.ordinaryBytes, zipBytes = C.zipBytes, zipEntries = C.zipEntries } = {}) {
    if (!Array.isArray(outputs) || !outputs.length) throw new Error("There is nothing to export.");
    const used = new Set();
    const suffixes = new Map();
    const entries = outputs.map((entry, index) => {
      if (!(entry.blob instanceof Blob) || !entry.blob.size) throw new Error("An export is empty or invalid.");
      const safe = safeFilename(entry.name);
      const ext = Studio.util.extension(safe);
      if (!extensions.has(ext)) throw new Error("Only image and JSON outputs can be packaged here.");
      const dot = safe.lastIndexOf(".");
      const stem = generic ? `metadata-${String(index + 1).padStart(3, "0")}` : safe.slice(0, dot);
      let name = `${stem}.${ext}`;
      name = safeFilename(name);
      const baseKey = name.normalize("NFC").toLowerCase();
      if (used.has(baseKey)) {
        let copy = suffixes.get(baseKey) || 2;
        do { name = safeFilename(`${copy++}-${stem}.${ext}`); } while (used.has(name.normalize("NFC").toLowerCase()));
        suffixes.set(baseKey, copy);
      }
      used.add(name.normalize("NFC").toLowerCase());
      return { ...entry, name };
    });
    if (entries.length === 1 && entries[0].blob.size <= ordinaryBytes) return [{ kind: "file", entries, size: entries[0].blob.size, name: entries[0].name }];
    const groups = [];
    let current = [];
    let currentSize = 22;
    for (const entry of entries) {
      const cost = entry.blob.size + 76 + 2 * encoder.encode(entry.name).length;
      if (22 + cost > zipBytes) throw new Error("A finished file cannot fit the host's lossless ZIP limit. Keep your edits and continue in standalone; no files were sent.");
      if (current.length && (current.length >= zipEntries || currentSize + cost > zipBytes)) { groups.push(current); current = []; currentSize = 22; }
      current.push(entry);
      currentSize += cost;
    }
    if (current.length) groups.push(current);
    return groups.map((group, index) => ({ kind: "zip", entries: group, size: zipSize(group), name: `civitai-metadata-${String(index + 1).padStart(3, "0")}.zip` }));
  }

  function budgetDelay(recent, size, zip, now) {
    const live = recent.filter((entry) => now - entry.at < C.windowMs);
    const budget = zip ? C.zipBytes : C.ordinaryWindowBytes;
    const fits = (entries) => entries.length < C.windowCount && entries.reduce((sum, entry) => sum + entry.size, size) <= budget;
    if (fits(live)) return 0;
    for (let index = 0; index < live.length; index++) if (fits(live.slice(index + 1))) return Math.max(1, live[index].at + C.windowMs - now + 10);
    return C.windowMs + 10;
  }

  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); reject(new DOMException("Export stopped.", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, ms);
    if (signal?.aborted) cancel(); else signal?.addEventListener("abort", cancel, { once: true });
  });

  function createExporter({ bridge, confirm, generic = () => false, onProgress = () => {}, now = () => performance.now(), wait = sleep }) {
    let acknowledged = false;
    let active = null;
    let recent = [];
    return Object.freeze({
      get active() { return Boolean(active); },
      cancel() { active?.abort(); },
      async exportFiles(outputs) {
        if (active) throw new Error("Another export is still in progress.");
        const controller = new AbortController();
        active = controller;
        let started = 0;
        try {
          if (!bridge.connected || bridge.suspended) throw new Error("A ready Civitai host is required for hosted downloads. Your edits are retained.");
          let plan = planExports(outputs, { generic: generic() });
          if (!acknowledged || plan.some((part) => part.kind === "zip")) {
            const accepted = await confirm({ plan, needsAcknowledgement: !acknowledged });
            if (!accepted) throw new DOMException("Export cancelled. Your edits are retained.", "AbortError");
            acknowledged = true;
            plan = planExports(outputs, { generic: generic() });
          }
          for (let index = 0; index < plan.length; index++) {
            const part = plan[index];
            if (controller.signal.aborted) throw new DOMException("Export stopped.", "AbortError");
            onProgress(`Preparing download ${index + 1} of ${plan.length}`);
            const blob = part.kind === "file" ? part.entries[0].blob : await Studio.zip.build(part.entries);
            if (blob.size !== part.size || blob.size > (part.kind === "zip" ? C.zipBytes : C.ordinaryBytes)) throw new Error("The final export size differs from its checked plan. Nothing more was sent.");
            let delay;
            while ((delay = budgetDelay(recent, blob.size, part.kind === "zip", now())) > 0) {
              onProgress("Waiting for the host's shared download budget…");
              await wait(delay, controller.signal);
            }
            recent = recent.filter((entry) => now() - entry.at < C.windowMs);
            const bytes = await blob.arrayBuffer();
            if (controller.signal.aborted) throw new DOMException("Export stopped.", "AbortError");
            recent.push({ at: now(), size: blob.size });
            await bridge.save(bytes, part.name, { signal: controller.signal });
            started++;
          }
          return { count: outputs.length, filename: plan[0].name, downloads: started };
        } catch (error) {
          if (started) throw new Error(`${started} download${started === 1 ? "" : "s"} started before this export stopped. Remaining files were not confirmed; all edits are retained. ${error.message}`);
          throw error;
        } finally { active = null; onProgress(""); }
      }
    });
  }

  Studio.appBlockExports = Object.freeze({ safeFilename, zipSize, planExports, budgetDelay, createExporter });
})();
