export const source = {
  title: "A ‘set’ of ancient bronze bells excavated in Changsha, Hunan Province, China",
  authors: "Kin Sum Li and colleagues",
  year: 2024,
  doi: "10.1186/s40494-024-01377-0",
  url: "https://doi.org/10.1186/s40494-024-01377-0",
  table: "Table 1, printed page 6",
  measured: "August 2022, Changsha Museum exhibition gallery, 22 °C",
  scope:
    "Ten bells found together at Shiguzhai in June 1993; the paper dates their manufacture to the twelfth century BCE.",
};
export type Position = "A" | "B";
export interface Bell {
  id: string;
  accession: string;
  A: readonly number[];
  B: readonly number[];
  sideCm: number;
  spineCm: number;
  heightCm: number;
  decoration: "knobs" | "animal-mask";
}
// Order within each list is the publisher's order, not strike order. The first
// B value is the clearest or most often occurring, according to Table 1.
export const bells: readonly Bell[] = [
  {
    id: "I",
    accession: "1632.9",
    A: [280, 279],
    B: [283, 282, 280, 278, 276, 274, 269],
    sideCm: 34,
    spineCm: 29.6,
    heightCm: 53.5,
    decoration: "knobs",
  },
  {
    id: "II",
    accession: "1632.5",
    A: [280, 279],
    B: [296, 302, 290, 288, 286, 283, 280],
    sideCm: 31,
    spineCm: 27.5,
    heightCm: 48.5,
    decoration: "knobs",
  },
  {
    id: "III",
    accession: "1633",
    A: [313, 312],
    B: [350, 347, 343, 337, 335, 330, 321, 315, 306],
    sideCm: 31.5,
    spineCm: 28,
    heightCm: 54,
    decoration: "animal-mask",
  },
  {
    id: "IV",
    accession: "1632.8",
    A: [313, 314],
    B: [326, 323, 319, 315, 313, 311],
    sideCm: 31,
    spineCm: 27.5,
    heightCm: 51.6,
    decoration: "knobs",
  },
  {
    id: "V",
    accession: "1632.7",
    A: [325, 326, 327],
    B: [355, 360, 358, 351, 347, 342, 338, 333, 330, 328, 326],
    sideCm: 31,
    spineCm: 27,
    heightCm: 50,
    decoration: "knobs",
  },
  {
    id: "VI",
    accession: "1632.4",
    A: [364, 363],
    B: [377, 380, 375, 373, 370, 368, 366],
    sideCm: 29.5,
    spineCm: 26.5,
    heightCm: 48,
    decoration: "knobs",
  },
  {
    id: "VII",
    accession: "1632.3",
    A: [362, 363, 364],
    B: [406, 404, 402],
    sideCm: 28,
    spineCm: 25.5,
    heightCm: 45.7,
    decoration: "knobs",
  },
  {
    id: "VIII",
    accession: "1632.2",
    A: [379, 381, 377],
    B: [409, 410, 408, 403],
    sideCm: 28.3,
    spineCm: 24.8,
    heightCm: 47,
    decoration: "knobs",
  },
  {
    id: "IX",
    accession: "1632.6",
    A: [402],
    B: [423, 420, 412, 409, 403],
    sideCm: 29,
    spineCm: 26,
    heightCm: 49.5,
    decoration: "knobs",
  },
  {
    id: "X",
    accession: "1632.1",
    A: [410],
    B: [437, 434, 431, 427, 423, 420, 413],
    sideCm: 23.3,
    spineCm: 21,
    heightCm: 36.5,
    decoration: "knobs",
  },
];
export function bellById(id: string): Bell {
  return bells.find((b) => b.id === id) ?? (bells[8] as Bell);
}
