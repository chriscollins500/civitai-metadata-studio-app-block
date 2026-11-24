(() => {
  "use strict";
  const Studio = globalThis.CMStudio ||= {};
  const contract = Studio.appBlockContract;
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const boundedId = (value) => typeof value === "string" && value.length > 0 && value.length <= 128;
  const theme = (value) => value === "light" || value === "dark";

  /** Framework-neutral, deliberately narrow implementation of the official wire union.
   * No SDK runtime, credentials, diagnostic pushes, storage shim, or second handshake.
   */
  class AppBlockBridge {
    constructor(win, { timeoutMs = 30_000, onChange = () => {}, onTheme = () => {} } = {}) {
      this.win = win;
      this.parent = win.parent;
      this.timeoutMs = timeoutMs;
      this.onChange = onChange;
      this.onTheme = onTheme;
      this.origin = "";
      this.instance = "";
      this.pending = new Map();
      this.connected = false;
      this.suspended = false;
      this.disposed = false;
      this.listener = (event) => this.receive(event);
      win.addEventListener("message", this.listener);
    }

    send(type, payload) {
      if (!this.connected || this.disposed || this.suspended) throw new Error("The Civitai host is not ready. Keep this session open or use standalone.");
      this.parent.postMessage({ type, payload }, this.origin);
    }

    receive(event) {
      if (this.disposed || this.parent === this.win || event.source !== this.parent
          || !contract.origins.includes(event.origin) || !object(event.data)) return;
      const { type, payload } = event.data;
      if (type === "BLOCK_INIT") {
        if (!object(payload) || !boundedId(payload.blockInstanceId) || !theme(payload.theme)
            || payload.renderMode !== "iframe" || !object(payload.context) || payload.context.slotId !== "app.page") return;
        if (this.connected) return; // First validated init wins, including its origin/instance.
        this.origin = event.origin;
        this.instance = payload.blockInstanceId;
        this.connected = true;
        this.onTheme(payload.theme);
        this.send("BLOCK_READY", { height: Math.max(40, Math.min(4000, this.win.innerHeight || 800)) });
        this.onChange("ready");
        return;
      }
      if (!this.connected || event.origin !== this.origin) return;
      if (type === "THEME_CHANGE" && object(payload) && theme(payload.theme)) {
        this.onTheme(payload.theme);
      } else if (type === "SUSPEND") {
        this.suspended = true;
        this.rejectPending("The host suspended this session. A download already sent may still start; it will not be resent.");
        this.onChange("suspended");
      } else if (type === "RESUME") {
        this.suspended = false;
        this.onChange("ready");
      } else if (type === "SAVE_IMAGE_RESULT" && object(payload) && boundedId(payload.requestId)) {
        const pending = this.pending.get(payload.requestId);
        if (!pending) return;
        if ("error" in payload && (typeof payload.error !== "string" || payload.error.length > 512)) return;
        if (!("error" in payload) && typeof payload.ok !== "boolean") return;
        clearTimeout(pending.timer);
        this.pending.delete(payload.requestId);
        if (!("error" in payload) && payload.ok === true) pending.resolve({ started: true });
        else {
          const error = new Error(payload.error === "busy"
            ? "The host is busy. No further files were sent; keep this session and try the remaining export later."
            : "The host refused the download. Your edits are retained; use the standalone version if necessary.");
          error.code = payload.error === "busy" ? "busy" : "refused";
          pending.reject(error);
        }
      }
    }

    save(bytes, filename, { signal } = {}) {
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0 || typeof filename !== "string" || filename.length > 240) {
        return Promise.reject(new Error("The prepared download is invalid."));
      }
      const zip = filename.toLowerCase().endsWith(".zip");
      if (bytes.byteLength > (zip ? contract.zipBytes : contract.ordinaryBytes)) return Promise.reject(new Error("The prepared file exceeds the host save limit. Use standalone."));
      if (this.pending.size) return Promise.reject(new Error("Wait for the current download reply before starting another."));
      if (signal?.aborted) return Promise.reject(new DOMException("Export stopped.", "AbortError"));
      return new Promise((resolve, reject) => {
        const requestId = this.win.crypto.randomUUID();
        const cleanup = () => signal?.removeEventListener("abort", onAbort);
        const settle = (callback) => (value) => { cleanup(); callback(value); };
        const fail = (message) => {
          const pending = this.pending.get(requestId);
          if (!pending) return;
          this.pending.delete(requestId);
          clearTimeout(pending.timer);
          pending.reject(new Error(message));
        };
        const onAbort = () => fail("Export stopped. An already sent download may still start; it will not be resent.");
        const timer = setTimeout(() => fail("The host did not confirm the download. Its outcome is unknown; it will not be resent automatically."), this.timeoutMs);
        this.pending.set(requestId, { resolve: settle(resolve), reject: settle(reject), timer });
        signal?.addEventListener("abort", onAbort, { once: true });
        try { this.send("SAVE_IMAGE", { requestId, bytes, filename }); }
        catch { fail("The download could not be sent to a ready Civitai host. Your edits are retained."); }
      });
    }

    navigate(rawUrl) {
      let url;
      try { url = new URL(rawUrl); } catch { throw new Error("This resource link is invalid."); }
      if (!contract.origins.includes(url.origin) || !/^\/models\/[1-9]\d*\/?$/u.test(url.pathname)
          || [...url.searchParams.keys()].some((key) => key !== "modelVersionId")
          || url.searchParams.getAll("modelVersionId").length > 1
          || (url.search && !/^[1-9]\d*$/u.test(url.searchParams.get("modelVersionId") || ""))) {
        throw new Error("Only exact Civitai model/version links can use host navigation.");
      }
      this.send("NAVIGATE", { path: `${url.pathname}${url.search}`, scope: "site", target: "new_tab" });
    }

    rejectPending(message) {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(message)); }
      this.pending.clear();
    }

    dispose() {
      this.disposed = true;
      this.win.removeEventListener("message", this.listener);
      this.rejectPending("The editor closed. An already sent download may still start.");
    }
  }

  Studio.AppBlockBridge = AppBlockBridge;
})();
