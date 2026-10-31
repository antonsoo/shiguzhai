// biome-ignore-all lint/performance/useDomNodeTextContent: Check real recovery messages and retained settings.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const out = path.resolve(process.argv[2] ?? "/tmp/shiguzhai-export-recovery");
await mkdir(out, { recursive: true });
let heldFile = "",
  bodyStall = false,
  wrongFile = "";
const pending = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://local"),
    name = url.pathname.replace(/^\/shiguzhai\//, "") || "index.html";
  try {
    const bytes =
      name === wrongFile
        ? Buffer.from("wrong retained file")
        : await readFile(path.join("dist", name));
    const type =
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".jpg": "image/jpeg",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".json": "application/json",
      }[path.extname(name)] ?? "text/plain";
    const finish = () => {
      if (!res.destroyed) res.writeHead(200, { "Content-Type": type }).end(bytes);
    };
    if (name === heldFile) {
      if (bodyStall) {
        res.writeHead(200, { "Content-Type": type });
        res.write(bytes.subarray(0, 8));
      }
      pending.push(finish);
    } else finish();
  } catch {
    if (!res.headersSent) res.writeHead(404).end();
    else res.destroy();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/shiguzhai/`;
function release() {
  heldFile = "";
  for (const finish of pending.splice(0)) finish();
  bodyStall = false;
}
const cases = [];
try {
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch();
    try {
      for (const width of [1440, 375])
        for (const room of ["measurements", "craft"]) {
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            reducedMotion: "reduce",
            serviceWorkers: "block",
            acceptDownloads: true,
          });
          const page = await context.newPage(),
            errors = [],
            downloads = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("download", (download) => downloads.push(download));
          const craft = room === "craft",
            save = craft ? "#save-study" : "#save-reading",
            cancel = craft ? "#cancel-study" : "#cancel-reading";
          await page.goto(
            craft
              ? `${base}shuang.html?bell=p08&strike=22`
              : `${base}?values=all&reference=439.524&against=439.523#reference`,
          );
          const source = craft ? "shuang/fonts/IBMPlex-OFL.txt" : "sources/li-2024-figure-2.jpg";
          heldFile = source;
          await page.locator(save).click();
          assert(await page.locator(save).isDisabled());
          await page.locator(cancel).click();
          await page.waitForFunction((id) => !document.querySelector(id).disabled, save);
          assert.match(await page.locator("#save-status").innerText(), /cancelled/);
          release();
          await page.waitForTimeout(100);
          assert.equal(downloads.length, 0);
          // A stalled body must be bounded too; headers alone do not complete a source.
          heldFile = source;
          bodyStall = true;
          const start = Date.now();
          await page.locator(save).click();
          await page.waitForFunction(
            () => document.querySelector("#save-status").textContent.includes("took too long"),
            null,
            { timeout: 15000 },
          );
          const timeoutMs = Date.now() - start;
          assert(timeoutMs >= 11000 && timeoutMs < 14500);
          assert.equal(downloads.length, 0);
          assert(await page.locator(save).isEnabled());
          release();
          // An export holds its start-time selection while the learner keeps working.
          heldFile = source;
          await page.locator(save).click();
          if (craft) await page.locator("#rule").selectOption("fixed");
          else {
            await page.locator("#precise-a4").fill("439.6");
            await page.locator("#precise-a4").press("Enter");
          }
          const event = page.waitForEvent("download");
          release();
          const file = await event;
          const target = path.join(out, `${engine}-${width}-${room}-retained.html`);
          await file.saveAs(target);
          const html = await readFile(target, "utf8");
          if (craft) {
            assert(html.includes("rule=successive"));
            assert.equal(await page.locator("#rule").inputValue(), "fixed");
            assert(html.includes("Copyright (c) 2026 Anthony Mercer"));
            assert(!html.includes("Anton Soloviev"));
          } else {
            assert(html.includes("Current A4 439.524 Hz: 10 keys"));
            assert.equal(await page.locator("#precise-a4").inputValue(), "439.6");
          }
          const completed = downloads.length;
          wrongFile = source;
          await page.locator(save).click();
          await page.waitForFunction(() =>
            document
              .querySelector("#save-status")
              .textContent.includes("differs from this edition"),
          );
          assert.equal(downloads.length, completed);
          wrongFile = "";
          assert.deepEqual(errors, []);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          cases.push({
            engine,
            width,
            room,
            cancelStopsLateDownload: true,
            bodyTimeoutMs: timeoutMs,
            currentSelectionPreserved: true,
            startTimeSelectionRetained: true,
            wrong200Rejected: true,
            pageErrors: errors,
          });
          await context.close();
          process.stdout.write(
            `${engine} ${width} ${room}: cancel, stalled body, start-time snapshot and wrong 200 passed\n`,
          );
        }
    } finally {
      await browser.close();
    }
  }
} finally {
  release();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(
  path.join(out, "receipt.json"),
  `${JSON.stringify({ scope: "Actual production HTML exports. Service workers blocked to exercise raw source failure, cancellation and response-body timeouts. No compiled fixture changes.", cases }, null, 2)}\n`,
);
