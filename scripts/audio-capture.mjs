import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:4350/shiguzhai/";
const directory = path.resolve(process.argv[3] ?? "/tmp/shiguzhai-audio");
await mkdir(directory, { recursive: true });
const bells = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "import json;from importlib.machinery import SourceFileLoader;m=SourceFileLoader('oracle','scripts/source-oracle.py').load_module();print(json.dumps(m.published_bells()))",
    ],
    { encoding: "utf8" },
  ),
);
const cases = bells.flatMap((b) => [
  { bell: b.id, a: b.A[0], b: b.B[0], mode: "pair" },
  { bell: b.id, a: b.A[0], b: b.B[0], mode: "reference" },
  { bell: b.id, a: b.A[0], b: b.B[0], mode: "observations" },
  ...["A", "B"].flatMap((position) =>
    b[position].map((hz) => ({
      bell: b.id,
      a: position === "A" ? hz : b.A[0],
      b: position === "B" ? hz : b.B[0],
      mode: position,
    })),
  ),
]);
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Native Web Audio OfflineAudioContext exports through the app audio graph; frequencies selected from the publisher table parser.",
  audio: [],
  playback: [],
};
for (const bell of ["I", "X"])
  for (const reference of [430, 450]) {
    const b = bells.find((b) => b.id === bell);
    cases.push({ bell, a: b.A[0], b: b.B[0], mode: "reference", reference });
  }
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    // Freeze the review page against development HMR while collecting a single edition.
    await page.routeWebSocket("**", (socket) => socket.close());
    await page.goto(base);
    await page.evaluate(async () => {
      globalThis.capture = {
        ...(await import("./src/audio.ts")),
        ...(await import("./src/core/pitches.ts")),
      };
    });
    for (let index = 0; index < cases.length; index++) {
      const c = cases[index];
      const data = await page.evaluate(async (c) => {
        const blob = await capture.renderWav(
          capture.plan({ ...capture.defaults, ...c, values: "all" }, c.mode),
        );
        return await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
      }, c);
      const bytes = Buffer.from(data.split(",")[1], "base64");
      const file = `${name}-${index}-${c.bell}-${c.mode}.wav`;
      await writeFile(path.join(directory, file), bytes);
      report.audio.push({
        ...c,
        browser: name,
        file,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    // Real AudioContext, with only resume delayed, reproduces stop-before-resume.
    const stoppedBeforeResume = await page.evaluate(async () => {
      const Original = globalThis.AudioContext;
      let release,
        scheduled = 0,
        real;
      globalThis.AudioContext = class extends Original {
        constructor() {
          super();
          real = this;
          const create = this.createOscillator.bind(this);
          this.createOscillator = () => {
            scheduled++;
            return create();
          };
        }
        async resume() {
          await super.resume();
          await new Promise((resolve) => {
            release = resolve;
          });
        }
      };
      const player = new capture.Player();
      const pending = player.play(
        capture.plan(capture.defaults, "pair"),
        () => {},
        () => {},
      );
      while (!release) await new Promise((r) => setTimeout(r, 5));
      player.stop();
      release();
      await pending;
      globalThis.AudioContext = Original;
      await real.close();
      return scheduled;
    });
    assert.equal(stoppedBeforeResume, 0);
    const deniedResume = await page.evaluate(async () => {
      const Original = globalThis.AudioContext;
      let real;
      globalThis.AudioContext = class extends Original {
        constructor() {
          super();
          real = this;
        }
        async resume() {
          throw new Error("Deliberate resume denial");
        }
      };
      let rejected = false;
      const player = new capture.Player();
      try {
        await player.play(
          capture.plan(capture.defaults, "pair"),
          () => {},
          () => {},
        );
      } catch {
        rejected = true;
      }
      player.stop();
      globalThis.AudioContext = Original;
      await real.close();
      return rejected;
    });
    assert.equal(deniedResume, true);
    report.playback.push({
      browser: name,
      version: browser.version(),
      stoppedBeforeResumeScheduledOscillators: stoppedBeforeResume,
      resumeRejectionHandled: deniedResume,
    });
    console.log(`${name}: ${cases.length} WAV exports and asynchronous playback boundaries`);
  } finally {
    await browser.close();
  }
}
await writeFile(path.join(directory, "capture.json"), `${JSON.stringify(report, null, 2)}\n`);
