import { type Bell, measured, referenceHz } from "./bells";
import {
  coupling,
  decimal,
  dimensions,
  normalizedDimensions,
  pitches,
  proportions,
  type State,
} from "./model";
export const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const f = (n: number) => Number(n.toFixed(3));
function svg(w: number, h: number, title: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="sh-figure" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><style>.sh-figure text{font-family:Georgia,serif;fill:#272c2a;font-size:17px}.sh-figure .small{font:13px sans-serif}.sh-figure .line{stroke:#737d73;stroke-width:1.2;fill:none}.sh-figure .a{stroke:#a73b2c;fill:#a73b2c20}.sh-figure .b{stroke:#26716d;fill:#26716d20}.sh-figure .a,.sh-figure .b{stroke-width:2}.sh-figure .muted{fill:#5a655e}.sh-figure .label{paint-order:stroke;stroke:#f2f0e8;stroke-width:4;stroke-linejoin:round}</style>${body}</svg>`;
}
export function modeDrawing(s: State, phase = 1) {
  const lens = (theta: number) => {
    const radius = (142 ** 2 + 68 ** 2) / (2 * 68),
      offset = radius - 68;
    const radial =
      -offset * Math.abs(Math.sin(theta)) +
      Math.sqrt(radius ** 2 - offset ** 2 * Math.cos(theta) ** 2);
    return { x: radial * Math.cos(theta), y: radial * Math.sin(theta) };
  };
  const weights = coupling(s.angle);
  const panel = (mode: "a" | "b", cy: number) => {
    const points = (deformed: boolean) =>
      Array.from({ length: 181 }, (_, i) => {
        const theta = (i / 180) * Math.PI * 2,
          p = lens(theta);
        const basis =
          mode === "a" ? Math.cos(2 * (theta - Math.PI / 2)) : Math.sin(2 * (theta - Math.PI / 2));
        const scale = deformed ? 1 + 0.16 * phase * basis * weights[mode] : 1;
        return `${f(220 + p.x * scale)},${f(cy + p.y * scale)}`;
      }).join(" ");
    const theta = Math.PI / 2 + (s.angle * Math.PI) / 180,
      hit = lens(theta);
    const nodes = Array.from({ length: 4 }, (_, i) =>
      lens((i * Math.PI) / 2 + (mode === "a" ? Math.PI / 4 : 0)),
    );
    return `<text x="20" y="${cy - 95}">${mode} / ${mode === "a" ? "lower" : "upper"} resonance</text>
    <polyline points="${points(false)}" class="line"/>
    ${[0, 1]
      .map((i) => {
        const p = nodes[i],
          q = nodes[i + 2];
        return p && q
          ? `<path d="M${220 + p.x} ${cy + p.y}L${220 + q.x} ${cy + q.y}" stroke="#b5bbb0" stroke-dasharray="3 4"/>`
          : "";
      })
      .join("")}
    <polyline points="${points(true)}" class="${mode}"/>
    ${nodes.map((p) => `<circle cx="${220 + p.x}" cy="${cy + p.y}" r="4" fill="#f2f0e8" stroke="#737d73"/>`).join("")}
    <path d="M${254 + hit.x} ${cy + hit.y + 25}L${227 + hit.x} ${cy + hit.y + 5}" stroke="#272c2a" stroke-width="4"/>
    <circle cx="${220 + hit.x}" cy="${cy + hit.y}" r="6" fill="#272c2a"/>
    <text x="20" y="${cy + 104}" class="small">coupling ${decimal(weights[mode], 3)} / ${s.angle}° model strike</text>`;
  };
  return svg(
    440,
    510,
    "Two separate model bending patterns with their nodal points and strike couplings",
    `<text x="20" y="24" class="small">ONE RIM / TWO IDEAL BENDING PATTERNS</text>${panel("a", 145)}${panel("b", 370)}
    <text x="20" y="493" class="small">Open circles: no radial motion in that ideal pattern.</text>`,
  );
}

export function anatomyDrawing(active: readonly number[] = []) {
  const mark = (i: number, path: string, x: number, y: number) =>
    `<g opacity="${active.length === 0 || active.includes(i) ? 1 : 0.35}"><path d="${path}" stroke="#a73b2c" stroke-width="2.5" fill="none"/><circle cx="${x}" cy="${y}" r="12" fill="#f2f0e8" stroke="#a73b2c"/><text x="${x}" y="${y + 5}" text-anchor="middle">${i + 1}</text></g>`;
  return svg(
    600,
    350,
    "A new schematic locating the six named measurements, front and plan views",
    `
  <text x="20" y="24" class="small">LOCATE THE DIMENSIONS / SCHEMATIC, NOT TO SCALE</text>
  <text x="135" y="53" class="small" text-anchor="middle">front view</text><text x="420" y="53" class="small" text-anchor="middle">plan view</text>
  <path d="M75 288L92 83H228L245 288Q160 218 75 288Z" class="line"/>
  <path d="M330 170Q420 78 510 170Q420 262 330 170ZM355 170Q420 115 485 170Q420 225 355 170Z" class="line"/>
  ${mark(0, "M52 83H65M57 83V288M52 288H65", 32, 184)}
  ${mark(1, "M151 83H169M160 83V253M151 253H169", 160, 180)}
  ${mark(2, "M75 303V321M75 312H245M245 303V321", 160, 312)}
  ${mark(3, "M532 124H548M540 124V216M532 216H548", 563, 170)}
  ${mark(4, "M355 274V292M355 283H485M485 274V292", 420, 283)}
  ${mark(5, "M412 143H428M420 143V197M412 197H428", 420, 170)}
  <text x="300" y="340" class="small" text-anchor="middle">1 ridge · 2 body · 3 tip width · 4 mouth depth · 5 crown length · 6 crown breadth</text>`,
  );
}
export function intervalDrawing(bell: Bell) {
  if (!bell.aHz || !bell.bHz)
    return svg(
      440,
      160,
      "No measured interval for this bell",
      '<text x="20" y="75">No pitch reported in Table 2.</text>',
    );
  const interval = 1200 * Math.log2(Number(bell.bHz) / Number(bell.aHz)),
    x = (c: number) => 45 + (c - 250) * 1.75;
  return svg(
    440,
    160,
    "Measured interval compared with modern minor and major thirds",
    `
  <path d="M45 88H395" class="line"/>
  <path d="M${x(300)} 67V102M${x(400)} 67V102" class="line"/>
  <text x="${x(300)}" y="130" text-anchor="middle" class="small">300 / minor third</text>
  <text x="${x(400)}" y="151" text-anchor="middle" class="small">400 / major third</text>
  <circle cx="${x(interval)}" cy="88" r="6" fill="#a73b2c"/>
  <text x="${x(interval)}" y="49" text-anchor="middle">${decimal(interval, 1)} cents</text>`,
  );
}
export function dimensionsDrawing(bell: Bell, s: State) {
  const actual = normalizedDimensions(bell),
    predicted = proportions(s.rule);
  return svg(
    640,
    390,
    "Reported dimensions compared with two readings of a Chinese proportion rule",
    `
  <text x="20" y="25" class="small">NORMALIZED TO A RIDGE LENGTH OF TEN</text>
  ${dimensions.map((d, i) => `<text x="20" y="${68 + i * 51}">${esc(d.name)}</text><path d="M210 ${65 + i * 51}H${210 + (actual[i] ?? 0) * 31}" stroke="#272c2a" stroke-width="6"/><path d="M210 ${77 + i * 51}H${210 + (predicted[i] ?? 0) * 31}" stroke="#a73b2c" stroke-width="3"/><text x="${225 + (actual[i] ?? 0) * 31}" y="${70 + i * 51}" class="small">${decimal(actual[i] ?? 0, 2)} / ${predicted[i]}</text>`).join("")}`,
  );
}
export function pitchMap(s: State) {
  const w = 880,
    x = (c: number) => 70 + (c / 3600) * 730;
  return svg(
    w,
    430,
    "The twenty-four reported bell resonances relative to the lowest tone",
    `
  ${[0, 1200, 2400, 3600].map((c) => `<path d="M${x(c)} 30V392" stroke="#b6bbb0" stroke-dasharray="3 4"/><text x="${x(c)}" y="418" text-anchor="middle" class="small">${c}</text>`).join("")}
  ${measured
    .map((bell, i) => {
      const p = pitches(bell, s.tuning);
      if (!p) return "";
      const a = 1200 * Math.log2(p.a / referenceHz),
        b = 1200 * Math.log2(p.b / referenceHz),
        y = 38 + i * 31;
      return `<text x="12" y="${y + 5}" class="small">${esc(bell.label)}</text><path d="M${x(a)} ${y}H${x(b)}" stroke="${bell.id === s.bell ? "#272c2a" : "#b6bbb0"}" stroke-width="${bell.id === s.bell ? 3 : 1}"/><circle cx="${x(a)}" cy="${y}" r="5" fill="#a73b2c"/><circle cx="${x(b)}" cy="${y}" r="5" fill="#26716d"/>`;
    })
    .join("")}`,
  );
}
