// biome-ignore-all lint/performance/useDomNodeTextContent: Inspect the native development workflow.
import assert from "node:assert/strict";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, firefox } from "playwright";

const [base, fixture, logFile, output] = process.argv.slice(2);
assert(
  base && fixture && logFile && output,
  "Usage: node scripts/source-json-development.mjs BASE_URL ISOLATED_TEMP_CLONE SERVER_LOG OUTPUT_DIR",
);
const root = await realpath(fixture),
  relative = path.relative(await realpath(tmpdir()), root);
assert(
  relative && !relative.startsWith("..") && !path.isAbsolute(relative),
  "Use an isolated clone under the OS temporary directory; this recipe edits and restores its JSON.",
);
assert(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Use the isolated local development server.",
);
const pkg = JSON.parse(await readFile("package.json", "utf8")),
  gonia = pkg.name === "@antonsoloviev/gonia";
assert(gonia || pkg.name === "@antonsoloviev/shiguzhai");
const source = gonia
    ? "public/sources/optics/manifest.json"
    : "public/shuang/sources/measurements.json",
  file = path.join(root, source),
  original = await readFile(file, "utf8"),
  record = JSON.parse(original),
  moduleURL = `${base}@id/__x00__retained-source-json`,
  rows = [];
assert.equal(
  original,
  await readFile(source, "utf8"),
  "The fixture must begin with the retained original source.",
);
await mkdir(output, { recursive: true });
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await engine.launch(),
    page = await browser.newPage({ viewport: { width: 375, height: 1000 }, acceptDownloads: true }),
    errors = [],
    publicImports = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.includes("/public/")) publicImports.push(r.url());
  });
  try {
    await page.goto(`${base}${gonia ? "optics.html" : "shuang.html?bell=p08&strike=22"}`);
    await page.locator(gonia ? "#vp-distance" : "#bell").waitFor();
    assert.deepEqual(
      await page.evaluate(async (url) => (await import(url)).default, moduleURL),
      record,
    );
    assert.deepEqual(
      await (await page.request.get(new URL(source.replace(/^public\//, ""), base).href)).json(),
      record,
    );
    assert.deepEqual(publicImports, []);
    if (gonia) {
      await page.locator("#vp-find").click();
      assert.equal(await page.locator("#vp-distance").inputValue(), "1248");
    } else {
      assert.equal(await page.locator("#bell").inputValue(), "p08");
      assert.match(await page.locator("#a-hz").innerText(), /1214.1/);
    }
    if (name === "chromium") {
      const changed = JSON.parse(original);
      if (gonia) changed.edition += " [temporary watcher fixture]";
      else changed.bells.find((b) => b.id === "p08").aHz = "1214.2";
      const loaded = page.waitForEvent("load", { timeout: 15000 });
      await writeFile(file, `${JSON.stringify(changed, null, 2)}\n`);
      await loaded;
      assert.deepEqual(
        await page.evaluate(async (url) => (await import(url)).default, moduleURL),
        changed,
      );
      if (!gonia) assert.match(await page.locator("#a-hz").innerText(), /1214.2/);
      const restored = page.waitForEvent("load", { timeout: 15000 });
      await writeFile(file, original);
      await restored;
      assert.deepEqual(
        await page.evaluate(async (url) => (await import(url)).default, moduleURL),
        record,
      );
      if (!gonia) assert.match(await page.locator("#a-hz").innerText(), /1214.1/);
    }
    const download = page.waitForEvent("download");
    await page.locator(gonia ? "#vp-save-book" : "#save-study").click();
    const item = await download;
    await item.saveAs(path.join(output, `${name}-reading.html`));
    assert.equal(await item.failure(), null);
    assert.deepEqual(errors, []);
    rows.push({
      browser: name,
      width: 375,
      moduleEqualsRetainedJSON: true,
      rawDownloadEqualsRetainedJSON: true,
      publicImportRequests: publicImports,
      temporaryEditAndRestore: name === "chromium",
      nativeStudyDownloaded: true,
      pageErrors: errors,
    });
  } finally {
    await writeFile(file, original);
    await browser.close();
  }
}
const log = await readFile(logFile, "utf8");
assert(!/Assets in public directory cannot|Internal server error|Failed to resolve/.test(log), log);
assert.equal(await readFile(file, "utf8"), original);
await writeFile(
  path.join(output, "development.json"),
  `${JSON.stringify({ checkedAt: new Date().toISOString(), base, source, driverNode: process.version, serverWarnings: 0, rows, scope: "Native development and raw/module source identity. Temporary edits are isolated watcher fixtures, not historical measurements. Original bytes restored. Production and publication checks are separate." }, null, 2)}\n`,
);
console.log(
  `${pkg.name}: native development, source editing/restoration, raw JSON and complete studies without server warnings`,
);
