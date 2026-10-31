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
        held = false;
        const page = await context.newPage(),
          other = await context.newPage();
        const errors = [];
        for (const room of [page, other])
          room.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${base}?bell=I&a=280&b=269&values=all&reference=439`);
        await saved(page);
        await other.goto(`${base}shuang.html?bell=p08&strike=22`);
        await saved(other);
        const old = await inspect(page);
        assert(old.complete);
        assert.notEqual(old.edition, edition);
        files = current;
        held = true;
        await page.goto(
          `${base}?bell=I&a=280&b=269&values=all&reference=439.524&against=439.523#reference`,
        );
        await page.evaluate(() => {
          void navigator.serviceWorker
            .getRegistration()
            .then((registration) => registration.update());
        });
        await page.waitForFunction(() =>
          document.querySelector("#offline-status").textContent.includes("Downloading the updated"),
        );
        await page.waitForTimeout(5000);
        const pending = await page.locator("#offline-status").textContent();
        assert.match(pending, /Downloading the updated/);
        assert.doesNotMatch(pending, /saved offline|unavailable/);
        release();
        await saved(page);
        const now = await inspect(page);
        assert(now.complete && now.edition === edition);
        await other.waitForFunction(() =>
          document
            .querySelector("#offline-status")
            .textContent.includes("different offline edition"),
        );
        const oldRoomMismatch = await other.locator("#offline-status").textContent();
        assert.deepEqual(await page.evaluate(() => caches.keys()), [`shiguzhai-${edition}`]);
        // Disable the origin itself, including both navigation and source files.
        available = false;
        await other.reload();
        await saved(other);
        assert.equal(await other.locator("#bell").inputValue(), "p08");
        assert.equal(await other.locator("#strike").inputValue(), "22");
        await page.reload();
        await saved(page);
        assert.match(
          await page.locator("#reference-result").textContent(),
          /Held 439.523 Hz: 9 keys. Current 439.524 Hz: 10 keys/,
        );
        const downloads = [];
        for (const [room, selector] of [
          [page, "#save-reading"],
          [other, "#save-study"],
        ]) {
          const event = room.waitForEvent("download");
          await room.locator(selector).click();
          const file = await event;
          assert.equal(await file.failure(), null);
          const bytes = await readFile(await file.path());
          assert(bytes.includes(Buffer.from("data:image/jpeg;base64,")));
          downloads.push({ room: selector, sha256: hash(bytes), bytes: bytes.length });
        }
        assert.deepEqual(errors, []);
        records.push({
          browser: name,
          version: browser.version(),
          priorHostedEdition: old.edition,
          delayedSourceSeconds: 5,
          statusDuringUpdate: pending,
          oldRoomMismatch,
          currentEdition: now.edition,
          onlyCurrentCacheAfterActivation: true,
          originDisabledAfterUpgrade: true,
          preservedReferencesAndCraftSelection: true,
          downloads,
          errors,
        });
        console.log(
          `${name}: captured public two-room edition upgraded; offline native exports and operated state retained`,
        );
      } finally {
        release();
        available = true;
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    output,
    `${JSON.stringify(
      {
        checkedAtUtc: new Date().toISOString(),
        priorFixture: {
          canonicalURL: receipt.baseURL,
          canonicalCheckedAt: receipt.checkedAtUtc,
          files: previous.size,
          workerSha256: hash(previous.get("sw.js")),
        },
        currentLocalBuild: {
          files: current.size,
          workerSha256: hash(current.get("sw.js")),
          edition,
        },
        records,
        scope:
          "Actual previous public bytes, matched at canonical URLs before this audit. Local HTTP fixture holds the new source download, then disables its origin. This establishes upgrade behavior, separately from publication.",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  release();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
