// biome-ignore-all lint/performance/useDomNodeTextContent: Observe the learner's actual recovery messages.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";

const base = "https://antonsoo.github.io/shiguzhai/";
const output = path.resolve(process.argv[2] ?? "/tmp/shiguzhai-public-recovery");
await mkdir(output, { recursive: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = "sources/li-2024-table-1.jpg";
const expected = sha256(await readFile(`public/${source}`));
const edition = (await readFile("dist/sw.js", "utf8")).match(/const EDITION = "([a-f0-9]+)"/)[1];
const records = [];
async function inventory(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => reject(new Error("Worker inspection timed out")), 12000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timer);
          channel.port1.close();
          channel.port2.close();
          resolve(event.data);
        };
        navigator.serviceWorker.controller.postMessage({ type: "SHIGUZHAI_INSPECT" }, [
          channel.port2,
        ]);
      }),
  );
}
async function ready(page) {
  await page.waitForFunction(
    () =>
      document.querySelector("#offline-status").textContent === "Bells & evidence saved offline",
  );
}
async function incomplete(page) {
  await page.waitForFunction(() =>
    document.querySelector("#offline-status").textContent.includes("incomplete"),
  );
}
for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
  const browser = await launcher.launch();
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        acceptDownloads: true,
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          other = await context.newPage(),
          errors = [];
        for (const room of [page, other])
          room.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          `${base}?bell=I&a=280&b=269&values=all&reference=439.524&against=439.523#reference`,
        );
        await ready(page);
        await other.goto(`${base}shuang.html?bell=p08&strike=22`);
        await ready(other);
        const before = await inventory(page);
        assert(before.complete && before.edition === edition);
        await page.evaluate(
          async ({ edition, url }) => {
            const cache = await caches.open(`shiguzhai-${edition}`);
            await cache.put(
              url,
              new Response("Private audit substitution", {
                headers: { "Content-Type": "image/jpeg" },
              }),
            );
          },
          { edition, url: new URL(source, base).href },
        );
        const broken = await inventory(page);
        assert(!broken.complete && broken.missing.includes(new URL(source, base).pathname));
        await incomplete(page);
        await incomplete(other);
        await context.setOffline(true);
        await page.locator("#offline-repair").click();
        await page.waitForFunction(() => !document.querySelector("#offline-repair").disabled);
        assert.equal((await inventory(page)).complete, false);
        await incomplete(page);
        await incomplete(other);
        await page
          .locator("#offline-status")
          .evaluate((element) => element.parentElement.setAttribute("data-recovery-review", ""));
        await page
          .locator("[data-recovery-review]")
          .screenshot({ path: path.join(output, `${engine}-${width}-incomplete.png`) });
        await page.evaluate(() => {
          window.recoveryEvents = [];
          const capture = () =>
            window.recoveryEvents.push({
              at: performance.now(),
              active: document.activeElement.id,
              status: document.querySelector("#offline-status").textContent,
              hidden: document.querySelector("#offline-repair").hidden,
              disabled: document.querySelector("#offline-repair").disabled,
            });
          new MutationObserver(capture).observe(
            document.querySelector("#offline-status").parentElement,
            { subtree: true, childList: true, attributes: true },
          );
          capture();
        });
        await page.locator("#offline-repair").focus();
        await context.setOffline(false);
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => document.activeElement.id), "offline-repair");
        await page.keyboard.press("Enter");
        await ready(page).catch(async (error) => {
          console.log(JSON.stringify(await page.evaluate(() => window.recoveryEvents), null, 2));
          throw error;
        });
        await ready(other);
        const recovered = await inventory(page);
        assert(recovered.complete && recovered.edition === edition);
        const bytes = await page.evaluate(
          async (url) => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),
          new URL(source, base).href,
        );
        assert.equal(sha256(Buffer.from(bytes)), expected);
        await context.setOffline(true);
        await page.reload();
        await other.reload();
        await ready(page);
        await ready(other);
        assert.match(
          await page.locator("#reference-result").innerText(),
          /Held 439.523 Hz: 9 keys. Current 439.524 Hz: 10 keys/,
        );
        assert.equal(await other.locator("#bell").inputValue(), "p08");
        assert.equal(await other.locator("#strike").inputValue(), "22");
        const downloads = [];
        for (const [room, selector, name] of [
          [page, "#save-reading", "reading"],
          [other, "#save-study", "study"],
        ]) {
          const event = room.waitForEvent("download");
          await room.locator(selector).click();
          const download = await event;
          assert.equal(await download.failure(), null);
          const target = path.join(output, `${engine}-${width}-${name}.html`);
          await download.saveAs(target);
          const html = await readFile(target);
          assert(html.includes(Buffer.from("data:image/jpeg;base64,")));
          downloads.push({
            artifact: path.basename(target),
            bytes: html.length,
            sha256: sha256(html),
          });
          assert(await room.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        }
        assert.deepEqual(errors, []);
        records.push({
          engine,
          version: browser.version(),
          width,
          edition,
          bothRoomsInvalidate: true,
          disconnectedRepairCannotClaimSuccess: true,
          keyboardRepairFromCanonicalOrigin: true,
          reconnectPreservesRepairFocus: true,
          restoredSourceSha256: expected,
          bothRoomsReloadAndExportOffline: true,
          settingsPreserved: true,
          downloads,
          errors,
        });
        console.log(
          `${engine} ${width}: public repair rejects offline attempt, restores exact source online, then both rooms export offline`,
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  path.join(output, "receipt.json"),
  `${JSON.stringify(
    {
      checkedAtUtc: new Date().toISOString(),
      base,
      records,
      scope:
        "Canonical public site, no response interception. Only this isolated browser context's Cache Storage is modified. A disconnected repair is refused; reconnecting repairs from the real origin. Offline means Playwright context.setOffline, separately from the origin-disabled local upgrade test.",
    },
    null,
    2,
  )}\n`,
);
