let fallbackCounter = 0;

/** Short random id. Uses Web Crypto when available (browsers, Node 19+, jsdom). */
export function createId(prefix = "b"): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `${prefix}_${cryptoObj.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  fallbackCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${fallbackCounter.toString(36)}`;
}
