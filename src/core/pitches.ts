import { type Bell, bellById, bells, type Position } from "../data";

export interface Reading {
  bell: string;
  a: number;
  b: number;
  group: "burial" | "decoration";
  values: "leading" | "all";
  reference: number;
}
export const defaults: Reading = {
  bell: "IX",
  a: 402,
  b: 423,
  group: "burial",
  values: "leading",
  reference: 440,
};
export function normalize(input: Partial<Reading>): Reading {
  const bell = bellById(input.bell ?? "IX");
  const values = input.values === "all" ? "all" : "leading";
  const member = (position: Position, selected: unknown) =>
    values === "all" && typeof selected === "number" && bell[position].includes(selected)
      ? selected
      : (bell[position][0] as number);
  return {
    bell: bell.id,
    a: member("A", input.a),
    b: member("B", input.b),
    group: input.group === "decoration" ? "decoration" : "burial",
    values,
    reference:
      typeof input.reference === "number" &&
      Number.isFinite(input.reference) &&
      input.reference >= 430 &&
      input.reference <= 450
        ? Math.round(input.reference)
        : 440,
  };
}
export function readState(search: string): Reading {
  const p = new URLSearchParams(search);
  return normalize({
    bell: p.get("bell") ?? "IX",
    a: Number(p.get("a")),
    b: Number(p.get("b")),
    group: p.get("group") as Reading["group"],
    values: p.get("values") as Reading["values"],
    reference: Number(p.get("reference")),
  });
}
export function writeState(s: Reading): string {
  const p = normalize(s);
  return `?bell=${p.bell}&a=${p.a}&b=${p.b}&group=${p.group}&values=${p.values}&reference=${p.reference}`;
}
export function inGroup(bell: Bell, s: Reading): boolean {
  return s.group === "burial" || bell.decoration === "knobs";
}
export function selectedBells(s: Reading): readonly Bell[] {
  return bells.filter((b) => inGroup(b, s));
}
export function observations(bell: Bell, position: Position, s: Reading): readonly number[] {
  return s.values === "all" ? bell[position] : bell[position].slice(0, 1);
}
export const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;
export function frequency(midi: number, reference = 440): number {
  return reference * 2 ** ((midi - 69) / 12);
}
export function pitch(hz: number, reference = 440) {
  const continuous = 69 + 12 * Math.log2(hz / reference);
  const midi = Math.round(continuous);
  return {
    midi,
    cents: (continuous - midi) * 100,
    referenceHz: frequency(midi, reference),
    name: `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`,
  };
}
export function signed(value: number, places = 1): string {
  const n = Number(value.toFixed(places));
  return `${n > 0 ? "+" : ""}${n}`;
}
export function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(b / a);
}
export function coverage(s: Reading) {
  const rows = selectedBells(s).flatMap((b) =>
    (["A", "B"] as const).flatMap((position) =>
      observations(b, position, s).map((hz) => ({
        bell: b.id,
        position,
        hz,
        ...pitch(hz, s.reference),
      })),
    ),
  );
  const keys = [...new Set(rows.map((r) => r.midi))].sort((a, b) => a - b);
  return {
    rows,
    keys,
    minimum: Math.min(...rows.map((r) => r.hz)),
    maximum: Math.max(...rows.map((r) => r.hz)),
  };
}
export interface Tone {
  hz: number;
  start: number;
  duration: number;
  label: string;
  position: Position | "reference";
}
export interface Plan {
  tones: Tone[];
  duration: number;
}
export type Playback = "A" | "B" | "pair" | "reference" | "observations";
export function plan(s: Reading, mode: Playback): Plan {
  const p = normalize(s);
  if (mode === "observations") {
    const values = bellById(p.bell).B;
    return {
      tones: values.map((hz, i) => ({
        hz,
        start: i * 0.85,
        duration: 0.65,
        label: `B list entry ${i + 1} of ${values.length} · ${hz} Hz`,
        position: "B",
      })),
      duration: values.length * 0.85,
    };
  }
  const items: { hz: number; label: string; position: Tone["position"] }[] =
    mode === "A"
      ? [{ hz: p.a, label: `A · ${p.a} Hz`, position: "A" }]
      : mode === "B"
        ? [{ hz: p.b, label: `B · ${p.b} Hz`, position: "B" }]
        : mode === "reference"
          ? [
              { hz: p.b, label: `Reported B · ${p.b} Hz`, position: "B" },
              {
                hz: pitch(p.b, p.reference).referenceHz,
                label: `Modern ${pitch(p.b, p.reference).name} · ${pitch(p.b, p.reference).referenceHz.toFixed(2)} Hz`,
                position: "reference",
              },
            ]
          : [
              { hz: p.a, label: `A · ${p.a} Hz`, position: "A" },
              { hz: p.b, label: `B · ${p.b} Hz`, position: "B" },
            ];
  return {
    tones: items.map((t, i) => ({ ...t, start: i * 1.25, duration: 1 })),
    duration: items.length * 1.25,
  };
}
