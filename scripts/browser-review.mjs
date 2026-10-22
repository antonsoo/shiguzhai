// biome-ignore-all lint/performance/useDomNodeTextContent: Check the text visible to the learner.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";

const output = path.resolve(process.argv[2] ?? "/tmp/shiguzhai-review/browser.json");
const folder = path.dirname(output),
  assets = path.join(folder, "assets");
await mkdir(assets, { recursive: true });
const bells = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "import json,sys;sys.path.insert(0,'scripts');from importlib.machinery import SourceFileLoader;m=SourceFileLoader('oracle','scripts/source-oracle.py').load_module();print(json.dumps(m.published_bells()))",
    ],
    { encoding: "utf8" },
  ),
);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const imageNames = [
  "sources/li-2024-figure-5.jpg",
  "sources/li-2024-figure-2.jpg",
  "sources/li-2024-table-1.jpg",
];
const imageHashes = await Promise.all(
  imageNames.map(async (f) => hash(await readFile(`public/${f}`))),
);
let available = true,
  substitute = false,
  rejected = 0;
const server = http.createServer(async (req, res) => {
  if (!available) {
    rejected++;
    req.socket.destroy();
    return;
  }
  const url = new URL(req.url, "http://localhost");
  const relative = decodeURIComponent(url.pathname).replace(/^\/shiguzhai\//, "") || "index.html";
  if (relative.includes("..") || !url.pathname.startsWith("/shiguzhai/")) {
    res.writeHead(404).end();
    return;
  }
  try {
    const file =
      substitute && relative === "sources/li-2024-figure-2.jpg"
        ? "sources/li-2024-figure-3.jpg"
        : relative;
    const body = await readFile(path.join("dist", file));
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
    };
    res
      .writeHead(200, {
        "Content-Type": types[path.extname(relative)] ?? "text/plain",
        "Cache-Control": "no-cache",
      })
      .end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/shiguzhai/`;
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Built app, native controls, actual SVG positions, downloads, source images, source substitution, and origin-disabled offline listening.",
  configurations: [],
  audio: [],
};
async function save(page, id, name) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(`#${id}`).click(),
  ]);
  const file = path.join(folder, name);
  await download.saveAs(file);
  return { file: name, path: file, sha256: hash(await readFile(file)) };
}
async function saveReading(page, name) {
  const result = await save(page, "save-reading", name),
    html = await readFile(result.path, "utf8");
  const images = [...html.matchAll(/data:image\/jpeg;base64,([^"\s]+)/g)];
  assert.deepEqual(
    images.map((m) => hash(Buffer.from(m[1], "base64"))),
    imageHashes,
  );
  const font = html.match(/data:font\/woff2;base64,([^"\s]+)/);
  assert(font, "Chinese font must be embedded");
  assert.equal(
    hash(Buffer.from(font[1], "base64")),
    hash(await readFile("public/fonts/NotoSansCJK-subset.woff2")),
  );
  assert(html.includes("SIL OPEN FONT LICENSE Version 1.1"));
  assert(html.includes("Copyright 2014-2021 Adobe"));
  return { ...result, html };
}
async function chart(page, group, values, reference = 440) {
  const rendered = await page.locator(".pitch-chart").evaluate((svg) => ({
    ticks: [...svg.querySelectorAll(".reference-label")].map((t) => ({
      name: t.textContent,
      x: Number(t.getAttribute("x")),
    })),
    marks: [...svg.querySelectorAll("[data-hz]")].map((el) => ({
      bell: el.closest("[data-bell]").dataset.bell,
      position: el.dataset.position,
      hz: Number(el.dataset.hz),
      x:
        el.tagName === "circle"
          ? Number(el.getAttribute("cx"))
          : Number(el.getAttribute("d").match(/^M([\d.]+)/)[1]),
    })),
    labels: [...svg.querySelectorAll("text")].map((t) => {
      const r = t.getBoundingClientRect(),
        s = svg.getBoundingClientRect();
      return {
        text: t.textContent,
        inside:
          r.left >= s.left - 1 &&
          r.right <= s.right + 1 &&
          r.top >= s.top - 1 &&
          r.bottom <= s.bottom + 1,
      };
    }),
  }));
  const expected = bells
    .filter((b) => group === "burial" || b.id !== "III")
    .flatMap((b) =>
      ["A", "B"].flatMap((position) =>
        (values === "all" ? b[position] : b[position].slice(0, 1)).map((hz) => ({
          bell: b.id,
          position,
          hz,
        })),
      ),
    );
  assert.deepEqual(
    rendered.marks.map(({ x, ...r }) => r),
    expected,
  );
  assert(
    rendered.labels.every((t) => t.inside),
    JSON.stringify(rendered.labels),
  );
  return { group, values, reference, ...rendered };
}
try {
  for (const [name, engine] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ]) {
    const browser = await engine.launch();
    try {
      for (const width of [1440, 375]) {
        available = true;
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          acceptDownloads: true,
          reducedMotion: "reduce",
        });
        const page = await context.newPage(),
          errors = [],
          external = [],
          charts = [],
          accessibility = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("request", (r) => {
          if (!r.url().startsWith(base) && !r.url().startsWith("blob:")) external.push(r.url());
        });
        await page.goto(base);
        await page.waitForFunction(
          () =>
            document.querySelector("#offline-status").textContent ===
            "Bells & evidence saved offline",
        );
        await page.evaluate(() => document.fonts.ready);
        const audit = async (label) => {
          const a = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          assert.deepEqual(
            a.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
            [],
            label,
          );
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            label,
          );
          accessibility.push(label);
        };
        await audit("initial reading");
        if (name === "chromium")
          await page.screenshot({ path: path.join(assets, `opening-${width}.png`) });
        let selections = 0;
        for (const bell of bells) {
          await page.locator(`#bell-list [data-bell="${bell.id}"]`).focus();
          await page.keyboard.press("Space");
          assert((await page.locator("#selected-identity").innerText()).includes(bell.accession));
          for (const [position, id] of [
            ["A", "a"],
            ["B", "b"],
          ]) {
            assert.deepEqual(
              await page
                .locator(`#${id}-frequency option`)
                .evaluateAll((options) => options.map((o) => Number(o.value))),
              bell[position],
            );
            for (const hz of bell[position]) {
              await page.selectOption(`#${id}-frequency`, String(hz));
              assert.equal(await page.locator(`#${id}-number`).innerText(), `${hz} Hz`);
              assert.equal(new URL(page.url()).searchParams.get(id), String(hz));
              assert(await page.locator('[name="values"][value="all"]').isChecked());
              selections++;
            }
          }
        }
        for (const group of ["burial", "decoration"])
          for (const values of ["leading", "all"]) {
            await page.locator(`[name="group"][value="${group}"]`).check();
            await page.locator(`[name="values"][value="${values}"]`).check();
            for (const reference of [430, 440, 450]) {
              const range = page.locator("#reference-pitch");
              await range.focus();
              await page.keyboard.press("Home");
              for (let step = 430; step < reference; step++)
                await page.keyboard.press("ArrowRight");
              assert.equal(await range.inputValue(), String(reference));
              charts.push(await chart(page, group, values, reference));
            }
          }
        await page.locator("#try-bell-iii").click();
        assert(await page.locator("#excluded-selection").isVisible());
        await page.locator('[name="group"][value="burial"]').check();
        await page.locator("#try-low-b").click();
        assert.equal(await page.locator("#b-frequency").inputValue(), "269");
        assert((await page.locator("#interval").innerText()).includes("-69.4"));
        assert((await page.locator("#coverage-summary").innerText()).includes("10 modern keys"));
        const fixedMarks = await page
          .locator(".pitch-chart [data-hz]")
          .evaluateAll((marks) => marks.map((m) => m.outerHTML));
        await page.locator("#reference-pitch").focus();
        await page.keyboard.press("ArrowLeft");
        assert.equal(await page.locator("#b-frequency").inputValue(), "269");
        assert((await page.locator("#coverage-summary").innerText()).includes("9 modern keys"));
        assert.deepEqual(
          await page
            .locator(".pitch-chart [data-hz]")
            .evaluateAll((marks) => marks.map((m) => m.outerHTML)),
          fixedMarks,
        );
        const shifted = await saveReading(page, `${name}-${width}-reference439.html`);
        assert(shifted.html.includes("A4 = 439 Hz"));
        await page.reload();
        assert.equal(await page.locator("#reference-pitch").inputValue(), "439");
        await page.locator("#reset-reference").click();
        await audit("all measurements and lower B");
        await page.locator("#view-comparison").click();
        assert.equal(await page.evaluate(() => document.activeElement.id), "workshop-title");
        if (name === "chromium")
          await page
            .locator("#workshop")
            .screenshot({ path: path.join(assets, `comparison-${width}.png`) });
        await page.locator('#pitch-chart [data-bell="IX"]').focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement.id), "selected-title");
        assert.equal(await page.locator("#selected-title").innerText(), "Bell IX");
        await page.locator("#try-low-b").click();
        await page.locator('[data-play="pair"]').click();
        await page.waitForFunction(() =>
          document.querySelector("#audio-status").textContent.includes("A · 280"),
        );
        await page.locator("#stop").click();
        assert.equal(await page.locator("#audio-status").innerText(), "Stopped.");
        await page.locator('[data-play="observations"]').click();
        await page.waitForFunction(() =>
          document.querySelector("#audio-status").textContent.includes("B list entry 1 of 7"),
        );
        assert.equal(await page.locator(".is-sounding").getAttribute("data-hz"), "283");
        await page.locator("#stop").click();
        assert.equal(await page.locator(".is-sounding").count(), 0);
        const wave = await save(page, "save-wav", `${name}-${width}-I-280-269.wav`);
        report.audio.push({ ...wave, bell: "I", a: 280, b: 269, mode: "pair", browser: name });
        const csv = await save(page, "save-csv", `${name}-${width}-measurements.csv`);
        assert.equal((await readFile(csv.path, "utf8")).trim().split(/\r?\n/).length, 88);
        const json = await save(page, "save-json", `${name}-${width}-reading.json`);
        const snapshot = JSON.parse(await readFile(json.path, "utf8"));
        assert.equal(snapshot.selected.B, 269);
        assert.equal(snapshot.comparison.rows.length, 87);
        const reading = await saveReading(page, `${name}-${width}-reading.html`);
        await page.locator("#share").click();
        assert.equal(new URL(page.url()).searchParams.get("b"), "269");
        await page.reload();
        assert.equal(await page.locator("#b-frequency").inputValue(), "269");
        await page.locator("#show-table").click();
        assert(await page.locator("#printed-table").isVisible());
        await audit("source table revealed");
        const requestsBefore = rejected;
        available = false;
        await page.reload();
        assert(rejected > requestsBefore);
        assert.equal(await page.locator("#b-frequency").inputValue(), "269");
        await page.locator('[data-play="B"]').click();
        await page.waitForFunction(() =>
          document.querySelector("#audio-status").textContent.includes("B · 269"),
        );
        await page.locator("#stop").click();
        const offline = await saveReading(page, `${name}-${width}-offline.html`);
        assert.equal(offline.sha256, reading.sha256);
        const paper = await page.evaluate(async () => ({
          status: (await fetch("./sources/li-2024-shiguzhai.pdf")).status,
          bytes: (await (await fetch("./sources/li-2024-shiguzhai.pdf")).arrayBuffer()).byteLength,
        }));
        assert.equal(paper.status, 200);
        assert.equal(paper.bytes, (await readFile("public/sources/li-2024-shiguzhai.pdf")).length);
        const standalone = await context.newPage(),
          standaloneRequests = [];
        standalone.on("request", (r) => {
          if (!r.url().startsWith("file:") && !r.url().startsWith("data:"))
            standaloneRequests.push(r.url());
        });
        await standalone.goto(`file://${reading.path}`);
        await standalone.evaluate(() => document.fonts.ready);
        for (const img of await standalone.locator("img").all())
          await img.evaluate((el) => el.decode());
        assert(
          await standalone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        assert.deepEqual(standaloneRequests, []);
        if (name === "chromium" && width === 1440)
          await standalone.pdf({
            path: path.join(folder, "illustrated-reading.pdf"),
            format: "A4",
            printBackground: true,
          });
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        report.configurations.push({
          browser: name,
          version: browser.version(),
          width,
          nativeFrequencySelections: selections,
          charts,
          accessibility,
          keyboardChartSelection: true,
          lowerBSharedState: true,
          liveAudioAndStop: true,
          sourceImageHashes: imageHashes,
          standaloneReadingHash: reading.sha256,
          offlineReloadAudioExportAndPaper: true,
          errors,
          external,
        });
        await context.close();
        console.log(
          `${name} ${width}: source selections, chart, audio, exports and offline reading passed`,
        );
      }
      available = true;
      substitute = true;
      const context = await browser.newContext();
      const page = await context.newPage();
      let downloads = 0;
      page.on("download", () => downloads++);
      await page.goto(base);
      await page.locator("#save-reading").click();
      await page.waitForFunction(() =>
        document.querySelector("#save-status").textContent.includes("could not be verified"),
      );
      assert.equal(downloads, 0);
      await page.waitForFunction(() =>
        document.querySelector("#offline-status").textContent.includes("unavailable"),
      );
      report.configurations
        .filter((c) => c.browser === name)
        .forEach((c) => {
          c.sourceSubstitutionRejected = true;
          c.failedOfflineInstallReported = true;
        });
      await context.close();
      substitute = false;
    } finally {
      await browser.close();
    }
  }
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Saved ${output}`);
