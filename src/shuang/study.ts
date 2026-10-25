import assets from "./assets.json";
import { bellAt, bells, paperURL } from "./bells";
import { chineseSource, museum, readings } from "./content";
import {
  anatomyDrawing,
  dimensionsDrawing,
  esc,
  intervalDrawing,
  modeDrawing,
  pitchMap,
} from "./drawing";
import { cents, decimal, dimensions, pitches, proportions, type State, stateQuery } from "./model";
import { wavBytes } from "./sound";

export function saveFile(name: string, content: string | Uint8Array<ArrayBuffer>, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function measurementsCSV() {
  const header =
    "bell,location,xianchang_cm,zhengchang_cm,xianjian_cm,gujian_cm,wuxiu_cm,wuguang_cm,mass_g,a_hz_30C,b_hz_30C,printed_a_cents,printed_b_cents,interval_from_hz_cents";
  return `${[header, ...bells.map((b) => [b.label, b.location, ...dimensions.map((d) => b[d.key]), b.mass, b.aHz, b.bHz, b.printedA, b.printedB, b.aHz && b.bHz ? cents(Number(b.bHz), Number(b.aHz)).toFixed(6) : null].map((v) => v ?? "").join(","))].join("\r\n")}\r\n`;
}
export function measurementTable() {
  return `<table><thead><tr><th>Bell</th>${dimensions.map((d) => `<th>${esc(d.name)} / cm</th>`).join("")}<th>Mass / g</th><th>a / Hz</th><th>b / Hz</th><th>a / cents¹</th><th>b / cents¹</th></tr></thead><tbody>${bells.map((b) => `<tr><th>${esc(b.label)}</th>${dimensions.map((d) => `<td>${b[d.key].toFixed(1)}</td>`).join("")}<td>${b.mass ?? "not reported"}</td><td>${b.aHz ?? "not reported"}</td><td>${b.bHz ?? "not reported"}</td><td>${b.printedA ?? "not reported"}</td><td>${b.printedB ?? "not reported"}</td></tr>`).join("")}</tbody></table><p>¹ The paper's printed relative cents, referenced to No. 1 a = 364.07 Hz. All frequencies are as reported for 30°C. Printed decimals are retained, not an uncertainty estimate. Table 1 supplies dimensions for 14 bells; Table 2 supplies two resonances for the 12 Kyoto bells. ROM means Royal Ontario Museum. Empty CSV cells mean unreported, never zero.</p>`;
}
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
async function collect() {
  const data: Record<string, Uint8Array> = {};
  await Promise.all(
    Object.entries(assets).map(async ([name, expected]) => {
      const response = await fetch(`${import.meta.env.BASE_URL}shuang/${name}`);
      if (!response.ok)
        throw new Error("A source or font is unavailable. Reconnect and retry the complete study.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== expected)
        throw new Error("A source or font differs from this edition. Reload online before saving.");
      data[name] = bytes;
    }),
  );
  return data;
}
export async function studyHTML(s: State) {
  const data = await collect(),
    b = bellAt(s.bell),
    p = pitches(b, s.tuning),
    rule = proportions(s.rule);
  const embedded = (name: string, mime: string) => {
    const bytes = data[name];
    if (!bytes) throw new Error(`Missing ${name}`);
    return `data:${mime};base64,${base64(bytes)}`;
  };
  const wav = (angle: number) => `data:audio/wav;base64,${base64(wavBytes({ ...s, angle }))}`;
  const audio = p
    ? [
        { angle: 0, label: "a alone: face end of the model" },
        { angle: 45, label: "b alone: flank end of the model" },
        { angle: s.angle, label: `Selected mixture: ${s.angle}°` },
      ]
        .map(
          (v) =>
            `<figure><figcaption>${esc(v.label)}</figcaption><audio controls preload="none" src="${wav(v.angle)}"></audio><p><a download="shuang-${s.bell}-${v.angle}-${s.tuning}.wav" href="${wav(v.angle)}">Keep this WAV</a></p></figure>`,
        )
        .join("")
    : "<p>No pitch is reported for this bell. No sound has been invented.</p>";
  const sources = Object.keys(data)
    .filter((name) => name.startsWith("sources/"))
    .map(
      (name) =>
        `<li><a download="${name.slice(8)}" href="${embedded(name, name.endsWith(".jpg") ? "image/jpeg" : name.endsWith(".json") ? "application/json" : "text/plain;charset=utf-8")}">${esc(name.slice(8))}</a></li>`,
    )
    .join("");
  const link = `https://antonsoo.github.io/shiguzhai/shuang.html?${stateQuery(s)}#bench`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="shuang-edition" content="${__SHIGUZHAI_EDITION__}"><title>Shuang: ${esc(b.label)}, two voices in one bell</title><style>
  @font-face{font-family:Study;src:url('${embedded("fonts/AtkinsonHyperlegibleNext.ttf", "font/ttf")}')}@font-face{font-family:Chinese;src:url('${embedded("fonts/NotoSansCJK-subset.woff2", "font/woff2")}')}*{box-sizing:border-box}body{font:18px/1.65 Study,Chinese,sans-serif;color:#272c2a;background:#f2f0e8;max-width:1000px;margin:3rem auto;padding:0 2rem}h1{font-size:3rem;line-height:1.1;font-weight:600;letter-spacing:-.04em}h2{font-size:1.8rem;font-weight:500;margin:2.4rem 0 1rem}h3{font-weight:500}a{color:inherit}svg{max-width:100%;height:auto}table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:.5rem .25rem;border-bottom:1px solid #b5bbb0}th{font-weight:600}th:first-child{white-space:nowrap}.scroll{overflow:auto}.zh{font:26px/1.9 Chinese,sans-serif}.word{font-family:Chinese,sans-serif}.pair{display:grid;grid-template-columns:1fr 1fr;gap:2rem}img{max-width:100%;height:auto}figure{margin:1.3rem 0}audio{max-width:100%}small{font-size:.8em}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 monospace}.reading{border-top:1px solid #b5bbb0;padding-top:1rem;margin-top:2rem}footer{border-top:1px solid #b5bbb0;margin-top:3rem;padding-top:1rem}@media(max-width:600px){body{padding:0 1rem;margin:2rem auto}.pair{display:block}h1{font-size:2.5rem}}@media print{@page{size:A4;margin:16mm}body{font-size:11pt;background:white;padding:0;margin:0;max-width:none}h1{font-size:28pt}h2{font-size:19pt}.sheet,.readings{break-before:page}.reading,figure,svg,tr{break-inside:avoid}.pair{display:block}svg{max-height:125mm}table{font-size:7pt;break-inside:avoid}audio{display:none}.zh{font-size:16pt}a{overflow-wrap:anywhere}pre{font-size:7pt}}
  </style></head><body><p>SHUANG / A RETAINED LISTENING STUDY</p><h1>Two voices cast into one bell</h1><p>Selected: <strong>${esc(b.label)}</strong>. Strike ${s.angle}°. ${s.tuning === "measured" ? "Published frequencies" : "Modern semitone projection anchored to 364.07 Hz"}. <a href="${link}">Restore this bench</a>.</p>
  <p>In an ideal round, symmetric bell, a rotated pair of bending patterns can share one frequency. A noncircular shape can separate that pair. Changing where such a bell is struck can change which patterns are excited. It does not retune the metal. This study isolates two published resonances, then compares measured dimensions with two readings of a transmitted Chinese proportion rule.</p>
  <div class="pair"><figure>${modeDrawing(s)}<figcaption>New quadrupole analogy on a lens-like rim. Neither a scanned mode shape nor a prediction of a particular ancient bell. Couplings are model coefficients, not measured energies. Drawing deformation is enlarged.</figcaption></figure><div><h2>${p ? `${decimal(p.a, 2)} Hz / ${decimal(p.b, 2)} Hz` : "No pitch reported"}</h2><p>${p ? `The current interval is ${decimal(cents(p.b, p.a), 3)} cents.` : "The two ROM bells have dimensions but no resonances in the paper's Table 2."}</p>${intervalDrawing(b)}<p>The interval diagram always uses reported Hz. The optional projection rounds each resonance to a 100-cent grid referenced to 364.07 Hz; it does not establish ancient equal temperament or use A = 440 Hz.</p></div></div>
  <h2>Keep the sound and its limits together</h2><p>Each embedded WAV is a newly generated two-second mono 44.1 kHz, 16-bit PCM signal: two sine waves, an 8 ms attack and a 0.65 s exponential decay, ending with a 25 ms fade. The amplitude weights are cos(2θ) and sin(2θ). Higher modes, impact noise, actual damping, room sound and the original timbre are absent. These are not recordings of the ancient objects.</p>${audio}
  <section class="sheet"><h2>Twenty-four resonances, fourteen sets of dimensions</h2>${pitchMap(s)}<p>Pitch map: ${s.tuning === "measured" ? "reported frequencies" : "modern semitone projection"}; horizontal axis in cents above 364.07 Hz. Red = a, teal = b. No. 8 and No. 10 are near 351 cents, between modern 300-cent and 400-cent thirds. Ancient tuning and corrosion cannot be inferred from a rounding grid.</p><div class="scroll">${measurementTable()}</div><p><a download="shuang-measurements.csv" href="data:text/csv;charset=utf-8;base64,${base64(new TextEncoder().encode(measurementsCSV()))}">Keep all measurements as CSV</a></p><p>Intervals in this workshop are computed from the reported Hz, rather than subtracting independently rounded printed relative cents. For example, No. 2 has printed values 201 and 506, while its interval calculated from Hz rounds to 304 cents.</p></section>
  <section class="readings"><h2>Read the bell-maker's proportions</h2><p>Source: <a href="${chineseSource}">Zhouli, Kaogongji, Fu craft section; Wikisource revision 2159477</a>. The selections retain its characters, with editorial full stops at shortened boundaries, new English explanations and modern Mandarin pinyin. Pinyin is not reconstructed ancient pronunciation.</p><p>The selected interpretation gives ${rule.join(" : ")}, in the order used below. Black bars show the selected bell, normalized to a ridge length of ten; red bars show the selected reading. Agreement is not evidence that a specific object was made from this prescription.</p>${dimensionsDrawing(b, s)}${anatomyDrawing()}
  ${readings.map((r, i) => `<article class="reading" id="reading-${i + 1}"><p>READING ${i + 1} / ${esc(r.title)}</p><p class="zh" lang="zh-Hant">${esc(r.chinese)}</p><h3>${esc(r.english)}</h3><p><span class="word" lang="zh-Hant">${esc(r.word)}</span> / ${esc(r.pinyin)} / ${esc(r.gloss)}</p><p>${esc(r.note)}</p></article>`).join("")}</section>
  <h2>Size is not enough</h2><p>The 1989 paper fits frequencies in this set approximately as inverse tip-to-tip width squared, and relates this to approximately constant wall thickness inferred from mass. It is an empirical relation within this set, not a universal law of bronze bells.</p><p>A conditional thin-shell comparison, f ∝ h/L², gives different answers depending on what grows. At scale λ = ${s.size / 100}, uniformly scaling the bell and its wall gives f/λ, while keeping wall thickness fixed gives f/λ². ${p ? `For this selected a resonance, that is ${decimal(p.a / (s.size / 100), 2)} Hz or ${decimal(p.a / (s.size / 100) ** 2, 2)} Hz.` : "No frequency is supplied for the selected bell, so neither numerical prediction is invented."} Alloy, profile and all other shape details are assumed unchanged. This is a scaling exercise, not a casting simulator.</p>
  <h2>A surviving object, separately identified</h2><div class="pair"><figure><img src="${embedded("sources/cleveland-1962.44.jpg", "image/jpeg")}" width="463" height="600" alt="Bronze bell with raised bosses and an animal-shaped suspension handle"><figcaption>${museum.museum}, ${museum.title}, ${museum.accession}; ${museum.date}; ${museum.credit}. Museum Open Access photograph and object data: CC0.</figcaption></figure><p>${esc(museum.note)} <a href="${museum.url}">Museum object record</a>; <a href="${museum.rights}">Open Access rights</a>.</p></div>
  <h2>Retained sources and rights</h2><p>Junji Takahashi (1989), “Size-frequency relation and tonal system in a set of ancient Chinese bells: Piao-shi bianzhong,” Journal of the Acoustical Society of Japan (E) 10(5), 299–303. DOI: 10.1250/ast.10.299. <a href="${paperURL}">Official article</a>. Tables 1 and 2 are transcribed as facts. The copyrighted paper and its page images are not embedded.</p><ul>${sources}</ul><pre>${esc(new TextDecoder().decode(data["sources/NOTICES.txt"]))}</pre><h3>Font notices</h3>${Object.keys(
    data,
  )
    .filter((n) => n.endsWith("OFL.txt"))
    .map(
      (n) =>
        `<details><summary>${esc(n)}</summary><pre>${esc(new TextDecoder().decode(data[n]))}</pre></details>`,
    )
    .join("")}
  <footer>New code and diagrams: MIT, © 2026 Anton Soloviev. New teaching text and adaptations of the Wikisource selections: CC BY-SA 4.0. The museum photograph is CC0. Font licenses and source notices are retained above. This HTML has no script and makes no automatic network requests. Audio plays only when requested. Printing preserves the written lesson; save the HTML or WAV to retain sound.</footer></body></html>`;
}
