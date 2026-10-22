/* Offline edition 1c97e782f256d4809b8178ffc58e12ccafd122bb2f4e38c01725f970c5c255bf. Generated from the complete build. */
const CACHE = "shiguzhai-1c97e782f256d4809b8178ffc58e12ccafd122bb2f4e38c01725f970c5c255bf";
const EDITION = "1c97e782f256d4809b8178ffc58e12ccafd122bb2f4e38c01725f970c5c255bf";
const BASE = "/shiguzhai/";
const FILES = ["/shiguzhai/assets/index-CBatit1h.css","/shiguzhai/assets/index-CpVmswLQ.js","/shiguzhai/favicon.svg","/shiguzhai/fonts/Atkinson-OFL.txt","/shiguzhai/fonts/AtkinsonHyperlegibleNext.ttf","/shiguzhai/fonts/NotoCJK-OFL.txt","/shiguzhai/fonts/NotoSansCJK-subset.woff2","/shiguzhai/index.html","/shiguzhai/sources/li-2024-figure-1.jpg","/shiguzhai/sources/li-2024-figure-2.jpg","/shiguzhai/sources/li-2024-figure-3.jpg","/shiguzhai/sources/li-2024-figure-5.jpg","/shiguzhai/sources/li-2024-shiguzhai.pdf","/shiguzhai/sources/li-2024-table-1.html","/shiguzhai/sources/li-2024-table-1.jpg"];
const INTEGRITY = {"/shiguzhai/assets/index-CBatit1h.css":"sha256-suGaJYvJqaDQmYS3jQgvadJyt4VG4DAKmv8uHXMlwR0=","/shiguzhai/assets/index-CpVmswLQ.js":"sha256-Vn+atRjG9hpQj/5BrcjJercJIOOHxjvM1x40zpYLdI0=","/shiguzhai/favicon.svg":"sha256-t4/XB9ig2IK34UQt7PbdTM4cH/scz/ufJ8HXTTohTUw=","/shiguzhai/fonts/Atkinson-OFL.txt":"sha256-rKakKFgJZdIpfRtxgELdQnwqlEPs47DQLXWOFh4MQDA=","/shiguzhai/fonts/AtkinsonHyperlegibleNext.ttf":"sha256-WkVdHPoJm2AatwdRu5Zz6P4YVNxFAMgOGiINDXXjF0U=","/shiguzhai/fonts/NotoCJK-OFL.txt":"sha256-oBo5GzzERnYpjkWfykoK/awBHSIZ/svnu49qD37OI+Q=","/shiguzhai/fonts/NotoSansCJK-subset.woff2":"sha256-bN9KQ1f3K13m5j92kZ387B7/W5KfA7TY9J3hb5F0CHc=","/shiguzhai/index.html":"sha256-6GOAmfHQPdjhF0FXwOuCeEW0Zt2eQY5Ui3in7mmdwQ8=","/shiguzhai/sources/li-2024-figure-1.jpg":"sha256-Du5D2VQ9g+r9LZUz8ulpNVlRV1+daNORQoebJTmPaks=","/shiguzhai/sources/li-2024-figure-2.jpg":"sha256-ZKGq3AyP1KAO6OW9Rfs2vklacxBsDf7l7tv265ljXmM=","/shiguzhai/sources/li-2024-figure-3.jpg":"sha256-P/VppCfQDRgSF857A5JNO0Tpkpts1OqFN4bEEyZMhL8=","/shiguzhai/sources/li-2024-figure-5.jpg":"sha256-8Bx2m06HgaFsy8v46Lp3zmzOte4ZxObG8lZ/U0cIwT0=","/shiguzhai/sources/li-2024-shiguzhai.pdf":"sha256-Qx6sx/dfM4NJEJFh8yC9nxpuItp7E9sz+rX3Wcu3Lt0=","/shiguzhai/sources/li-2024-table-1.html":"sha256-Cvp5xrg1RIDNmp5pdTbT9PxHsq+NJhglRCJHvzZzz+I=","/shiguzhai/sources/li-2024-table-1.jpg":"sha256-3fZ026biLBNxg7CIafu5yMaECNNPYR/oN6FpAYLcOWg="};
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
  if (event.data?.type !== "SHIGUZHAI_INSPECT" || !event.ports[0]) return;
  event.waitUntil(caches.open(CACHE).then(cache => cache.keys()).then(keys => {
    const saved = new Set(keys.map(request => new URL(request.url).pathname));
    event.ports[0].postMessage({ type: "SHIGUZHAI_EDITION", edition: EDITION, complete: FILES.every(file => saved.has(file)) });
  }).catch(() => event.ports[0].postMessage({ type: "SHIGUZHAI_EDITION", edition: EDITION, complete: false })));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === "navigate") {
    const page = url.pathname === BASE || url.pathname === BASE + "index.html" ? BASE + "index.html" : url.pathname;
    if (FILES.includes(page)) event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(page))));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
});
