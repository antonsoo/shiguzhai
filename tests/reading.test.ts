import assert from "node:assert/strict";
import { test } from "node:test";
import { coverage, defaults, normalize, plan, readState, writeState } from "../src/core/pitches";
import { pitchChart } from "../src/drawing";
import { readingSnapshot } from "../src/export";

test("moving the modern grid changes key labels while preserving source pitches and plot positions", () => {
  const study = normalize({ ...defaults, bell: "I", a: 280, b: 269, values: "all" });
  const shifted = normalize({ ...study, reference: 439 });
  assert.equal(coverage(study).keys.length, 10);
  assert.equal(coverage(shifted).keys.length, 9);
  assert.deepEqual(plan(study, "pair"), plan(shifted, "pair"));
  const marks = (s: typeof study) =>
    [...pitchChart(s).matchAll(/data-hz="[^"]+"[^>]+/g)].map((m) => m[0]);
  assert.deepEqual(marks(study), marks(shifted));
  assert.deepEqual(readState(writeState(shifted)), shifted);
  assert.equal(normalize({ ...study, reference: Infinity }).reference, 440);
});

test("a shared reading retains a lower B observation without promoting it to the leading entry", () => {
  const full = readState("?bell=I&a=280&b=269&values=all&group=burial");
  assert.equal(full.b, 269);
  assert.deepEqual(readState(writeState(full)), full);
  assert.equal(coverage(full).keys.length, 10);
  const leading = normalize({ ...full, values: "leading" });
  assert.equal(leading.b, 283);
  assert.equal(coverage(leading).keys.length, 9);
});

test("foreign or malformed frequencies never enter the listening plan", () => {
  for (const query of [
    "?bell=I&a=0&b=440&values=all",
    "?bell=I&a=NaN&b=Infinity&values=all",
    "?bell=%3Cscript%3E&a=402&b=423",
  ]) {
    const result = readState(query);
    assert.ok(
      plan(result, "pair").tones.every((t) => Number.isFinite(t.hz) && t.hz >= 269 && t.hz <= 437),
    );
  }
  assert.deepEqual(readState("?bell=I&a=440&b=270&values=all"), {
    ...defaults,
    bell: "I",
    a: 280,
    b: 283,
    values: "all",
  });
});

test("excluding the differently decorated bell does not erase its selected evidence", () => {
  const s = normalize({
    ...defaults,
    bell: "III",
    a: 312,
    b: 306,
    values: "all",
    group: "decoration",
  });
  const snapshot = readingSnapshot(s);
  assert.equal(snapshot.selected.B, 306);
  assert.ok(snapshot.comparison.rows.every((r) => r.bell !== "III"));
  assert.equal(snapshot.comparison.rows.length, 76);
  assert.deepEqual(
    plan(s, "observations").tones.map((t) => t.hz),
    [350, 347, 343, 337, 335, 330, 321, 315, 306],
  );
});
