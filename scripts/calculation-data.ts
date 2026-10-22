import { coverage, defaults, pitch, plan } from "../src/core/pitches";
import { bells } from "../src/data";
import { measurementCsv } from "../src/export";

console.log(
  JSON.stringify({
    bells,
    pitches: Array.from({ length: 21 }, (_, i) => 430 + i).flatMap((reference) =>
      bells.flatMap((b) =>
        [...b.A, ...b.B].map((hz) => ({ hz, reference, ...pitch(hz, reference) })),
      ),
    ),
    coverage: (["burial", "decoration"] as const).flatMap((group) =>
      (["leading", "all"] as const).flatMap((values) =>
        [430, 440, 450].map((reference) => {
          const result = coverage({ ...defaults, group, values, reference });
          return {
            group,
            values,
            reference,
            entries: result.rows.length,
            keys: result.keys,
            rows: result.rows,
          };
        }),
      ),
    ),
    plans: bells.flatMap((b) => [
      {
        bell: b.id,
        a: b.A[0],
        b: b.B[0],
        mode: "observations",
        ...plan({ ...defaults, bell: b.id }, "observations"),
      },
      ...b.A.flatMap((a) =>
        b.B.map((hz) => ({
          bell: b.id,
          a,
          b: hz,
          mode: "pair",
          ...plan({ ...defaults, bell: b.id, a, b: hz, values: "all" }, "pair"),
        })),
      ),
    ]),
    csv: measurementCsv(),
  }),
);
