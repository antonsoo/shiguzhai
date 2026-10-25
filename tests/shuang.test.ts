import assert from "node:assert/strict";
import { test } from "node:test";
import { bellAt, bells, measured } from "../src/shuang/bells";
import {
  cents,
  coupling,
  initial,
  pitches,
  proportions,
  readState,
  scaleFrequency,
  stateQuery,
} from "../src/shuang/model";
import { wavBytes } from "../src/shuang/sound";

test("unreported ROM pitches remain absent in both listening modes", () => {
  assert.equal(bells.length, 14);
  assert.equal(measured.length, 12);
  for (const id of ["rom1", "rom2"]) {
    const bell = bellAt(id);
    assert.equal(bell.mass, null);
    for (const mode of ["measured", "semitone"] as const) {
      assert.equal(pitches(bell, mode), null);
      assert.throws(() => wavBytes({ ...initial, bell: id, tuning: mode }), RangeError);
    }
  }
});
test("reported ambiguous intervals survive until a modern grid is explicitly selected", () => {
  for (const id of ["p08", "p10"]) {
    const bell = bellAt(id),
      pair = pitches(bell, "measured"),
      projected = pitches(bell, "semitone");
    assert.ok(pair && projected);
    assert.ok(cents(pair.b, pair.a) > 350 && cents(pair.b, pair.a) < 352);
    assert.ok(Math.abs(cents(projected.b, projected.a) - 300) < 1e-9);
  }
  const bell = bellAt("p02");
  assert.ok(bell.aHz && bell.bHz);
  assert.equal(Math.round(cents(Number(bell.bHz), Number(bell.aHz))), 304);
  assert.equal((bell.printedB ?? 0) - (bell.printedA ?? 0), 305);
});
test("position changes model coupling without altering the object's frequencies", () => {
  assert.deepEqual(coupling(0), { a: 1, b: 0 });
  assert.deepEqual(coupling(45), { a: 0, b: 1 });
  for (let angle = 0; angle <= 45; angle++) {
    const w = coupling(angle);
    assert.ok(Math.abs(w.a * w.a + w.b * w.b - 1) < 1e-14);
    assert.deepEqual(pitches(bellAt("p08"), "measured"), { a: 1214.1, b: 1486.8 });
  }
  for (const angle of [-1, 46, NaN, Infinity]) assert.throws(() => coupling(angle), RangeError);
});
test("two text interpretations and two thickness assumptions make different predictions", () => {
  assert.deepEqual(proportions("fixed"), [10, 8, 8, 6, 6, 4]);
  assert.deepEqual(proportions("successive"), [10, 8, 8, 6.4, 6.4, 5.12]);
  assert.equal(scaleFrequency(1200, 2, "scaled"), 600);
  assert.equal(scaleFrequency(1200, 2, "fixed"), 300);
  for (const ratio of [0, -1, NaN, Infinity])
    assert.throws(() => scaleFrequency(1200, ratio, "fixed"), RangeError);
});
test("shared selections preserve all controls and reject ambiguous numeric input", () => {
  const selected = {
    ...initial,
    bell: "rom2",
    angle: 23,
    reading: 5,
    size: 103,
    tuning: "semitone" as const,
    rule: "fixed" as const,
  };
  assert.deepEqual(readState(new URLSearchParams(stateQuery(selected))), selected);
  assert.deepEqual(
    readState(
      new URLSearchParams("bell=unknown&strike=-1&read=6&scale=1e2&tuning=ancient&rule=other"),
    ),
    initial,
  );
});
test("WAV retains a complete PCM stream and its synthesis/source identity", () => {
  const bytes = wavBytes({ ...initial, angle: 22 }),
    view = new DataView(bytes.buffer),
    text = new TextDecoder();
  assert.equal(text.decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(view.getUint32(4, true), bytes.length - 8);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 88200 * 2);
  assert.equal(text.decode(bytes.slice(44 + 88200 * 2, 48 + 88200 * 2)), "LIST");
  const metadata = text.decode(bytes.slice(44 + 88200 * 2));
  assert.match(metadata, /not an ancient bell recording/);
  assert.match(metadata, /1214.1 Hz/);
  assert.match(metadata, /10.1250\/ast.10.299/);
  for (let offset = 44; offset < 44 + 88200 * 2; offset += 2)
    assert.ok(Math.abs(view.getInt16(offset, true)) < 32767);
});
