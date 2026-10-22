import {
  centsBetween,
  coverage,
  inGroup,
  pitch,
  type Reading,
  signed,
  writeState,
} from "./core/pitches";
import { bellById, bells, source } from "./data";
import { coverageKeys, escapeHtml, pitchChart, strikeDiagram } from "./drawing";

export function measurementCsv(): string {
  const lines = [
    "bell,accession,strike_position,source_list_position,frequency_hz,first_entry_role,source_doi,source_table",
  ];
  for (const bell of bells)
    for (const position of ["A", "B"] as const)
      bell[position].forEach((hz, i) => {
        lines.push(
          [
            `CsM ${bell.id}`,
            bell.accession,
            position,
            i + 1,
            hz,
            i === 0
              ? position === "B"
                ? "clearest or most often occurring"
                : "first listed"
              : "additional reported value",
            source.doi,
            "1",
          ].join(","),
        );
      });
  return `${lines.join("\r\n")}\r\n`;
}
export function readingSnapshot(s: Reading) {
  const bell = bellById(s.bell);
  return {
    schema: "shiguzhai-reading-v1",
    source,
    settings: s,
    selected: {
      bell: bell.id,
      accession: bell.accession,
      A: s.a,
      B: s.b,
      intervalCents: centsBetween(s.a, s.b),
    },
    comparison: coverage(s),
    limits: [
      "Reference sounds are synthesized sine tones, not recordings.",
      "Source lists omit repeated frequencies and contain no frequency occurrence counts or strike chronology.",
      `Modern note names use twelve-tone equal temperament with A4 = ${s.reference} Hz.`,
      "Nearest-key coverage does not establish an ancient tuning system.",
    ],
  };
}
export function illustratedReading(s: Reading, images: Record<string, string>): string {
  const bell = bellById(s.bell),
    c = coverage(s);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shiguzhai · bell ${s.bell} · illustrated reading</title>
<style>@font-face{font-family:Noto;src:url("${images["fonts/NotoSansCJK-subset.woff2"]}") format("woff2")} [lang="zh-Hant"]{font-family:Noto,sans-serif}body{max-width:1000px;margin:30px auto;padding:0 20px;font:17px/1.6 system-ui;color:#17383f}h1,h2,h3{line-height:1.2}a{color:#006a70}figure{margin:25px 0}img{display:block;max-width:100%;height:auto}figcaption{font-size:13px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #a8b9be;padding:10px}.scroll{overflow:auto}.pitch-chart,.strike-diagram{width:100%;height:auto}.strike-diagram{max-width:500px}.row-target{fill:transparent}.selected-row .row-target{fill:#e4eef0}.reference-line,.mouth-guide{stroke:#a8b9be;stroke-width:1}.reference-label,.row-label{fill:#17383f;font-size:13px}.chart-axis-title,.chart-footnote{font-size:12px}.tone-a{fill:#006a70}.tone-b{fill:#783d78}.selected-point{stroke:#17383f;stroke-width:1.4}.bell-mouth{fill:#edf3f5;stroke:#17383f;stroke-width:2}.mouth-guide{stroke-dasharray:4 5}.ghost-mark{opacity:.35}.strike-diagram text{font-size:14px;fill:#17383f}.strike-diagram .diagram-note{font-size:11px}.excluded-note{font-size:12px;fill:#526970}.key-strip{display:grid;grid-template-columns:repeat(12,1fr);list-style:none;padding:0;gap:4px;font-size:12px}.key-strip li{text-align:center;padding:8px 2px;border:1px solid #a8b9be}.key-strip small{display:block;font-size:9px}.present{background:#e4eef0}.absent{color:#526970}.phone{display:none}.note{border-left:4px solid #783d78;padding-left:16px}.source-table{width:100%;height:auto}footer{margin-top:30px;font-size:13px}@media(max-width:650px){.wide{display:none}.phone{display:block}.key-strip{grid-template-columns:repeat(6,1fr)}}pre{white-space:pre-wrap;font-size:12px}@media print{.font-license{display:none}body{font-size:12px;margin:0}.wide{display:block}.phone{display:none}h2,h3{break-after:avoid}tr,figure{break-inside:avoid}.pitch-chart{max-height:500px}.source-table{max-height:550px}.source-evidence{break-before:page}.source-evidence img{max-height:430px;margin:auto}}</style>
<h1>Ten bells. How many notes?</h1><p>Selected: CsM ${bell.id}, Changsha Museum ${bell.accession}. Shiguzhai, Hunan, China.</p><p class="note">A: ${s.a} Hz (${pitch(s.a, s.reference).name}, ${signed(pitch(s.a, s.reference).cents)} cents). B: ${s.b} Hz (${pitch(s.b, s.reference).name}, ${signed(pitch(s.b, s.reference).cents)} cents). The selected B is ${signed(centsBetween(s.a, s.b))} cents relative to A. Note names are modern reference labels, with A4 = ${s.reference} Hz. Moving this reference changes the labels, not the measured frequencies.</p>
${strikeDiagram()}<p>The app plays short sine tones at these frequencies. It does not reproduce the bells’ timbre or an ancient performance. The diagram locates strike areas schematically.</p>
<h2>${s.group === "burial" ? "Ten bells from one find" : "Nine bells with similar decoration"}</h2><p>${s.values === "all" ? "Every frequency listed in the source table is retained." : "One entry per strike position is plotted: the first listed A and the clearest or most often occurring B."} ${c.rows.length} plotted entries fall nearest to ${c.keys.length} modern keys in the octave C4–B4. This classification does not prove an ancient equal-tempered scale.</p><div class="wide">${pitchChart(s, false, false)}</div><div class="phone">${pitchChart(s, true, false)}</div>${coverageKeys(s)}
<h2>Keep the reported frequencies</h2><p>Values preserve the publisher’s order. First B entries are the clearest or most often occurring; the paper supplies neither frequency occurrence counts nor strike order. The first A entry has no equivalent explicit priority claim.</p><div class="scroll"><table><thead><tr><th>Bell / accession</th><th>A / Hz</th><th>B / Hz</th><th>In chosen group?</th></tr></thead><tbody>${bells.map((b) => `<tr><th>CsM ${b.id}<br>${b.accession}</th><td>${b.A.join(", ")}</td><td>${b.B.join(", ")}</td><td>${inGroup(b, s) ? "Yes" : "No · different decoration"}</td></tr>`).join("")}</tbody></table></div>
<h2>Read the evidence in context</h2><p>The paper reports measurements made in August 2022 at 22 °C, using a wooden mallet and laptop recording. These are observations of surviving objects, not measurements taken in antiquity. Its authors argue that the bells could form a musical set; grouping, surviving condition and interpretation remain part of that argument.</p><p>The ten objects were found together in June 1993. The study dates their manufacture to the twelfth century BCE. Five other bells found in 1959 and two found in August 1993 make seventeen from the hill; this comparison includes only the ten with the June-find identities and full frequency lists.</p>
<section class="source-evidence"><h2>Objects before categories</h2><figure><img src="${images["sources/li-2024-figure-5.jpg"]}" alt="Nine similarly decorated bells in a museum display"><figcaption>Nine bells with knob decoration. Li et al. (2024), figure 5. Photograph by Kin Sum Li, CC BY 4.0.</figcaption></figure><figure><img src="${images["sources/li-2024-figure-2.jpg"]}" alt="Bell CsM III with animal-mask decoration"><figcaption>The differently decorated CsM III, Changsha Museum 1633. Li et al., figure 2. Photograph by Kin Sum Li, CC BY 4.0. The complete photograph is retained.</figcaption></figure><h3>Names to carry with you</h3><p><span lang="zh-Hant">鐃</span> (<strong>náo</strong>): the mouth-up bell type studied here. <span lang="zh-Hant">鐘</span> (<strong>zhōng</strong>): bell. <span lang="zh-Hant">編鐘</span> (<strong>biānzhōng</strong>): an ordered set of bells. These are modern Mandarin readings, not reconstructed Bronze Age speech. See the app’s linked dictionaries and museum entry for the terms.</p></section>
<section class="source-evidence"><h2>The published table</h2><p>Li et al. (2024), Table 1, page 6. This page includes two additional bells outside the ten-bell comparison. Rotated for reading; text and content unchanged.</p><svg class="source-table" viewBox="0 0 2600 1957" role="img" aria-label="Complete published source table, rotated clockwise for reading"><image href="${images["sources/li-2024-table-1.jpg"]}" width="1957" height="2600" transform="translate(2600 0) rotate(90)"/></svg><p><a href="${source.url}">${source.authors}, ${source.title}</a>, <cite>Heritage Science</cite> 12, 264 (2024). <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>; the article applies CC0 to its data unless indicated otherwise.</p></section>
<footer><p><a href="https://antonsoo.github.io/shiguzhai/${writeState(s)}#workshop">Open these settings</a>. Photos and table are embedded; this document opens offline. Code, diagrams and new teaching text: MIT, Anton Soloviev, 2026. Original photos and article material retain the attribution above.</p><details class="font-license"><summary>Embedded Chinese font: copyright and license</summary><pre>${escapeHtml(images["fonts/NotoCJK-OFL.txt"] ?? "")}</pre></details></footer></html>`;
}
