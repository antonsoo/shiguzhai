import source from "../../public/shuang/sources/measurements.json";
export interface Bell {
  id: string;
  label: string;
  location: "Kyoto" | "ROM";
  xianchang: number;
  zhengchang: number;
  xianjian: number;
  gujian: number;
  wuxiu: number;
  wuguang: number;
  mass: number | null;
  aHz: string | null;
  bHz: string | null;
  printedA: number | null;
  printedB: number | null;
}
/** Factual transcription of Takahashi (1989), Tables 1-2, pp. 300-301. */
function location(value: string): Bell["location"] {
  if (value !== "Kyoto" && value !== "ROM") throw new RangeError("Unknown collection identifier");
  return value;
}
export const bells: Bell[] = source.bells.map((b) => ({ ...b, location: location(b.location) }));
export function bellAt(id: string): Bell {
  const bell = bells.find((b) => b.id === id);
  if (!bell) throw new RangeError("Unknown bell identifier.");
  return bell;
}
export const measured = bells.filter((b) => b.aHz !== null && b.bHz !== null);
export const referenceHz = 364.07;
export const paperURL = "https://www.jstage.jst.go.jp/article/ast1980/10/5/10_5_299/_article";
export const paperPDF = "https://www.jstage.jst.go.jp/article/ast1980/10/5/10_5_299/_pdf";
