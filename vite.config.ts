import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

const base = "/shiguzhai/";

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesIn(path.join(directory, entry.name))
        : Promise.resolve([path.join(directory, entry.name)]),
    ),
  );
  return nested.flat();
}

/** One retained JSON file serves Node calculations, browser code and source downloads. */
function retainedSourceJson(file: string): Plugin {
  const sourceFile = path.resolve(file),
    virtualId = "\0retained-source-json";
  return {
    name: "retained-source-json",
    enforce: "pre",
    resolveId(id, importer) {
      if (id === virtualId) return id;
      if (importer && id.startsWith(".") && path.resolve(path.dirname(importer), id) === sourceFile)
        return virtualId;
    },
    async load(id) {
      if (id !== virtualId) return;
      this.addWatchFile(sourceFile);
      return `export default ${JSON.stringify(JSON.parse(await readFile(sourceFile, "utf8")))};`;
    },
  };
}

export default defineConfig(async ({ command }) => {
  const inputFiles = [
    ...(await filesIn("src")),
    ...(await filesIn("public")),
    "index.html",
    "shuang.html",
    "vite.config.ts",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
  ].sort();
  const inputHash = createHash("sha256");
  for (const file of inputFiles) {
    inputHash.update(file);
    inputHash.update(await readFile(file));
  }
  const edition = command === "build" ? inputHash.digest("hex") : "development";
  return {
    base,
    build: { rolldownOptions: { input: { main: "index.html", shuang: "shuang.html" } } },
    define: { __SHIGUZHAI_EDITION__: JSON.stringify(edition) },
    plugins: [
      retainedSourceJson("public/shuang/sources/measurements.json"),
      {
        name: "offline-workshop",
        apply: "build",
        transformIndexHtml() {
          return [
            {
              tag: "meta",
              attrs: { name: "shiguzhai-edition", content: edition },
              injectTo: "head",
            },
          ];
        },
        async closeBundle() {
          const files = (await filesIn("dist")).filter((f) => !f.endsWith("sw.js")).sort();
          const inventory = await Promise.all(
            files.map(async (file) => {
              const bytes = await readFile(file);
              return {
                url: base + path.relative("dist", file).split(path.sep).join("/"),
                hash: createHash("sha256").update(bytes).digest("hex"),
                bytes: bytes.length,
              };
            }),
          );
          const worker = await readFile("src/offline-worker.js", "utf8");
          await writeFile(
            "dist/sw.js",
            `/* Verified offline edition ${edition}. */
const CACHE = "shiguzhai-${edition}";
const EDITION = ${JSON.stringify(edition)};
const BASE = ${JSON.stringify(base)};
const FILES = ${JSON.stringify(inventory)};
${worker}`,
          );
        },
      },
    ],
  };
});
