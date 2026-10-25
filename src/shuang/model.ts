import { type Bell, bells, referenceHz } from "./bells";
export interface State {
  bell: string;
  angle: number;
  tuning: "measured" | "semitone";
  rule: "successive" | "fixed";
  reading: number;
  size: number;
}
export const initial: State = {
  bell: "p08",
  angle: 0,
  tuning: "measured",
  rule: "successive",
  reading: 0,
  size: 100,
};
export function readState(p: URLSearchParams): State {
  const num = (key: string, fallback: number, min: number, max: number) => {
    const raw = p.get(key) ?? "";
    const v = /^\d+$/.test(raw) ? Number(raw) : NaN;
    return Number.isInteger(v) && v >= min && v <= max ? v : fallback;
  };
  return {
    bell: bells.some((b) => b.id === p.get("bell"))
      ? (p.get("bell") ?? initial.bell)
      : initial.bell,
    angle: num("strike", 0, 0, 45),
    tuning: p.get("tuning") === "semitone" ? "semitone" : "measured",
    rule: p.get("rule") === "fixed" ? "fixed" : "successive",
    reading: num("read", 0, 0, 5),
    size: num("scale", 100, 50, 200),
  };
}
export const stateQuery = (s: State) =>
  new URLSearchParams({
    bell: s.bell,
    strike: String(s.angle),
    tuning: s.tuning,
    rule: s.rule,
    read: String(s.reading),
    scale: String(s.size),
  }).toString();
export function cents(f: number, ref = referenceHz) {
  if (!(f > 0 && ref > 0 && Number.isFinite(f) && Number.isFinite(ref)))
    throw new RangeError("Frequencies must be positive and finite.");
  return 1200 * Math.log2(f / ref);
}
export const semitoneHz = (f: number) => referenceHz * 2 ** (Math.round(cents(f) / 100) / 12);
export function pitches(bell: Bell, tuning: State["tuning"]) {
  if (bell.aHz === null || bell.bHz === null) return null;
  const a = Number(bell.aHz),
    b = Number(bell.bHz);
  return tuning === "measured" ? { a, b } : { a: semitoneHz(a), b: semitoneHz(b) };
}
/** Ideal quadrupole basis, not measured mode shapes of a particular ancient bell. */
export function coupling(angle: number) {
  if (!Number.isFinite(angle) || angle < 0 || angle > 45)
    throw new RangeError("Choose a model strike between 0 and 45 degrees.");
  const theta = (angle * Math.PI) / 180;
  return { a: angle === 45 ? 0 : Math.cos(2 * theta), b: angle === 0 ? 0 : Math.sin(2 * theta) };
}
export const dimensions = [
  { key: "xianchang", chinese: "銑長", name: "ridge length", pinyin: "xiǎn cháng" },
  { key: "zhengchang", chinese: "鉦長", name: "body length", pinyin: "zhēng cháng" },
  { key: "xianjian", chinese: "銑間", name: "tip-to-tip width", pinyin: "xiǎn jiān" },
  { key: "gujian", chinese: "鼓間", name: "mouth depth", pinyin: "gǔ jiān" },
  { key: "wuxiu", chinese: "舞修", name: "crown length", pinyin: "wǔ xiū" },
  { key: "wuguang", chinese: "舞廣", name: "crown breadth", pinyin: "wǔ guǎng" },
] as const;
export function proportions(rule: State["rule"]) {
  return rule === "successive" ? [10, 8, 8, 6.4, 6.4, 5.12] : [10, 8, 8, 6, 6, 4];
}
export function normalizedDimensions(bell: Bell) {
  return dimensions.map((d) => (bell[d.key] / bell.xianchang) * 10);
}
/** A conditional thin-shell scaling law. The old set's empirical fit is not a universal bell law. */
export function scaleFrequency(f: number, linearRatio: number, thicknessRule: "fixed" | "scaled") {
  if (!(f > 0 && linearRatio > 0 && Number.isFinite(f) && Number.isFinite(linearRatio)))
    throw new RangeError("Choose positive finite scales.");
  return (f * (thicknessRule === "fixed" ? 1 : linearRatio)) / (linearRatio * linearRatio);
}
export const decimal = (n: number, places = 1) =>
  Number(n.toFixed(places)).toLocaleString("en-US", { maximumFractionDigits: places });
