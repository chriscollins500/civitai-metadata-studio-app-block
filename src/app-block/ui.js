(() => {
  "use strict";
  const Studio = globalThis.CMStudio ||= {};
  const byId = (id) => document.getElementById(id);
  byId("refreshReferenceButton").textContent = "Load reference lists";
  byId("refreshReferenceButton").title = `Official Civitai reference snapshot dated ${Studio.environment.referenceData.referenceSource.date}. All fields remain editable.`;
  const status = byId("hostConnection");
  const bridge = new Studio.AppBlockBridge(window, {
    onChange: (value) => {
      status.textContent = value === "ready" ? "Host ready · session memory only" : "Host suspended · edits retained";
      if (value === "suspended") {
        exporter.cancel();
        Studio.state.verificationController?.abort();
        Studio.state.hashingController?.abort();
      }
    },
    onTheme: (value) => {
      document.documentElement.dataset.theme = value;
      byId("themeButton").setAttribute("aria-label", `Use ${value === "dark" ? "light" : "dark"} theme`);
    }
  });
  Studio.environment.civitaiHostOrigin = () => bridge.origin;
  const dialog = byId("hostSaveDialog");
  const accept = byId("confirmHostSave");
  const acknowledgement = byId("hostAcknowledgement");
  let confirmPending = false;
  const confirm = ({ plan, needsAcknowledgement }) => new Promise((resolve) => {
    if (confirmPending) { resolve(false); return; }
    confirmPending = true;
    const previousFocus = document.activeElement;
    byId("hostAcknowledgementLabel").hidden = !needsAcknowledgement;
    acknowledgement.checked = !needsAcknowledgement;
    accept.disabled = needsAcknowledgement;
    const zipped = plan.some((part) => part.kind === "zip");
    byId("hostSaveTitle").textContent = zipped ? "Confirm lossless ZIP download" : "Save through Civitai";
    byId("hostPackageSummary").textContent = zipped
      ? `${plan.length} lossless ZIP${plan.length === 1 ? "" : "s"} will contain ${plan.reduce((sum, part) => sum + part.entries.length, 0)} complete files. No image will be resized or re-encoded.`
      : `The finished file is ${Studio.util.formatBytes(plan[0].size)}.`;
    accept.textContent = plan.length > 1 ? "Start these downloads" : "Start download";
    const changed = () => { accept.disabled = needsAcknowledgement && !acknowledgement.checked; };
    const approved = () => { if (!accept.disabled) dialog.close("allow"); };
    const cancelled = () => dialog.close("cancel");
    const closed = () => {
      acknowledgement.removeEventListener("change", changed);
      accept.removeEventListener("click", approved);
      byId("cancelHostSave").removeEventListener("click", cancelled);
      confirmPending = false;
      previousFocus?.focus();
      resolve(dialog.returnValue === "allow" && (!needsAcknowledgement || acknowledgement.checked));
    };
    acknowledgement.addEventListener("change", changed);
    accept.addEventListener("click", approved);
    byId("cancelHostSave").addEventListener("click", cancelled);
    dialog.addEventListener("close", closed, { once: true });
    dialog.showModal();
    byId("cancelHostSave").focus();
  });
  const exporter = Studio.appBlockExports.createExporter({
    bridge, confirm, generic: () => byId("hostGenericNames").checked,
    onProgress: (message) => {
      byId("stopHostExport").disabled = !message;
      byId("stopHostExport").hidden = !message;
      if (message) byId("hostConnection").textContent = message;
      else status.textContent = bridge.suspended ? "Host suspended · edits retained" : bridge.connected ? "Host ready · session memory only" : "Waiting for the Civitai host";
    }
  });
  Studio.environment.exportFiles = (outputs) => exporter.exportFiles(outputs);
  Studio.environment.download = async (blob, filename) => {
    const result = await exporter.exportFiles([{ blob, name: filename }]);
    Studio.state.announce("Download started. Check the downloaded file before closing this tab.", "success");
    return result;
  };
  byId("stopHostExport").addEventListener("click", () => exporter.cancel());
  byId("copyStandaloneUrl").addEventListener("click", async () => {
    const input = byId("standaloneUrl");
    input.focus(); input.select();
    try { await navigator.clipboard.writeText(Studio.appBlockContract.standalone); Studio.state.announce("Standalone repository URL copied."); }
    catch { Studio.state.announce("The standalone URL is selected. Copy it to open in your browser."); }
  });
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.getAttribute("href").startsWith("#")) return;
    event.preventDefault();
    try { bridge.navigate(anchor.href); } catch (error) { Studio.state.announce(error.message, "error"); }
  }, true);
  Studio.state.addEventListener("change", () => {
    const record = Studio.state.current;
    const node = byId("hostFeasibility");
    node.dataset.tone = record && record.size > Studio.appBlockContract.ordinaryBytes ? "warning" : "normal";
    if (!record) { node.textContent = "Open images locally. Use standalone if you do not want exports to reach Civitai's page."; return; }
    if (record.size > Studio.appBlockContract.zipBytes - 1024) node.textContent = "This source may exceed the hosted ZIP limit. Use standalone before extensive editing, or save a hash-bound edit handoff; its metadata also passes to the parent on export.";
    else if (record.size > Studio.appBlockContract.ordinaryBytes) node.textContent = "This image will probably need lossless ZIP packaging. The exact finished size is checked before anything is sent.";
    else node.textContent = "Finished export sizes are checked before saving. Keep your originals and verify the downloaded files.";
  });
  addEventListener("beforeunload", (event) => {
    if (exporter.active || Studio.state.entries.some((entry) => entry.record?.dirty)) { event.preventDefault(); event.returnValue = ""; }
  });
  addEventListener("pagehide", () => { exporter.cancel(); bridge.dispose(); });
  // Introspection for local diagnostics; no data is sent by this handle.
  Studio.hosted = Object.freeze({ bridge, exporter });
  byId("verifyExport").checked = true;
  byId("verifyExport").disabled = true;
  byId("verifyExport").title = "Hosted exports always verify encoded pixel and animation payloads.";
  byId("cacheDialog").querySelector(".dialog-intro").textContent = "Public resource identities are held only in bounded memory for this tab. Images, prompts, workflows, paths, and credentials are never cached.";
  byId("cacheDialog").querySelector(".cache-note").textContent = "Refreshing or closing this tab clears this cache and unsaved edits. Clearing the cache does not reset Civitai's shared rate-limit cooldown.";
})();
