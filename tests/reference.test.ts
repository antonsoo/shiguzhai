import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coverage,
  defaults,
  normalize,
  pitch,
  plan,
  readState,
  writeState,
} from "../src/core/pitches";
import { referenceComparison, referenceMap } from "../src/core/reference";

test("crossing the 269 Hz boundary adds C4 without changing the reported sound", () => {
  const s = normalize({ ...defaults, bell: "I", a: 280, b: 269, values: "all" });
  const event = referenceMap(s).boundaries.find((event) => event.hz === 269);
  assert.ok(event);
  assert.ok(Math.abs(event.reference - 439.52325692185593) < 1e-10);
  const before = { ...s, reference: event.before, against: event.before };
  const after = { ...before, reference: event.after };
  assert.equal(coverage(before).keys.length, 9);
  assert.equal(coverage(after).keys.length, 10);
  assert.deepEqual(plan(before, "pair"), plan(after, "pair"));
  assert.equal(pitch(269, event.reference).midi, 61, "at the exact tie, choose the higher key");
  assert.deepEqual(
    referenceComparison(after).changed.map((entry) => entry.id),
    ["I:B:7"],
  );
  assert.deepEqual(referenceComparison(after).gained, [60]);
  assert.deepEqual(readState(writeState(after)), after);
});

test("every analytic boundary brackets exactly its listed entries, including shared frequencies", () => {
  for (const group of ["burial", "decoration"] as const)
    for (const values of ["leading", "all"] as const) {
      const s = { ...defaults, group, values },
        map = referenceMap(s);
      for (const event of map.boundaries) {
        const comparison = referenceComparison({
          ...s,
          against: event.before,
          reference: event.after,
        });
        assert.deepEqual(
          comparison.changed.map((entry) => entry.id),
          event.entries.map((entry) => entry.id),
        );
        assert.deepEqual(comparison.heldKeys, event.beforeKeys);
        assert.deepEqual(comparison.currentKeys, event.afterKeys);
        assert.equal(pitch(event.hz, event.reference).midi, event.upperMidi);
      }
      assert.equal(map.intervals[0]?.lower, 430);
      assert.equal(map.intervals.at(-1)?.upper, 450);
    }
});

test("decimal shared references are bounded and held filters remain explicit", () => {
  const s = readState("?reference=439.523&against=439.524&group=decoration&values=all");
  assert.equal(s.reference, 439.523);
  assert.equal(s.against, 439.524);
  assert.equal(referenceComparison(s).rows.length, 76);
  for (const query of [
    "?against=NaN",
    "?against=Infinity",
    "?reference=429.999",
    "?against=450.001",
  ])
    assert.deepEqual(readState(query), defaults);
  assert.equal(normalize({ reference: 439.5239 }).reference, 439.524);
});
