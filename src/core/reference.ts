import type { Position } from "../data";
import { observations, pitch, type Reading, selectedBells } from "./pitches";

export const REFERENCE_MIN = 430;
export const REFERENCE_MAX = 450;

export interface Entry {
  id: string;
  bell: string;
  accession: string;
  position: Position;
  listPosition: number;
  hz: number;
}
export interface Boundary {
  id: string;
  reference: number;
  hz: number;
  lowerMidi: number;
  upperMidi: number;
  entries: Entry[];
  before: number;
  after: number;
  beforeKeys: number[];
  afterKeys: number[];
}
export interface ReferenceInterval {
  lower: number;
  upper: number;
  keys: number[];
}

export function sourceEntries(s: Reading): Entry[] {
  return selectedBells(s).flatMap((bell) =>
    (["A", "B"] as const).flatMap((position) =>
      observations(bell, position, s).map((hz, index) => ({
        id: `${bell.id}:${position}:${index + 1}`,
        bell: bell.id,
        accession: bell.accession,
        position,
        listPosition: index + 1,
        hz,
      })),
    ),
  );
}
function occupied(entries: Entry[], reference: number): number[] {
  return [...new Set(entries.map((entry) => pitch(entry.hz, reference).midi))].sort(
    (a, b) => a - b,
  );
}

/** Solve each half-semitone boundary; do not approximate a sweep with samples. */
export function referenceMap(s: Reading) {
  const entries = sourceEntries(s);
  const grouped = new Map<
    string,
    Omit<Boundary, "before" | "after" | "beforeKeys" | "afterKeys">
  >();
  for (const entry of entries) {
    for (
      let lowerMidi = pitch(entry.hz, REFERENCE_MAX).midi - 1;
      lowerMidi <= pitch(entry.hz, REFERENCE_MIN).midi;
      lowerMidi++
    ) {
      const reference = entry.hz / 2 ** ((lowerMidi + 0.5 - 69) / 12);
      if (reference <= REFERENCE_MIN || reference >= REFERENCE_MAX) continue;
      const id = `${entry.hz}:${lowerMidi}`;
      const existing = grouped.get(id);
      if (existing) existing.entries.push(entry);
      else
        grouped.set(id, {
          id,
          reference,
          hz: entry.hz,
          lowerMidi,
          upperMidi: lowerMidi + 1,
          entries: [entry],
        });
    }
  }
  const events = [...grouped.values()].sort((a, b) => a.reference - b.reference);
  const limits = [REFERENCE_MIN, ...events.map((event) => event.reference), REFERENCE_MAX];
  const intervals: ReferenceInterval[] = limits.slice(1).map((upper, index) => ({
    lower: limits[index] as number,
    upper,
    keys: occupied(entries, ((limits[index] as number) + upper) / 2),
  }));
  const boundaries: Boundary[] = events.map((event, index) => {
    // The UI stores references to 0.001 Hz. These adjacent representable values
    // bracket every boundary in this source set, including its closest pair.
    let before = Math.floor(event.reference * 1000) / 1000;
    let after = Math.ceil(event.reference * 1000) / 1000;
    if (before === after) {
      before -= 0.001;
      after += 0.001;
    }
    if (before <= (limits[index] as number) || after >= (limits[index + 2] as number))
      throw new Error("Source boundaries need a finer reference control");
    return {
      ...event,
      before,
      after,
      beforeKeys: (intervals[index] as ReferenceInterval).keys,
      afterKeys: (intervals[index + 1] as ReferenceInterval).keys,
    };
  });
  return {
    entries,
    boundaries,
    intervals,
    minimumCount: Math.min(...intervals.map((interval) => interval.keys.length)),
    maximumCount: Math.max(...intervals.map((interval) => interval.keys.length)),
  };
}

export function nearestBoundary(boundaries: Boundary[], reference: number): number {
  return boundaries.reduce(
    (best, boundary, index) =>
      Math.abs(boundary.reference - reference) <
      Math.abs((boundaries[best] as Boundary).reference - reference)
        ? index
        : best,
    0,
  );
}

export function referenceComparison(s: Reading) {
  const rows = sourceEntries(s).map((entry) => ({
    ...entry,
    held: pitch(entry.hz, s.against),
    current: pitch(entry.hz, s.reference),
  }));
  const heldKeys = [...new Set(rows.map((row) => row.held.midi))].sort((a, b) => a - b);
  const currentKeys = [...new Set(rows.map((row) => row.current.midi))].sort((a, b) => a - b);
  return {
    heldReference: s.against,
    currentReference: s.reference,
    rows,
    heldKeys,
    currentKeys,
    changed: rows.filter((row) => row.held.midi !== row.current.midi),
    gained: currentKeys.filter((key) => !heldKeys.includes(key)),
    lost: heldKeys.filter((key) => !currentKeys.includes(key)),
  };
}
