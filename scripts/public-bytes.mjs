export async function readPublicBytes(url, maxBytes, { type, request = fetch } = {}) {
  const target = String(url);
  let response;
  try {
    response = await request(target, {
      cache: "no-store", credentials: "omit", redirect: "manual", signal: AbortSignal.timeout(20_000)
    });
  } catch (cause) {
    throw new Error(target + " could not be reached for verification.", { cause });
  }
  return readResponseBytes(target, response, maxBytes, type);
}

export async function readResponseBytes(target, response, maxBytes, type) {
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(target + " returned HTTP " + response.status + ".");
  }
  const media = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (type && media !== type) {
    await response.body?.cancel();
    throw new Error(target + " did not return " + type + ".");
  }

  if (!response.body) throw new Error(target + " returned no body.");
  const parts = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > maxBytes) throw new Error(target + " exceeded its " + maxBytes + "-byte verification limit.");
    parts.push(chunk);
  }
  return Buffer.concat(parts, bytes);
}
