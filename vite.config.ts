import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

const base = "/shiguzhai/";

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesIn(path.join(directory, entry.name))
        : Promise.resolve([path.join(directory, entry.name)]),
    ),
  );
  return nested.flat();
}

/** One retained JSON file serves Node calculations, browser code and source downloads. */
function retainedSourceJson(file: string): Plugin {
  const sourceFile = path.resolve(file),
    virtualId = "\0retained-source-json";
  return {
    name: "retained-source-json",
    enforce: "pre",
    resolveId(id, importer) {
      if (id === virtualId) return id;
      if (importer && id.startsWith(".") && path.resolve(path.dirname(importer), id) === sourceFile)
        return virtualId;
    },
    async load(id) {
      if (id !== virtualId) return;
      this.addWatchFile(sourceFile);
      return `export default ${JSON.stringify(JSON.parse(await readFile(sourceFile, "utf8")))};`;
    },
  };
}

export default defineConfig(async ({ command }) => {
  const inputFiles = [
    ...(await filesIn("src")),
    ...(await filesIn("public")),
    "index.html",
    "shuang.html",
    "vite.config.ts",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
  ].sort();
  const inputHash = createHash("sha256");
  for (const file of inputFiles) {
    inputHash.update(file);
    inputHash.update(await readFile(file));
  }
  const edition = command === "build" ? inputHash.digest("hex") : "development";
  return {
    base,
    build: { rolldownOptions: { input: { main: "index.html", shuang: "shuang.html" } } },
    define: { __SHIGUZHAI_EDITION__: JSON.stringify(edition) },
    plugins: [
      retainedSourceJson("public/shuang/sources/measurements.json"),
      {
        name: "offline-workshop",
        apply: "build",
        async closeBundle() {
          const files = (await filesIn("dist")).filter((f) => !f.endsWith("sw.js")).sort();
          const urls = files.map(
            (file) => base + path.relative("dist", file).split(path.sep).join("/"),
          );
          const integrity = Object.fromEntries(
            await Promise.all(
              files.map(async (file, index) => [
                urls[index],
                `sha256-${createHash("sha256")
                  .update(await readFile(file))
                  .digest("base64")}`,
              ]),
            ),
          );
          await writeFile(
            "dist/sw.js",
            `/* Offline edition ${edition}. Generated from the complete build. */
const CACHE = "shiguzhai-${edition}";
const EDITION = ${JSON.stringify(edition)};
const BASE = ${JSON.stringify(base)};
const FILES = ${JSON.stringify(urls)};
const INTEGRITY = ${JSON.stringify(integrity)};
self.addEventListener("install", event => {
  // HTTP success does not establish edition identity. A stale entry page or
  // substituted scan must fail the complete install before this worker activates.
  const requests = FILES.map(url => new Request(url, { cache: "reload", integrity: INTEGRITY[url] }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("shiguzhai-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", event => {
  if (event.data?.type === "SHIGUZHAI_ACTIVATE") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type !== "SHIGUZHAI_INSPECT" || !event.ports[0]) return;
  // Inspection must not recreate a retired edition's cache after replacement.
  event.waitUntil(Promise.all(FILES.map(file => caches.match(file, { cacheName: CACHE }))).then(saved => {
    event.ports[0].postMessage({ type: "SHIGUZHAI_EDITION", edition: EDITION, complete: saved.every(Boolean) });
  }).catch(() => event.ports[0].postMessage({ type: "SHIGUZHAI_EDITION", edition: EDITION, complete: false })));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === "navigate") {
    const page = url.pathname === BASE || url.pathname === BASE + "index.html" ? BASE + "index.html" : url.pathname;
    if (FILES.includes(page)) event.respondWith(fetch(event.request).catch(() => caches.match(page, { cacheName: CACHE })));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname, { cacheName: CACHE }).then(cached => cached || fetch(event.request)));
  }
});
`,
          );
        },
      },
    ],
  };
});
