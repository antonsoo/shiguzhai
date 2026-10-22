// biome-ignore-all lint/performance/useDomNodeTextContent: Verify visible public behavior.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";

const directory = path.resolve(process.argv[2] ?? "dist");
const output = process.argv[3] ?? "docs/hosted-verification.json";
const base = "https://antonsoo.github.io/shiguzhai/";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? files(path.join(dir, e.name)) : Promise.resolve([path.join(dir, e.name)]),
      ),
    )
  ).flat();
}
const inventory = [];
for (const file of (await files(directory)).sort()) {
  const name = path.relative(directory, file),
    local = await readFile(file);
  const response = await fetch(new URL(name, base), { signal: AbortSignal.timeout(20000) });
  assert(response.ok, `${name}: ${response.status}`);
  const remote = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(remote), hash(local), name);
  inventory.push({ file: name, bytes: local.length, sha256: hash(local) });
}
assert.equal(
  hash(Buffer.from(await (await fetch(base)).arrayBuffer())),
  hash(await readFile(path.join(directory, "index.html"))),
);
const report = {
  checkedAt: new Date().toISOString(),
  url: base,
  inventory,
  directoryEntryExact: true,
  configurations: [],
};
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
        acceptDownloads: true,
      });
      const page = await context.newPage(),
        errors = [],
        external = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (!r.url().startsWith(base) && !r.url().startsWith("blob:")) external.push(r.url());
      });
      await page.goto(`${base}?bell=I&a=280&b=269&group=burial&values=all&reference=439#workshop`);
      await page.waitForFunction(
        () =>
          document.querySelector("#offline-status").textContent ===
          "Bells & evidence saved offline",
      );
      assert((await page.locator("#coverage-summary").innerText()).includes("9 modern keys"));
      assert.equal(await page.locator("#b-frequency").inputValue(), "269");
      const landing = await page.locator("#workshop-title").boundingBox();
      assert(landing.y >= 0 && landing.y < 180);
      await page.locator("#reset-reference").focus();
      await page.keyboard.press("Space");
      assert((await page.locator("#coverage-summary").innerText()).includes("10 modern keys"));
      await page.locator('[data-play="pair"]').click();
      await page.waitForFunction(() =>
        document.querySelector("#audio-status").textContent.includes("A · 280"),
      );
      await page.locator("#stop").click();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.locator("#save-reading").click(),
      ]);
      const artifact = await readFile(await download.path(), "utf8");
      const images = [...artifact.matchAll(/data:image\/jpeg;base64,([^"\s]+)/g)].map((m) =>
        hash(Buffer.from(m[1], "base64")),
      );
      const expected = await Promise.all(
        ["figure-5", "figure-2", "table-1"].map(async (n) =>
          hash(await readFile(path.join(directory, `sources/li-2024-${n}.jpg`))),
        ),
      );
      assert.deepEqual(images, expected);
      assert(artifact.includes("Copyright 2014-2021 Adobe"));
      await context.setOffline(true);
      await page.reload();
      assert.equal(await page.locator("#b-frequency").inputValue(), "269");
      await page.locator('[data-play="B"]').click();
      await page.waitForFunction(() =>
        document.querySelector("#audio-status").textContent.includes("B · 269"),
      );
      await page.locator("#stop").click();
      const [offline] = await Promise.all([
        page.waitForEvent("download"),
        page.locator("#save-reading").click(),
      ]);
      assert.equal(hash(await readFile(await offline.path())), hash(Buffer.from(artifact)));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      report.configurations.push({
        browser: name,
        version: browser.version(),
        width,
        shared439HzReading: true,
        keyboard440HzReset: true,
        audioAndStop: true,
        sourceImagesExact: images,
        standaloneReadingSha256: hash(Buffer.from(artifact)),
        offlineReloadAudioAndExport: true,
        errors,
        external,
      });
      await context.close();
      console.log(`${name} ${width}: hosted reading, reference grid, audio and offline export`);
    }
  } finally {
    await browser.close();
  }
}
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `${inventory.length} canonical files and the directory entry match the reviewed build.`,
);
