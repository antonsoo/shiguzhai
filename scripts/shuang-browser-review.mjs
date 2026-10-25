// biome-ignore-all lint/performance/useDomNodeTextContent: Inspect learner-visible text.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";
import { readings } from "../src/shuang/content.ts";

const base = process.argv[2],
  out = process.argv[3];
assert(base && out, "Pass a production base URL and an output directory");
const tables = JSON.parse(await readFile("public/shuang/sources/measurements.json", "utf8"));
const assets = JSON.parse(await readFile("src/shuang/assets.json", "utf8"));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const report = {
  checkedAtUtc: new Date().toISOString(),
  base,
  configurations: [],
  audioResumeRaces: [],
};
await mkdir(out, { recursive: true });
async function download(page, selector, file) {
  const event = page.waitForEvent("download");
  await page.locator(selector).click();
  const item = await event;
  assert.equal(await item.failure(), null);
  await item.saveAs(file);
  return readFile(file);
}
async function noOverflow(page) {
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "Page has horizontal overflow",
  );
}
async function svgBounds(page) {
  const bad = await page.locator(".sh-figure").evaluateAll((svgs) =>
    svgs.flatMap((svg) => {
      const root = svg.getBoundingClientRect();
      if (!root.width) return [];
      return [...svg.querySelectorAll("text")]
        .filter((t) => {
          const r = t.getBoundingClientRect();
          return (
            r.left < root.left - 1 ||
            r.right > root.right + 1 ||
            r.top < root.top - 1 ||
            r.bottom > root.bottom + 1
          );
        })
        .map((t) => t.textContent);
    }),
  );
  assert.deepEqual(bad, [], "SVG labels leave the canvas");
}
function wavInfo(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt32LE(24), 44100);
  assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(bytes.readUInt32LE(40), 176400);
  assert.match(bytes.toString("ascii", 176444), /not an ancient bell recording/);
  return {
    bytes: bytes.length,
    sha256: hash(bytes),
    rate: 44100,
    frames: 88200,
    sourceNotice: true,
  };
}
async function observeAudio(page) {
  await page.addInitScript(() => {
    window.__starts = 0;
    window.__contexts = 0;
    window.__releases = [];
    window.__holdResume = false;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        window.__contexts++;
      }
      async resume() {
        if (window.__holdResume) await new Promise((resolve) => window.__releases.push(resolve));
        return super.resume();
      }
      createBufferSource() {
        const source = super.createBufferSource(),
          start = source.start.bind(source);
        source.start = (...args) => {
          window.__starts++;
          window.__pcm = new Float32Array(source.buffer.getChannelData(0));
          window.__rate = source.buffer.sampleRate;
          return start(...args);
        };
        return source;
      }
    };
  });
}
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 375]) {
      const folder = path.join(out, `${name}-${width}`);
      await mkdir(folder, { recursive: true });
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        acceptDownloads: true,
        reducedMotion: "reduce",
      });
      context.setDefaultTimeout(30000);
      try {
        const page = await context.newPage(),
          errors = [],
          consoleErrors = [],
          external = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") consoleErrors.push(m.text());
        });
        page.on("request", (r) => {
          if (/^https?:/.test(r.url()) && !r.url().startsWith(new URL("./", base).href))
            external.push(r.url());
        });
        await observeAudio(page);
        await page.goto(base);
        await page.evaluate(() => document.fonts.ready);
        await noOverflow(page);
        assert.equal(
          await page.evaluate(() => window.__contexts),
          0,
          "Audio must wait for a user request",
        );
        assert.match(await page.locator("#a-hz").innerText(), /1214.1/);
        assert.match(await page.locator("#b-hz").innerText(), /1486.8/);
        await page.locator("#strike").focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await page.locator("#strike").inputValue(), "1");
        for (const bell of tables.bells) {
          await page.locator("#bell").selectOption(bell.id);
          await noOverflow(page);
          if (bell.aHz === null) {
            assert(await page.locator("#listen-a").isDisabled());
            assert(await page.locator("#save-wav").isDisabled());
            assert.match(await page.locator("#a-hz").innerText(), /not reported/);
            assert.match(await page.locator("#dimension-copy").innerText(), new RegExp(bell.label));
          } else {
            assert.equal((await page.locator("#a-hz").innerText()).replace(/\s*Hz$/, ""), bell.aHz);
            assert.equal((await page.locator("#b-hz").innerText()).replace(/\s*Hz$/, ""), bell.bHz);
          }
        }
        await page.locator("#bell").selectOption("p08");
        await page.locator("#listen-a").click();
        await page.waitForFunction(() => window.__starts === 1);
        assert.equal(await page.locator("#strike").inputValue(), "0");
        await page.locator("#listen-b").click();
        await page.waitForFunction(() => window.__starts === 2);
        assert.equal(await page.locator("#strike").inputValue(), "45");
        assert.match(await page.locator("#a-hz").innerText(), /1214.1/);
        assert.match(await page.locator("#b-hz").innerText(), /1486.8/);
        await page.locator("#strike").fill("22");
        await page.locator("#listen-mixture").click();
        await page.waitForFunction(() => window.__starts === 3);
        const historyLength = await page.evaluate(() => history.length);
        await page.locator("#listen-mixture").click();
        await page.waitForFunction(() => window.__starts === 4);
        assert.equal(await page.evaluate(() => history.length), historyLength);
        const pcmBase64 = await page.evaluate(() => {
          const bytes = new Uint8Array(window.__pcm.buffer);
          let s = "";
          for (let i = 0; i < bytes.length; i += 8192)
            s += String.fromCharCode(...bytes.subarray(i, i + 8192));
          return btoa(s);
        });
        assert.equal(await page.evaluate(() => window.__rate), 44100);
        await page.locator("#stop").click();
        const wav = await download(page, "#save-wav", path.join(folder, "strike.wav")),
          wavReceipt = wavInfo(wav),
          pcm = Buffer.from(pcmBase64, "base64");
        assert.equal(pcm.length, 88200 * 4);
        for (let i = 0; i < 88200; i++)
          assert.equal(
            wav.readInt16LE(44 + i * 2),
            Math.round(pcm.readFloatLE(i * 4) * 32767) || 0,
          );
        await page.locator("#tuning").selectOption("semitone");
        assert.match(await page.locator("#interval-copy").innerText(), /300 cents apart/);
        assert.match(await page.locator("#tuning-note").innerText(), /not evidence of ancient/);
        await page.goBack();
        assert.equal(await page.locator("#tuning").inputValue(), "measured");
        await page.locator("#scale").fill("200");
        assert.equal(await page.locator("#scaled-wall").innerText(), "607.05 Hz");
        assert.equal(await page.locator("#fixed-wall").innerText(), "303.52 Hz");
        for (let i = 0; i < readings.length; i++) {
          await page.locator("#reading").selectOption(String(i));
          assert.match(
            await page.locator("#reading-body").innerText(),
            new RegExp(readings[i].pinyin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
          );
          assert.equal(await page.locator(".chinese").innerText(), readings[i].chinese);
          await noOverflow(page);
        }
        await page.locator("#reading").selectOption("4");
        await page.locator("#next").click();
        assert.equal(await page.locator("#reading").inputValue(), "5");
        assert(await page.locator("#next").isDisabled());
        await page.locator("#previous").click();
        assert.equal(await page.locator("#reading").inputValue(), "4");
        await page.locator("#rule").selectOption("fixed");
        const fixed = await page.locator("#dimension-figure").innerHTML();
        await page.locator("#rule").selectOption("successive");
        assert.notEqual(await page.locator("#dimension-figure").innerHTML(), fixed);
        await page.getByText("Locate the six named measurements", { exact: true }).click();
        await svgBounds(page);
        await page.locator("#read").screenshot({ path: path.join(folder, "reading.png") });
        const photo = page.locator(".source-photo img");
        await photo.scrollIntoViewIfNeeded();
        await photo.evaluate((e) => e.decode());
        assert.equal(await photo.evaluate((e) => e.naturalWidth), 463);
        const shared = await page.locator("#share-url").inputValue();
        await page.goto(shared);
        assert.equal(await page.locator("#strike").inputValue(), "22");
        assert.equal(await page.locator("#reading").inputValue(), "4");
        assert.equal(await page.locator("#scale").inputValue(), "200");
        await page.locator("#bench").screenshot({ path: path.join(folder, "bench.png") });
        const csv = await download(page, "#save-csv", path.join(folder, "measurements.csv")),
          rows = csv
            .toString()
            .trimEnd()
            .split(/\r?\n/)
            .map((r) => r.split(","));
        assert.equal(rows.length, 15);
        for (const id of ["ROM 1", "ROM 2"]) {
          const row = rows.find((r) => r[0] === id);
          assert.ok(row);
          assert.deepEqual(row.slice(8), ["", "", "", "", "", ""]);
        }
        const svgFile = path.join(folder, "rim.svg");
        await download(page, "#save-svg", svgFile);
        const svg = await context.newPage();
        await svg.goto(pathToFileURL(svgFile).href);
        assert.equal(await svg.locator("parsererror").count(), 0);
        await svg.close();
        const studyFile = path.join(folder, "study.html"),
          html = await download(page, "#save-study", studyFile),
          study = await context.newPage(),
          studyRequests = [];
        study.on("request", (r) => {
          if (/^https?:/.test(r.url())) studyRequests.push(r.url());
        });
        await study.goto(pathToFileURL(studyFile).href);
        await study.evaluate(() => document.fonts.ready);
        assert.equal(await study.locator("script").count(), 0);
        assert.equal(await study.locator("audio").count(), 3);
        assert.equal(await study.locator(".reading").count(), 6);
        const embeddedWav = Buffer.from(
          (await study.locator("audio").last().getAttribute("src")).split(",")[1],
          "base64",
        );
        assert.equal(hash(embeddedWav), hash(wav));
        const embeddedImage = await study.locator("img").getAttribute("src");
        assert.equal(
          hash(Buffer.from(embeddedImage.split(",")[1], "base64")),
          assets["sources/cleveland-1962.44.jpg"],
        );
        await study.locator("img").evaluate((e) => e.decode());
        assert.equal(await study.locator("img").evaluate((e) => e.naturalWidth), 463);
        await study.locator("audio").first().click();
        await study
          .locator("audio")
          .first()
          .evaluate((e) => e.play());
        await study.waitForFunction(() => document.querySelector("audio").currentTime > 0.05);
        assert.equal(
          await study
            .locator("audio")
            .first()
            .evaluate((e) => e.duration),
          2,
        );
        await study
          .locator("audio")
          .first()
          .evaluate((e) => e.pause());
        await noOverflow(study);
        assert.deepEqual(studyRequests, []);
        const embeddedCSV = await download(
          study,
          'a[download="shuang-measurements.csv"]',
          path.join(folder, "embedded.csv"),
        );
        assert.equal(hash(embeddedCSV), hash(csv));
        await study
          .locator("#reading-5")
          .screenshot({ path: path.join(folder, "saved-reading.png") });
        if (name === "chromium" && width === 1440)
          await study.pdf({
            path: path.join(folder, "study.pdf"),
            format: "A4",
            printBackground: true,
          });
        await study.close();
        const axe = await new AxeBuilder({ page }).analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          [],
        );
        await page.waitForFunction(
          () => document.querySelector("#offline-status").textContent.includes("saved offline"),
          null,
          { timeout: 60000 },
        );
        await context.setOffline(true);
        await page.reload();
        await page.locator("#listen-a").click();
        await page.waitForFunction(() => window.__starts === 1);
        await page.locator("#stop").click();
        await download(page, "#save-study", path.join(folder, "offline-study.html"));
        const otherRoom = page.getByRole("link", { name: "Shiguzhai bells", exact: true });
        await otherRoom.focus();
        await Promise.all([page.waitForNavigation(), page.keyboard.press("Enter")]);
        assert.match(await page.locator("#title").innerText(), /Ten bells/);
        await noOverflow(page);
        await page.locator("#try-low-b").click();
        assert.equal(await page.locator("#b-frequency").inputValue(), "269");
        await page.locator('[data-play="pair"]').click();
        await page.locator("#stop").click();
        assert.match(await page.locator("#audio-status").innerText(), /Stopped/);
        await page.getByRole("link", { name: "Craft bench", exact: true }).click();
        assert.equal(await page.locator("#bell").inputValue(), "p08");
        await page.waitForFunction(() =>
          document.querySelector("#offline-status").textContent.includes("saved offline"),
        );
        await page.locator("#bell").selectOption("rom1");
        const romFile = path.join(folder, "rom-study.html");
        await download(page, "#save-study", romFile);
        const rom = await context.newPage();
        await rom.goto(pathToFileURL(romFile).href);
        assert.equal(await rom.locator("audio").count(), 0);
        assert.match(await rom.locator("body").innerText(), /No pitch is reported/);
        await rom.close();
        let rejectedChangedSource = false;
        if (name === "chromium" && width === 1440) {
          await page.evaluate(async () => {
            const key = (await caches.keys()).find((k) => k.startsWith("shiguzhai-"));
            await (await caches.open(key)).put(
              new URL("shuang/sources/cleveland-1962.44.jpg", location.href.split("?")[0]),
              new Response("substituted image", { headers: { "Content-Type": "image/jpeg" } }),
            );
          });
          let count = 0;
          page.on("download", () => count++);
          await page.locator("#save-study").click();
          await page.waitForFunction(() =>
            document
              .querySelector("#save-status")
              .textContent.includes("differs from this edition"),
          );
          assert.equal(count, 0);
          rejectedChangedSource = true;
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(consoleErrors, []);
        assert.deepEqual(external, []);
        report.configurations.push({
          browser: name,
          version: browser.version(),
          width,
          nativeBellSelections: 14,
          reportedPitchPairs: 12,
          unreportedPairsPreserved: 2,
          keyboard: true,
          unchangedFrequenciesAfterStrike: true,
          webAudioPcmMatchesDownloadedWav: true,
          wav: wavReceipt,
          sharedState: true,
          history: true,
          repeatedAuditionPreservesHistory: true,
          scaleAssumptions: true,
          chineseReadings: 6,
          competingProportions: true,
          sourceImage: { width: 463, sha256: assets["sources/cleveland-1962.44.jpg"] },
          downloads: {
            csvRows: 14,
            missingCellsPreserved: true,
            svgParses: true,
            studyBytes: html.length,
            scriptFree: true,
            embeddedAudio: 3,
            embeddedAudioActuallyPlayed: true,
            embeddedWavMatches: true,
            embeddedCsvMatches: true,
            unreportedBellHasNoInventedAudio: true,
          },
          offline:
            "Browser context disconnected after the complete edition was installed; listening, reload and new study exports operated",
          twoRoomsOffline: true,
          rejectedChangedSource,
          axeViolations: 0,
          errors,
          consoleErrors,
          external,
        });
        await writeFile(path.join(out, "browser.json"), `${JSON.stringify(report, null, 2)}\n`);
        console.log(
          `${name} ${width}: native listening and exact WAV, all bells/readings, saved study, disconnected use`,
        );
      } finally {
        await context.close();
      }
    }
    const context = await browser.newContext({
      viewport: { width: 900, height: 900 },
      reducedMotion: "no-preference",
    });
    try {
      const page = await context.newPage();
      await observeAudio(page);
      await page.goto(base);
      await page.evaluate(() => {
        window.__holdResume = true;
      });
      await page.locator("#listen-a").click();
      await page.waitForFunction(() => window.__releases.length === 1);
      await page.locator("#bell").selectOption("p07");
      const frame = await page.locator("#mode").innerHTML();
      await page.evaluate(() =>
        window.__releases.splice(0).forEach((resolve) => {
          resolve();
        }),
      );
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.__starts), 0);
      assert.equal(await page.locator("#mode").innerHTML(), frame);
      assert.match(await page.locator("#sound-status").innerText(), /Selection changed/);
      await page.locator("#listen-a").click();
      await page.locator("#listen-b").click();
      await page.waitForFunction(() => window.__releases.length === 2);
      await page.evaluate(() => {
        window.__holdResume = false;
        window.__releases.splice(0).forEach((resolve) => {
          resolve();
        });
      });
      await page.waitForFunction(() => window.__starts === 1);
      assert.equal(await page.locator("#strike").inputValue(), "45");
      await page.locator("#stop").click();
      const stopped = await page.locator("#mode").innerHTML();
      await page.waitForTimeout(150);
      assert.equal(await page.locator("#mode").innerHTML(), stopped);
      report.audioResumeRaces.push({
        browser: name,
        selectionDuringPendingResume: "cancelled before playback and animation",
        twoPendingStrikes: "only the latest starts",
        stop: "no late animation restarts",
      });
      await writeFile(path.join(out, "browser.json"), `${JSON.stringify(report, null, 2)}\n`);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
