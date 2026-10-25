import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const assets = {};
for (const folder of ["sources", "fonts"]) {
  for (const file of (await readdir(`public/shuang/${folder}`)).sort()) {
    const name = `${folder}/${file}`;
    assets[name] = createHash("sha256")
      .update(await readFile(path.join("public/shuang", name)))
      .digest("hex");
  }
}
await writeFile("src/shuang/assets.json", `${JSON.stringify(assets, null, 2)}\n`);
console.log(`${Object.keys(assets).length} source and font assets indexed.`);
