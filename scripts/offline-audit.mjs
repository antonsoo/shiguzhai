// biome-ignore-all lint/performance/useDomNodeTextContent: Verify the learner's actual status and saved files.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";

const output = path.resolve(process.argv[2] ?? "/tmp/shiguzhai-offline-audit");
await mkdir(output, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function collect(directory, prefix = "") {
  const result = new Map();
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const file = prefix + entry.name;
    if (entry.isDirectory())
      for (const [key, value] of await collect(directory, `${file}/`)) result.set(key, value);
    else result.set(file, await readFile(path.join(directory, file)));
  }
  return result;
}
const current = await collect("dist");
const edition = JSON.parse(
  current
    .get("sw.js")
    .toString()
    .match(/const EDITION = ("[a-f0-9]+");/)[1],
);
// An explicit next-edition fixture changes only the build identity. It exercises
// real service-worker replacement without inventing new historical material.
const nextEdition = hash(`${edition}:replacement-fixture`);
const next = new Map(
  [...current].map(([name, bytes]) => [
    name,
    name.endsWith(".js") || name.endsWith(".html")
      ? Buffer.from(bytes.toString().replaceAll(edition, nextEdition))
      : bytes,
  ]),
);
const nextInventory = [...next]
  .filter(([name]) => name !== "sw.js")
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, bytes]) => ({ url: `/shiguzhai/${name}`, hash: hash(bytes), bytes: bytes.length }));
next.set(
  "sw.js",
  Buffer.from(
    next
      .get("sw.js")
      .toString()
      .replace(/const FILES = .*;\n/, `const FILES = ${JSON.stringify(nextInventory)};\n`),
  ),
);
let files = current,
  navMode = "normal",
  wrongFile = "",
  holdFile = "";
let requests = [];
const held = [];
const types = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://local"),
    name = url.pathname.replace(/^\/shiguzhai\//, "") || "index.html";
  if (!url.pathname.startsWith("/shiguzhai/") || !files.has(name)) {
    response.writeHead(404).end();
    return;
  }
  // A navigation fetched by the worker can reach HTTP as same-origin.
  // Select the actual room file, then verify the fault was reached below.
  const isNavigation = name === "index.html" || name === "shuang.html";
  requests.push({
    name,
    fixture: files === next ? "next" : "current",
    mode: request.headers["sec-fetch-mode"],
    injected: isNavigation ? navMode : null,
  });
  if (isNavigation && navMode === "error") {
    response
      .writeHead(503, { "Content-Type": "text/html" })
      .end("<title>Unavailable</title>Unavailable");
    return;
  }
  if (isNavigation && navMode === "maintenance") {
    response
      .writeHead(200, { "Content-Type": "text/html" })
      .end("<title>Maintenance</title>Maintenance page");
    return;
  }
  if (isNavigation && navMode === "stall") return;
  if (isNavigation && navMode === "body-stall") {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.write("<!doctype html><title>Partial response");
    return;
  }
  const body = name === wrongFile ? Buffer.from("wrong source bytes") : files.get(name);
  const finish = () => {
    if (!response.destroyed)
      response
        .writeHead(200, {
          "Content-Type": types[path.extname(name)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        })
        .end(body);
  };
  if (name === holdFile) held.push({ name, fixture: files === next ? "next" : "current", finish });
  else finish();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/shiguzhai/`;
const READY = "Bells & evidence saved offline";
const report = {
  at: new Date().toISOString(),
  scope:
    "Local production worker; actual source corruption, two open rooms, cache eviction, repair, server errors/stalls, interrupted installation and stale repair across replacement. The next fixture changes build identity only.",
  edition,
  nextEdition,
  configurations: [],
};
function release(fixture) {
  for (let i = held.length - 1; i >= 0; i--)
    if (!fixture || held[i].fixture === fixture) held.splice(i, 1)[0].finish();
}
async function inspect(page, workerName) {
  return page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const channel = new MessageChannel(),
          timer = setTimeout(() => reject(new Error("Inventory timeout")), name ? 1000 : 14000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timer);
          resolve(event.data);
          channel.port1.close();
          channel.port2.close();
        };
        (name ? window[name] : navigator.serviceWorker.controller).postMessage(
          { type: "SHIGUZHAI_INSPECT" },
          [channel.port2],
        );
      }),
    workerName,
  );
}
async function ready(page) {
  await page.waitForFunction(
    (text) => document.querySelector("#offline-status")?.textContent === text,
    READY,
    { timeout: 25000 },
  );
}
async function incomplete(page) {
  await page.waitForFunction(() =>
    /incomplete|could not be confirmed/.test(document.querySelector("#offline-status").textContent),
  );
}
try {
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch();
    try {
      for (const width of [1440, 375]) {
        files = current;
        navMode = "normal";
        wrongFile = "";
        holdFile = "";
        release();
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
          acceptDownloads: true,
        });
        const page = await context.newPage(),
          other = await context.newPage(),
          errors = [];
        for (const p of [page, other]) p.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          `${base}?bell=I&a=280&b=269&values=all&reference=439.524&against=439.523#reference`,
        );
        await ready(page);
        await other.goto(`${base}shuang.html`);
        await ready(other);
        const initial = await inspect(page);
        assert(initial.complete && initial.files === current.size - 1);
        // A wrong-but-present JPEG must invalidate both rooms, not merely fail export.
        const sourcePath = "/shiguzhai/sources/li-2024-table-1.jpg";
        await page.evaluate(async (url) => {
          const name = (await caches.keys()).find((key) => key.startsWith("shiguzhai-"));
          await (await caches.open(name)).put(
            url,
            new Response("substituted source", { headers: { "Content-Type": "image/jpeg" } }),
          );
        }, sourcePath);
        const corrupted = await inspect(page);
        assert.equal(corrupted.complete, false);
        assert(corrupted.missing.includes(sourcePath));
        await incomplete(page);
        await incomplete(other);
        for (const [room, roomPage] of [
          ["observations", page],
          ["craft", other],
        ]) {
          await roomPage.locator("#offline-repair").scrollIntoViewIfNeeded();
          assert(
            await roomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          assert.deepEqual((await new AxeBuilder({ page: roomPage }).analyze()).violations, []);
          await roomPage
            .locator("#offline-status")
            .evaluate((element) => element.parentElement.setAttribute("data-repair-review", ""));
          await roomPage.locator("[data-repair-review]").screenshot({
            path: path.join(output, `${engine}-${width}-${room}-repair.png`),
          });
        }
        wrongFile = "sources/li-2024-table-1.jpg";
        await page.locator("#offline-repair").click();
        await page.waitForFunction(() => !document.querySelector("#offline-repair").disabled);
        assert.equal(
          (await inspect(page)).complete,
          false,
          "A 200 response with wrong bytes cannot repair a source",
        );
        wrongFile = "";
        await page.locator("#offline-repair").focus();
        await page.keyboard.press("Enter");
        await ready(page);
        await ready(other);
        assert.equal((await inspect(page)).complete, true);
        // Evict the complete cache. Two simultaneous repairs share one worker job.
        await page.evaluate(async () => {
          for (const name of await caches.keys())
            if (name.startsWith("shiguzhai-")) await caches.delete(name);
        });
        assert.equal((await inspect(page)).complete, false);
        await incomplete(page);
        await incomplete(other);
        holdFile = "fonts/Atkinson-OFL.txt";
        requests = [];
        await page.locator("#offline-repair").click();
        await other.locator("#offline-repair").click();
        await page.waitForTimeout(150);
        assert(held.length === 1, "The two repairs must share one retained-file request");
        holdFile = "";
        release();
        await ready(page);
        await ready(other);
        const repairRequests = requests.filter((request) => request.mode !== "navigate");
        assert.equal(
          repairRequests.filter((request) => request.name === "fonts/Atkinson-OFL.txt").length,
          1,
        );
        assert.equal((await inspect(page)).complete, true);
        await page
          .locator("#offline-status")
          .screenshot({ path: path.join(output, `${engine}-${width}-repaired.png`) });
        // Preserve the same URL and operated comparison through response failures.
        const navigation = [];
        for (const room of ["index.html", "shuang.html"])
          for (const mode of ["error", "maintenance", "stall", "body-stall"]) {
            navMode = "normal";
            await page.goto(
              room === "index.html"
                ? `${base}?values=all&reference=439.524&against=439.523#reference`
                : `${base}shuang.html?bell=p08&strike=22`,
            );
            await ready(page);
            navMode = mode;
            const beforeRequests = requests.length;
            const start = Date.now();
            await page.reload({ timeout: 8000 });
            assert(await page.locator(room === "index.html" ? "#reference" : "#bell").isVisible());
            const faults = requests
              .slice(beforeRequests)
              .filter((request) => request.injected === mode);
            assert(
              faults.some((request) => request.name === room),
              "The HTTP fault must actually be reached",
            );
            assert(Date.now() - start < 5000);
            if (mode.includes("stall"))
              assert(Date.now() - start >= 1900, "Exercise the worker timeout");
            if (room === "index.html")
              assert.match(
                await page.locator("#reference-result").innerText(),
                /Held 439.523 Hz: 9 keys. Current 439.524 Hz: 10 keys/,
              );
            navigation.push({
              room,
              mode,
              elapsedMs: Date.now() - start,
              injectedRequests: faults.length,
            });
          }
        navMode = "normal";
        await page.goto(base);
        await ready(page);
        await context.setOffline(true);
        await page.reload();
        await ready(page);
        const downloadEvent = page.waitForEvent("download");
        await page.locator("#save-reading").click();
        const download = await downloadEvent;
        assert.equal(await download.failure(), null);
        const saved = await readFile(await download.path(), "utf8");
        assert(saved.includes("data:image/jpeg;base64,"));
        await context.setOffline(false);
        report.configurations.push({
          engine,
          width,
          wrongPresentSourceRejected: true,
          wrong200RepairRejected: true,
          bothRoomsInvalidatedAndRestored: true,
          repairStateAccessibilityViolations: 0,
          repairStateOverflow: false,
          wholeCacheEvictionAndSharedRepair: true,
          navigation,
          offlineNativeReadingSha256: hash(Buffer.from(saved)),
          pageErrors: errors,
        });
        assert.deepEqual(errors, []);
        await context.close();
        process.stdout.write(
          `${engine} ${width}: corrupt bytes, shared repair, eviction, server errors/stalls and offline export passed\n`,
        );
      }
      // A previous repair's delayed response cannot recreate its deleted cache.
      files = current;
      navMode = "normal";
      holdFile = "";
      wrongFile = "";
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(base);
      await ready(page);
      const target = "/shiguzhai/sources/li-2024-shiguzhai.pdf";
      await page.evaluate(async (url) => {
        window.auditOldWorker = navigator.serviceWorker.controller;
        const name = (await caches.keys()).find((key) => key.startsWith("shiguzhai-"));
        await (await caches.open(name)).delete(url);
      }, target);
      assert.equal((await inspect(page)).complete, false);
      await incomplete(page);
      holdFile = "sources/li-2024-shiguzhai.pdf";
      await page.locator("#offline-repair").click();
      await page.waitForTimeout(100);
      assert(held.some((item) => item.fixture === "current"));
      files = next;
      await page.evaluate(() =>
        navigator.serviceWorker.getRegistration().then((registration) => registration.update()),
      );
      await page.waitForFunction(() =>
        navigator.serviceWorker
          .getRegistration()
          .then((registration) => Boolean(registration.installing || registration.waiting)),
      );
      await page.waitForTimeout(200);
      assert(held.some((item) => item.fixture === "next"));
      release("next");
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== window.auditOldWorker,
      );
      release("current");
      holdFile = "";
      await page.waitForFunction(() =>
        document.querySelector("#offline-status").textContent.includes("differ"),
      );
      assert.deepEqual(await page.evaluate(() => caches.keys()), [`shiguzhai-${nextEdition}`]);
      const retired = await inspect(page, "auditOldWorker").catch(() => ({
        complete: false,
        retiredNoReply: true,
      }));
      assert.equal(retired.complete, false);
      assert.deepEqual(await page.evaluate(() => caches.keys()), [`shiguzhai-${nextEdition}`]);
      await page.locator("#offline-repair").click();
      await ready(page);
      assert.equal((await inspect(page)).edition, nextEdition);
      await context.close();
      report.configurations.push({
        engine,
        lifecycle: "Actual worker replacement while the prior repair awaits a source response",
        staleRepairCannotRecreateCache: true,
        retiredInspectionDidNotRecreateCache: true,
        oldPageShowsEditionMismatch: true,
        explicitReloadReachesNewEdition: true,
      });
      process.stdout.write(`${engine}: replacement during delayed repair passed\n`);
    } finally {
      await browser.close();
    }
  }
} finally {
  release();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(path.join(output, "receipt.json"), `${JSON.stringify(report, null, 2)}\n`);
