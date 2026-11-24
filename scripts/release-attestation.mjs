export const normalizeBuildText = (text) => text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

export function buildDate(epoch, now = new Date()) {
  if (epoch === undefined) return now.toISOString().slice(0, 10);
  if (typeof epoch !== "string" || !/^\d+$/u.test(epoch)) throw new Error("SOURCE_DATE_EPOCH must be whole Unix seconds.");
  const seconds = Number(epoch);
  const date = new Date(seconds * 1000);
  if (!Number.isSafeInteger(seconds) || !Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) throw new Error("SOURCE_DATE_EPOCH is outside the supported range.");
  return date.toISOString().slice(0, 10);
}
