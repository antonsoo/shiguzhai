import { coverage, frequency, inGroup, observations, pitch, type Reading } from "./core/pitches";
import { bells } from "./data";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
export function strikeDiagram(): string {
  return `<svg class="strike-diagram" viewBox="0 0 440 210" role="img" aria-label="Schematic view into a bell's almond-shaped mouth. A is at the middle of a broad face; B is towards the curved side. The opposite face offers corresponding strike positions.">
<path class="bell-mouth" d="M45 115Q220 -5 395 115Q220 235 45 115Z"/>
<path class="mouth-guide" d="M45 115H395M220 55V175"/>
<circle class="tone-a" cx="220" cy="55" r="8"/><circle class="tone-a ghost-mark" cx="220" cy="175" r="6"/>
<path class="tone-b" d="m325 66 8 8-8 8-8-8Z"/><path class="tone-b ghost-mark" d="m115 66 8 8-8 8-8-8Zm0 74 8 8-8 8-8-8Zm210 0 8 8-8 8-8-8Z"/>
<text class="a-label" x="220" y="35" text-anchor="middle">A · middle of face</text><text class="b-label" x="325" y="47" text-anchor="middle">B · curved side</text><text x="220" y="120" text-anchor="middle">View into the mouth</text><text class="diagram-note" x="220" y="204" text-anchor="middle">Strike locations only; shape and positions are schematic.</text></svg>`;
}
export function pitchChart(s: Reading, compact = false, interactive = true): string {
  const width = compact ? 420 : 1100;
  const left = compact ? 58 : 112;
  const right = compact ? 18 : 40;
  const rowHeight = compact ? 58 : 55;
  const top = 70;
  const height = top + bells.length * rowHeight + 55;
  const x = (hz: number) =>
    left + ((69 + 12 * Math.log2(hz / 440) - 59.65) / 12.0) * (width - left - right);
  const ticks = Array.from({ length: 12 }, (_, i) => 60 + i);
  return `<svg class="pitch-chart" viewBox="0 0 ${width} ${height}" role="${interactive ? "group" : "img"}" aria-label="Reported pitches by bell and strike position. Circular marks show A; diamonds show B. Positions use a logarithmic frequency axis with a modern equal-tempered reference grid. ${s.values === "all" ? "All reported frequencies." : "Leading table entries only."}">
<text class="chart-axis-title" x="${left}" y="17">Modern reference keys · A4 = ${s.reference} Hz</text>
${ticks.map((midi) => `<path class="reference-line" d="M${x(frequency(midi, s.reference))} 48V${height - 37}"/><text class="reference-label" x="${x(frequency(midi, s.reference))}" y="40" text-anchor="middle">${pitch(frequency(midi, s.reference), s.reference).name}</text>`).join("")}
${bells
  .map((b, i) => {
    const y = top + i * rowHeight + rowHeight / 2;
    const included = inGroup(b, s);
    return `<g class="chart-row${b.id === s.bell ? " selected-row" : ""}${included ? "" : " excluded-row"}" data-bell="${b.id}"${interactive ? ` role="button" tabindex="0" aria-pressed="${b.id === s.bell}" aria-label="Inspect bell ${b.id}, Changsha Museum ${b.accession}${included ? "" : ", excluded by the decoration grouping"}"` : ""}><rect class="row-target" x="1" y="${y - rowHeight / 2}" width="${width - 2}" height="${rowHeight}" rx="5"/><text class="row-label" x="${compact ? 8 : 18}" y="${y + 5}">${compact ? "" : "CsM "}${b.id}</text>
${
  included
    ? (["A", "B"] as const)
        .map((position) =>
          observations(b, position, s)
            .map((hz) => {
              const px = x(hz),
                py = y + (position === "A" ? -9 : 9);
              const selected = b.id === s.bell && hz === (position === "A" ? s.a : s.b);
              return position === "A"
                ? `<circle class="tone-a${selected ? " selected-point" : ""}" data-hz="${hz}" data-position="A" cx="${px}" cy="${py}" r="${selected ? 5 : 3.4}"/>`
                : `<path class="tone-b${selected ? " selected-point" : ""}" data-hz="${hz}" data-position="B" d="M${px} ${py - 4.5}l4.5 4.5-4.5 4.5-4.5-4.5Z"/>`;
            })
            .join(""),
        )
        .join("")
    : `<text class="excluded-note" x="${left}" y="${y + 5}">Different decoration · excluded</text>`
}</g>`;
  })
  .join("")}
<text class="chart-footnote" x="${left}" y="${height - 10}">One mark per listed frequency; repetitions omitted by the source.</text></svg>`;
}
export function coverageKeys(s: Reading): string {
  const { keys } = coverage(s);
  return `<ol class="key-strip" aria-label="Nearest modern reference keys represented by the plotted measurements">${Array.from(
    { length: 12 },
    (_, i) => 60 + i,
  )
    .map(
      (midi) =>
        `<li class="${keys.includes(midi) ? "present" : "absent"}"><span>${pitch(frequency(midi, s.reference), s.reference).name}</span><small>${keys.includes(midi) ? "present" : "absent"}</small></li>`,
    )
    .join("")}</ol>`;
}
