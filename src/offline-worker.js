/* Build constants are prepended by the Vite plugin. */
const byPath = new Map(FILES.map((file) => [file.url, file]));
let lastComplete;
let inspection;
let repairing;

async function matches(response, file) {
  if (!response?.ok) return false;
  try {
    const bytes = await response.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    return bytes.byteLength === file.bytes && hash === file.hash;
  } catch {
    return false;
  }
}
async function notify(complete) {
  if (lastComplete === complete) return;
  lastComplete = complete;
  for (const client of await self.clients.matchAll({ type: "window" }))
    client.postMessage({
      type: complete ? "SHIGUZHAI_RESTORED" : "SHIGUZHAI_INVALIDATED",
      edition: EDITION,
    });
}
async function inventory() {
  if (!inspection)
    inspection = (async () => {
      const missing = (
        await Promise.all(
          FILES.map(async (file) =>
            (await matches(await caches.match(file.url, { cacheName: CACHE }), file))
              ? null
              : file.url,
          ),
        )
      ).filter(Boolean);
      await notify(missing.length === 0);
      return {
        type: "SHIGUZHAI_EDITION",
        edition: EDITION,
        complete: missing.length === 0,
        files: FILES.length,
        missing,
      };
    })().finally(() => {
      inspection = undefined;
    });
  return inspection;
}
async function fetchFile(file) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(file.url, { cache: "reload", signal: controller.signal });
    if (!(await matches(response.clone(), file))) throw new Error("File differs from this edition");
    return response;
  } finally {
    clearTimeout(timer);
  }
}
// A retiring worker must not restore its cache after a newer worker takes over.
// The active object is shared through the registration; ask it for its identity.
async function ownsRegistration() {
  const worker = self.registration.active;
  if (!worker) return false;
  const channel = new MessageChannel();
  let timer;
  try {
    return await new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), 2000);
      channel.port1.onmessage = (event) => resolve(event.data?.edition === EDITION);
      worker.postMessage({ type: "SHIGUZHAI_WHO" }, [channel.port2]);
    });
  } finally {
    clearTimeout(timer);
    channel.port1.close();
    channel.port2.close();
  }
}
async function store(file, response) {
  if (!(await ownsRegistration())) return;
  const cache = await caches.open(CACHE);
  await cache.put(file.url, response);
  if (!(await ownsRegistration())) await caches.delete(CACHE);
}
async function repair() {
  if (!repairing)
    repairing = (async () => {
      await notify(false);
      const state = await inventory();
      if (!state.complete && (await ownsRegistration())) {
        await Promise.allSettled(
          state.missing.map(async (url) => {
            const file = byPath.get(url);
            await store(file, await fetchFile(file));
          }),
        );
      }
      return inventory();
    })().finally(() => {
      repairing = undefined;
    });
  return repairing;
}
async function savedResponse(file) {
  const saved = await caches.match(file.url, { cacheName: CACHE });
  if (await matches(saved?.clone(), file)) return saved;
  await notify(false);
  return undefined;
}
function unavailable() {
  return new Response(
    "This edition's file is unavailable. Reconnect and use Repair offline files in the lesson.",
    {
      status: 503,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    },
  );
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await Promise.all(FILES.map(async (file) => cache.put(file.url, await fetchFile(file))));
        await self.skipWaiting();
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("shiguzhai-") && name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHIGUZHAI_WHO") {
    event.ports[0]?.postMessage({ edition: EDITION });
    return;
  }
  if (event.data?.type === "SHIGUZHAI_ACTIVATE") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  const port = event.ports[0];
  if (!port || !["SHIGUZHAI_INSPECT", "SHIGUZHAI_REPAIR"].includes(event.data?.type)) return;
  event.waitUntil(
    (async () => {
      // Old documents may inspect the new edition but cannot initiate its repair.
      const state =
        event.data.type === "SHIGUZHAI_REPAIR" && event.data.edition === EDITION
          ? await repair()
          : await inventory();
      port.postMessage(state);
    })().catch(async () => {
      await notify(false);
      port.postMessage({
        type: "SHIGUZHAI_EDITION",
        edition: EDITION,
        complete: false,
        files: FILES.length,
      });
    }),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const file = byPath.get(url.pathname === BASE ? `${BASE}index.html` : url.pathname);
  if (!file) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        try {
          const network = await fetch(event.request, { signal: controller.signal });
          if (network.status !== 200 || !network.headers.get("Content-Type")?.includes("text/html"))
            throw new Error("Document unavailable");
          // Reading the complete body bounds a response that sends headers then stalls.
          const bytes = await network.arrayBuffer();
          // Maintenance pages can be returned as HTTP 200. A production room
          // carries an edition marker, including when it is a newer edition.
          if (
            !/<meta\s+name="shiguzhai-edition"\s+content="[a-f0-9]{64}"/.test(
              new TextDecoder().decode(bytes),
            )
          )
            throw new Error("Response is not a workshop edition");
          const headers = new Headers(network.headers);
          headers.delete("Content-Length");
          headers.delete("Content-Encoding");
          return new Response(bytes, {
            status: network.status,
            statusText: network.statusText,
            headers,
          });
        } catch {
          return (await savedResponse(file)) || unavailable();
        } finally {
          clearTimeout(timer);
        }
      })(),
    );
    return;
  }
  const result = (async () => {
    const saved = await savedResponse(file);
    if (saved) return saved;
    try {
      const response = await fetchFile(file);
      await store(file, response.clone());
      if (lastComplete === false) await inventory();
      return response;
    } catch {
      return unavailable();
    }
  })();
  event.respondWith(result);
  event.waitUntil(result.then(() => undefined));
});
