import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const [previousDirectory, previousReceipt, output] = process.argv.slice(2);
assert(
  previousDirectory && previousReceipt && output,
  "Supply the captured prior hosted build, its canonical receipt and an output receipt.",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function inventory(directory, prefix = "") {
  const files = new Map();
  for (const item of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const name = prefix + item.name;
    if (item.isDirectory()) {
      for (const [key, bytes] of await inventory(directory, `${name}/`)) files.set(key, bytes);
    } else files.set(name, await readFile(path.join(directory, name)));
  }
  return files;
}
const previous = await inventory(previousDirectory),
  current = await inventory("dist"),
  receipt = JSON.parse(await readFile(previousReceipt, "utf8"));
assert.equal(receipt.state, "verified");
assert.equal(receipt.expectedFileCount, previous.size);
for (const record of receipt.files) assert.equal(hash(previous.get(record.path)), record.sha256);
const edition = JSON.parse(
  current
    .get("sw.js")
    .toString()
    .match(/const EDITION = ("[a-f0-9]+");/)[1],
);
let files = previous,
  held = false,
  available = true;
const waiting = [];
const types = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".json": "application/json",
};
const server = http.createServer((req, res) => {
  if (!available) {
    req.socket.destroy();
    return;
  }
  const url = new URL(req.url, "http://localhost"),
    name = decodeURIComponent(url.pathname).replace(/^\/shiguzhai\//, "") || "index.html";
  if (!url.pathname.startsWith("/shiguzhai/") || name.includes("..") || !files.has(name)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const bytes = files.get(name),
    finish = () => {
      if (res.destroyed) return;
      res.writeHead(200, {
        "Content-Type": types[path.extname(name)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(bytes);
    };
  if (held && name === "sources/li-2024-shiguzhai.pdf") waiting.push(finish);
  else finish();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/shiguzhai/`;
const release = () => {
  held = false;
  for (const finish of waiting.splice(0)) finish();
};
async function saved(page) {
  await page.waitForFunction(
    () => document.querySelector("#offline-status")?.textContent?.includes("saved offline"),
    null,
    { timeout: 30000 },
  );
}
async function inspect(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const channel = new MessageChannel(),
          timer = setTimeout(() => reject(new Error("Inspection timeout")), 4000);
        channel.port1.onmessage = (e) => {
          clearTimeout(timer);
          resolve(e.data);
          channel.port1.close();
          channel.port2.close();
        };
        navigator.serviceWorker.controller.postMessage({ type: "SHIGUZHAI_INSPECT" }, [
          channel.port2,
        ]);
      }),
  );
}
const records = [];
try {
  for (const [name, engine] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ]) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({ acceptDownloads: true });
      try {
        files = previous;
        available = true;
        held = name === "chromium";
        const page = await context.newPage();
        await page.goto(base, { waitUntil: "domcontentloaded" });
        let reproducedTimeout = null;
        if (held) {
          await page.waitForFunction(
            () => document.querySelector("#offline-status")?.textContent?.includes("unavailable"),
            null,
            { timeout: 12000 },
          );
          reproducedTimeout = await page.locator("#offline-status").textContent();
          release();
          await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
            timeout: 15000,
          });
          assert.equal(await page.locator("#offline-status").textContent(), reproducedTimeout);
        } else await saved(page);
        const old = await inspect(page);
        assert(old.complete);
        assert.notEqual(old.edition, edition);
        files = current;
        held = true;
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.evaluate(() => {
          void navigator.serviceWorker
            .getRegistration()
            .then((registration) => registration.update());
        });
        await page.waitForFunction(
          () => document.querySelector("#offline-status")?.textContent?.includes("updated"),
          null,
          { timeout: 10000 },
        );
        await page.waitForTimeout(9000);
        const pending = await page.locator("#offline-status").textContent();
        assert.match(pending, /Downloading the updated/);
        assert.doesNotMatch(pending, /saved offline|unavailable/);
        release();
        await saved(page);
        const now = await inspect(page);
        assert.equal(now.edition, edition);
        assert(now.complete);
        assert.deepEqual(await page.evaluate(() => caches.keys()), [`shiguzhai-${edition}`]);
        available = false;
        await page.getByRole("link", { name: "Craft bench", exact: true }).click();
        await saved(page);
        assert.equal(await page.locator("#bell").inputValue(), "p08");
        await page.locator("#listen-b").click();
        await page.locator("#stop").click();
        const event = page.waitForEvent("download");
        await page.locator("#save-study").click();
        assert.equal(await (await event).failure(), null);
        await page.getByRole("link", { name: "Shiguzhai bells", exact: true }).click();
        assert.match(await page.locator("#title").textContent(), /Ten bells/);
        await saved(page);
        await page.evaluate(async () => {
          for (const key of await caches.keys()) await caches.delete(key);
        });
        const missing = await inspect(page);
        assert.equal(missing.complete, false);
        assert.deepEqual(await page.evaluate(() => caches.keys()), []);
        records.push({
          browser: name,
          version: browser.version(),
          priorHostedEdition: old.edition,
          priorTimeoutReproduced: reproducedTimeout,
          delayedUpgradeSeconds: 9,
          statusAfterFormerTimeout: pending,
          currentEdition: now.edition,
          currentComplete: true,
          onlyCurrentCacheAfterActivation: true,
          originDisabledAfterUpgrade: true,
          twoRoomsAndNewExportOffline: true,
          inspectionAfterCacheDeletion: { complete: false, recreatedCaches: 0 },
        });
        console.log(
          `${name}: published one-room edition upgraded after a 9-second source delay; both rooms and export work with the origin disabled`,
        );
      } finally {
        release();
        available = true;
        await context.close();
      }
      if (name === "chromium") {
        const context = await browser.newContext();
        try {
          files = current;
          held = true;
          const page = await context.newPage();
          await page.goto(`${base}shuang.html`, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(9000);
          const pending = await page.locator("#offline-status").textContent();
          assert.match(pending, /Downloading|Finishing/);
          assert.doesNotMatch(pending, /unavailable|saved offline/);
          release();
          await saved(page);
          records.push({
            browser: name,
            scenario: "cold two-room installation",
            delayedSourceSeconds: 9,
            statusAfterFormerTimeout: pending,
            eventuallyComplete: true,
          });
        } finally {
          release();
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    output,
    `${JSON.stringify({ checkedAtUtc: new Date().toISOString(), priorFixture: { canonicalURL: receipt.baseURL, canonicalCheckedAt: receipt.checkedAtUtc, files: previous.size, workerSha256: hash(previous.get("sw.js")) }, currentLocalBuild: { files: current.size, workerSha256: hash(current.get("sw.js")), edition }, records, scope: "Prior bytes independently matched canonical hosted files before this review. Local HTTP fixture controls the source delay and upgrade, then disables its origin. Cache deletion checks that inspection does not recreate a retired or missing cache. These are local upgrade observations, separate from publication of the new build." }, null, 2)}\n`,
  );
} finally {
  release();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
