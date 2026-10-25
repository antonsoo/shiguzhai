import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readings } from "../src/shuang/content";

const pdf = process.argv[2],
  out = process.argv[3];
if (!pdf || !out) throw new Error("Pass the actual saved PDF and an output receipt.");
const folder = await mkdtemp(path.join(os.tmpdir(), "shuang-print-"));
const normalize = (text: string) => text.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
try {
  execFileSync("pdftotext", ["-layout", pdf, path.join(folder, "study.txt")]);
  execFileSync("pdftotext", ["-raw", pdf, path.join(folder, "raw.txt")]);
  const extracted = [
    normalize(await readFile(path.join(folder, "study.txt"), "utf8")),
    normalize(await readFile(path.join(folder, "raw.txt"), "utf8")),
  ];
  let fields = 0;
  for (const r of readings)
    for (const field of [r.chinese, r.english, r.word, r.pinyin, r.gloss, r.note]) {
      assert(
        extracted.some((text) => text.includes(normalize(field))),
        `Missing printed field in ${r.title}: ${field.slice(0, 60)}`,
      );
      fields++;
    }
  for (const text of [
    "not recordings of the ancient objects",
    "30°C",
    "ROM 1",
    "ROM 2",
    "not reported",
    "10.1250/ast.10.299",
    "Copyright",
  ]) {
    assert(
      extracted.some((value) => value.includes(normalize(text))),
      `Missing source or evidence boundary: ${text}`,
    );
  }
  execFileSync("pdfimages", ["-j", pdf, path.join(folder, "image")]);
  const expected = createHash("sha256")
    .update(await readFile("public/shuang/sources/cleveland-1962.44.jpg"))
    .digest("hex");
  const recovered = [];
  for (const name of await readdir(folder))
    if (name.endsWith(".jpg"))
      recovered.push(
        createHash("sha256")
          .update(await readFile(path.join(folder, name)))
          .digest("hex"),
      );
  assert(recovered.includes(expected), "The original museum JPEG was not recovered byte-for-byte");
  const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" }),
    pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  await writeFile(
    out,
    `${JSON.stringify(
      {
        checkedAtUtc: new Date().toISOString(),
        pdfSha256: createHash("sha256")
          .update(await readFile(pdf))
          .digest("hex"),
        pages,
        completeReadingFields: fields,
        sourceJpegRecovered: expected,
        scope:
          "All six complete Chinese/English/word/pinyin/gloss/note fields extracted from the actual browser-generated PDF; original museum JPEG recovered byte-for-byte. Written lesson only: sound remains in HTML/WAV. This is a browser print, not a tagged publication.",
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `${fields} complete reading fields and the exact museum JPEG recovered from ${pages} pages.`,
  );
} finally {
  await rm(folder, { recursive: true, force: true });
}
