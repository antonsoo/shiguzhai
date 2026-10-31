// biome-ignore-all lint/performance/useDomNodeTextContent: Inspect the learner's visible reading.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";

const output = path.resolve(process.argv[2] ?? "/tmp/shiguzhai-reference-review");
await mkdir(output, { recursive: true });
let available = true,
  rejected = 0;
const server = http.createServer(async (request, response) => {
  if (!available) {
    rejected++;
    request.socket.destroy();
    return;
  }
  const url = new URL(request.url, "http://localhost");
  const file = url.pathname.replace(/^\/shiguzhai\//, "") || "index.html";
  if (!url.pathname.startsWith("/shiguzhai/") || file.includes("..")) {
    response.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(path.join("dist", file));
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".jpg": "image/jpeg",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".pdf": "application/pdf",
    };
    response
      .writeHead(200, {
        "Content-Type": types[path.extname(file)] ?? "text/plain",
        "Cache-Control": "no-store",
      })
      .end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/shiguzhai/`;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  at: new Date().toISOString(),
  scope:
    "Local production build, two engines at desktop and 375px; native downloads, direct fragments, source identities, unchanged audio, keyboard, offline and script-disabled retained readings. No public deployment claim.",
  configurations: [],
};

try {
  for (const [name, engine] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ]) {
    const browser = await engine.launch();
    try {
      for (const width of [1440, 375]) {
        available = true;
        const folder = path.join(output, `${name}-${width}`);
        await mkdir(folder, { recursive: true });
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          acceptDownloads: true,
          reducedMotion: "reduce",
        });
        const errors = [],
          external = [],
          artifacts = [];
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
            external.push(request.url());
        });
        async function save(id, filename) {
          const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.locator(`#${id}`).click(),
          ]);
          const target = path.join(folder, filename);
          await download.saveAs(target);
          const bytes = await readFile(target);
          artifacts.push({ file: filename, bytes: bytes.length, sha256: hash(bytes) });
          return { target, bytes };
        }
        async function use(reference) {
          await page.locator("#precise-a4").fill(String(reference));
          await page.locator("#precise-a4").press("Enter");
          assert.equal(new URL(page.url()).searchParams.get("reference"), String(reference));
        }
        async function audit() {
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          assert.deepEqual(
            axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
            [],
          );
        }
        await page.goto(`${base}?values=all#reference`);
        await page.waitForFunction(
          () => document.querySelector("#reference").getBoundingClientRect().top < 100,
        );
        await page.waitForFunction(
          () =>
            document.querySelector("#offline-status").textContent ===
            "Bells & evidence saved offline",
        );
        await page.locator("#try-boundary").focus();
        await page.keyboard.press("Enter");
        assert.match(
          await page.locator("#reference-result").innerText(),
          /Held 439.523 Hz: 9 keys. Current 439.524 Hz: 10 keys. Changed table entries: 1 of 87/,
        );
        assert.match(
          await page.locator("#reference-changes").innerText(),
          /I · B7\s+269\s+C♯4\s+C4/,
        );
        const marks = await page
          .locator(".pitch-chart [data-hz]")
          .evaluateAll((entries) => entries.map((entry) => entry.outerHTML));
        await use(439.523);
        const beforeAudio = await save("save-wav", "before.wav");
        await use(439.524);
        const afterAudio = await save("save-wav", "after.wav");
        assert.equal(
          hash(beforeAudio.bytes),
          hash(afterAudio.bytes),
          "The same reported tones must yield identical WAVs across a modern label boundary",
        );
        assert.deepEqual(
          await page
            .locator(".pitch-chart [data-hz]")
            .evaluateAll((entries) => entries.map((entry) => entry.outerHTML)),
          marks,
        );
        await audit();
        await page.locator("#reference").screenshot({ path: path.join(folder, "boundary.png") });
        const snapshot = await save("save-json", "comparison.json");
        const record = JSON.parse(snapshot.bytes);
        assert.equal(record.settings.against, 439.523);
        assert.equal(record.settings.reference, 439.524);
        assert.deepEqual(
          record.referenceAnalysis.comparison.changed.map((row) => row.id),
          ["I:B:7"],
        );
        await save("save-boundary-csv", "boundaries.csv");
        const svg = await save("save-reference-svg", "comparison.svg");
        const retained = await save("save-reading", "reading.html");
        const html = retained.bytes.toString();
        assert(html.includes("Held A4 439.523 Hz: 9 keys"));
        for (const file of [
          "sources/li-2024-figure-5.jpg",
          "sources/li-2024-figure-2.jpg",
          "sources/li-2024-table-1.jpg",
        ]) {
          const bytes = await readFile(path.join("public", file));
          assert(html.includes(`data:image/jpeg;base64,${bytes.toString("base64")}`), file);
        }
        const font = await readFile("public/fonts/NotoSansCJK-subset.woff2");
        assert(html.includes(`data:font/woff2;base64,${font.toString("base64")}`));
        assert(html.includes("SIL OPEN FONT LICENSE Version 1.1"));
        assert(!/<script\b/i.test(html));
        const shared = new URL(page.url());
        shared.hash = "reference";
        await page.goto(`${base}shuang.html`);
        await page.goto(shared.href);
        assert.match(await page.locator("#held-reference").innerText(), /439.523/);
        assert.equal(await page.locator("#precise-a4").inputValue(), "439.524");
        await page.waitForFunction(
          () => document.querySelector("#reference").getBoundingClientRect().top < 100,
        );
        // Hold a reference, then move only the other side using the keyboard.
        await page.locator("#hold-reference").click();
        await page.locator("#reference-pitch").focus();
        await page.keyboard.press("ArrowLeft");
        assert.equal(await page.locator("#reference-pitch").inputValue(), "439.523");
        assert.match(await page.locator("#held-reference").innerText(), /439.524/);
        const picked = Number(await page.locator("#boundary-choice").inputValue());
        await page.locator("#next-boundary").click();
        assert.equal(Number(await page.locator("#boundary-choice").inputValue()), picked + 1);
        await page.locator("#previous-boundary").click();
        assert.equal(Number(await page.locator("#boundary-choice").inputValue()), picked);
        // Inspect a boundary that changes labels while leaving the count fixed.
        const noCount = await page
          .locator("#boundary-choice option")
          .evaluateAll(
            (options) =>
              options.find((option) => /9 to 9 keys|10 to 10 keys/.test(option.textContent))?.value,
          );
        assert(noCount);
        await page.locator("#boundary-choice").selectOption(noCount);
        await page.locator("#cross-boundary").click();
        assert.match(
          await page.locator("#boundary-description").innerText(),
          /total goes from (9 to 9|10 to 10) keys/,
        );
        const noCountRecord = JSON.parse(
          (await save("save-json", "labels-without-count-change.json")).bytes,
        );
        assert(noCountRecord.referenceAnalysis.comparison.changed.length > 0);
        assert.equal(
          noCountRecord.referenceAnalysis.comparison.heldKeys.length,
          noCountRecord.referenceAnalysis.comparison.currentKeys.length,
        );
        for (const group of ["burial", "decoration"])
          for (const values of ["leading", "all"]) {
            await page.locator(`[name="group"][value="${group}"]`).check();
            await page.locator(`[name="values"][value="${values}"]`).check();
            await page.locator("#boundary-choice").selectOption("0");
            assert(await page.locator("#previous-boundary").isDisabled());
            await page
              .locator("#boundary-choice")
              .selectOption(String((await page.locator("#boundary-choice option").count()) - 1));
            assert(await page.locator("#next-boundary").isDisabled());
            await page.locator("#cross-boundary").click();
            await audit();
          }
        await page.locator("#try-boundary").click();
        await page.locator("#hear-boundary").click();
        assert.equal(await page.locator("#b-frequency").inputValue(), "269");
        assert.equal(await page.evaluate(() => document.activeElement.id), "selected-title");
        await page.locator("#show-table").click();
        assert(await page.locator("#printed-table image").isVisible());
        await page.waitForFunction(
          () =>
            document.querySelector("#offline-status").textContent ===
            "Bells & evidence saved offline",
        );
        const requestStart = rejected;
        available = false;
        await context.setOffline(true);
        await page.goto(shared.href);
        await page.locator("#try-boundary").click();
        assert.match(
          await page.locator("#reference-result").innerText(),
          /9 keys. Current 439.524 Hz: 10 keys/,
        );
        const offlineReading = await save("save-reading", "offline-reading.html");
        assert(offlineReading.bytes.toString().includes("Held A4 439.523 Hz: 9 keys"));
        await page.goto(`${base}shuang.html`);
        assert(await page.locator("#bell").isVisible());
        await context.setOffline(false);
        available = true;
        const nativeContext = await browser.newContext({
          javaScriptEnabled: false,
          viewport: { width, height: 1000 },
        });
        const native = await nativeContext.newPage();
        const nativeRequests = [];
        native.on("request", (request) => {
          if (/^https?:/.test(request.url())) nativeRequests.push(request.url());
        });
        await native.goto(pathToFileURL(retained.target).href);
        assert.match(
          await native.locator(".retained-reference").innerText(),
          /Held A4 439.523 Hz: 9 keys/,
        );
        assert.equal(await native.locator("img").count(), 2);
        assert.equal(await native.locator("image").count(), 1);
        assert(await native.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if (name === "chromium" && width === 1440)
          await native.pdf({
            path: path.join(folder, "reading.pdf"),
            format: "A4",
            printBackground: true,
            margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
          });
        await nativeContext.close();
        const vector = await context.newPage();
        await vector.goto(pathToFileURL(svg.target).href);
        assert(
          await vector.locator("text").evaluateAll((texts) =>
            texts.every((text) => {
              const box = text.getBBox();
              const view = text.ownerSVGElement.viewBox.baseVal;
              return (
                box.x >= 0 &&
                box.x + box.width <= view.width &&
                box.y >= 0 &&
                box.y + box.height <= view.height
              );
            }),
          ),
          "Every SVG text must fit its viewBox",
        );
        await vector.close();
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        assert.deepEqual(nativeRequests, []);
        report.configurations.push({
          browser: name,
          width,
          unchangedWavSha256: hash(beforeAudio.bytes),
          analyticalCounts: "9 -> 10; one changed source entry I:B:7",
          scopeChoices: 4,
          sourceImages: "all three original JPEGs byte-for-byte; original font and OFL retained",
          nativeReading: "JavaScript disabled; no HTTP requests; no page overflow",
          offline: {
            bothRooms: true,
            newReadingExported: true,
            originRequestsRejected: rejected - requestStart,
          },
          artifacts,
        });
        await writeFile(path.join(output, "browser.json"), `${JSON.stringify(report, null, 2)}\n`);
        await context.close();
        process.stdout.write(
          `${name} ${width}: controls, real files, source bytes, sound, offline and native reading passed\n`,
        );
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
