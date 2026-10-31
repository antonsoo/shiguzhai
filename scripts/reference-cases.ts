import { defaults, pitch } from "../src/core/pitches";
import { referenceComparison, referenceMap } from "../src/core/reference";

console.log(
  JSON.stringify(
    (["burial", "decoration"] as const).flatMap((group) =>
      (["leading", "all"] as const).map((values) => {
        const s = { ...defaults, group, values },
          map = referenceMap(s);
        return {
          group,
          values,
          ...map,
          sides: map.boundaries.map((boundary) =>
            referenceComparison({ ...s, against: boundary.before, reference: boundary.after }),
          ),
          ties: map.boundaries.map((boundary) => pitch(boundary.hz, boundary.reference).midi),
        };
      }),
    ),
  ),
);
