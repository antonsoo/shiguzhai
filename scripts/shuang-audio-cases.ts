import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { measured } from "../src/shuang/bells";
import { initial } from "../src/shuang/model";
import { wavBytes } from "../src/shuang/sound";

const directory = process.argv[2];
if (!directory) throw new Error("Supply a temporary WAV directory");
await mkdir(directory, { recursive: true });
for (const bell of measured)
  for (const tuning of ["measured", "semitone"] as const)
    for (const angle of [0, 22, 45])
      await writeFile(
        path.join(directory, `${bell.id}-${tuning}-${angle}.wav`),
        wavBytes({ ...initial, bell: bell.id, angle, tuning }),
      );
console.log("72 complete WAV files written for independent PCM/spectrum inspection.");
