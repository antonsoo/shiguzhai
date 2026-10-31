/** Verify retained source bytes and bound both the response and its body. */
export async function verifiedBytes(
  path: string,
  expectedHash: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Source request timed out", "TimeoutError"));
  }, 12000);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        `A retained file is unavailable (HTTP ${response.status}). Reconnect and repair the offline copy.`,
      );
    const bytes = await response.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== expectedHash)
      throw new Error(
        "A source or font differs from this edition. Repair the offline files or reload the updated edition.",
      );
    if (signal?.aborted) throw signal.reason;
    return bytes;
  } catch (error) {
    if (!signal?.aborted) window.dispatchEvent(new Event("shiguzhai:asset-failure"));
    if (timedOut)
      throw new Error(
        "A source request took too long. Your choices are kept; reconnect and try saving again.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export function dataUrl(bytes: ArrayBuffer, mime: string): string {
  const array = new Uint8Array(bytes);
  let binary = "";
  for (let offset = 0; offset < array.length; offset += 8192)
    binary += String.fromCharCode(...array.subarray(offset, offset + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}
