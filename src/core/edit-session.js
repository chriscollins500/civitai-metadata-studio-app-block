(() => {
  "use strict";
  const Studio = globalThis.CMStudio ||= {};
  const schema = "civitai-metadata-studio.edit-session";
  const limit = 16 * 1024 * 1024;
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const scalar = (value) => value === null || ["string", "number", "boolean"].includes(typeof value);

  function checkTree(value, depth = 0, budget = { nodes: 0 }) {
    if (++budget.nodes > 100_000 || depth > 32) throw new Error("The edit handoff exceeds the structural limit.");
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("The edit handoff contains an unsafe key.");
      checkTree(child, depth + 1, budget);
    }
  }

  function validateSnapshot(snapshot, record) {
    if (!object(snapshot) || !object(snapshot.fields) || !Array.isArray(snapshot.resources)
        || snapshot.resources.length > 10_000 || !object(snapshot.metadataSelections) || !Array.isArray(snapshot.conflicts)) {
      throw new Error("The edit handoff has invalid edit data.");
    }
    for (const [key, value] of Object.entries(snapshot.fields)) {
      if (!Object.hasOwn(record.fields, key) || !object(value) || !scalar(value.value)
          || ["source", "evidence", "confidence"].some((name) => typeof value[name] !== "string")
          || typeof value.edited !== "boolean") throw new Error("The edit handoff has an invalid generation field.");
    }
    if (Object.keys(snapshot.fields).length !== Object.keys(record.fields).length) throw new Error("The edit handoff is missing generation fields.");
    for (const [key, selected] of Object.entries(snapshot.metadataSelections)) {
      if (!Object.hasOwn(record.metadataSelections, key) || typeof selected !== "boolean") throw new Error("The edit handoff has an invalid metadata selection.");
    }
    if (snapshot.conflicts.some((conflict) => !object(conflict) || typeof conflict.id !== "string"
        || !Object.hasOwn(record.fields, conflict.field) || !Array.isArray(conflict.alternatives)
        || !object(conflict.chosen) || typeof conflict.resolved !== "boolean")) throw new Error("The edit handoff has invalid conflict data.");
  }

  async function create(records, options = {}) {
    if (!Array.isArray(records) || !records.length || records.length > 1000) throw new Error("Select between 1 and 1,000 inspected images for an edit handoff.");
    const images = [];
    for (const record of records) {
      const snapshot = Studio.editing.capture(record);
      // An editable handoff is never verification authority at its destination.
      const candidate = { ...record };
      Studio.editing.restore(candidate, snapshot);
      for (const resource of candidate.resources) Studio.editing.invalidate(resource, candidate);
      images.push({ sha256: await Studio.sha256.hashBlob(record.file, options), format: record.format, edits: Studio.editing.capture(candidate) });
    }
    const blob = new Blob([JSON.stringify({ schema, schemaVersion: 1, images })], { type: "application/json" });
    if (blob.size > limit) throw new Error("The edit handoff exceeds 16 MiB. Save smaller selections.");
    return blob;
  }

  async function prepare(file, records, options = {}) {
    if (!(file instanceof Blob) || file.size > limit) throw new Error("Choose an edit handoff no larger than 16 MiB.");
    let doc;
    try { doc = JSON.parse(await file.text()); } catch { throw new Error("The edit handoff is not valid JSON."); }
    checkTree(doc);
    if (!object(doc) || doc.schema !== schema || doc.schemaVersion !== 1 || !Array.isArray(doc.images)
        || !doc.images.length || doc.images.length > 1000) throw new Error("This is not a supported edit handoff.");
    const sources = new Map();
    for (const record of records) {
      const hash = await Studio.sha256.hashBlob(record.file, options);
      if (sources.has(hash)) throw new Error("Open each original image only once before resuming edits.");
      sources.set(hash.toLowerCase(), record);
    }
    const updates = [];
    const matched = new Set();
    for (const image of doc.images) {
      if (!object(image) || typeof image.sha256 !== "string" || !/^[0-9a-f]{64}$/iu.test(image.sha256)) throw new Error("The edit handoff has an invalid original-file hash.");
      const hash = image.sha256.toLowerCase();
      const record = sources.get(hash);
      if (!record || record.format !== image.format || matched.has(record)) throw new Error("Open the exact original files for this handoff. Nothing was changed.");
      matched.add(record);
      validateSnapshot(image.edits, record);
      const candidate = { ...record };
      Studio.editing.restore(candidate, image.edits);
      candidate.resources = candidate.resources.map((resource) => {
        if (!object(resource)) throw new Error("The edit handoff has an invalid resource.");
        const normalized = Studio.canonical.normalizeResource(resource, "edit_handoff");
        if (!normalized) throw new Error("The edit handoff has an invalid resource.");
        normalized.removed = Boolean(resource.removed);
        Studio.editing.invalidate(normalized, candidate);
        return normalized;
      });
      candidate.verification = { status: "unverified", checked: 0, verified: 0, unresolved: candidate.resources.filter((resource) => !resource.removed).length, errors: [] };
      candidate.dirty = true;
      const errors = Studio.canonical.validate(candidate);
      if (errors.length) throw new Error("The edit handoff contains invalid field values. Nothing was changed.");
      Studio.canonical.buildManifest(candidate);
      updates.push({ record, edits: Studio.editing.capture(candidate) });
    }
    return updates;
  }

  Studio.editSession = Object.freeze({ create, prepare, schema, limit });
})();
