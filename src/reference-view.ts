import { frequency, pitch, type Reading } from "./core/pitches";
import { nearestBoundary, referenceComparison, referenceMap } from "./core/reference";
import { source } from "./data";

const name = (midi: number) => pitch(frequency(midi), 440).name;
export const referenceNumber = (value: number) => String(Number(value.toFixed(6)));

export function countProfile(s: Reading, standalone = false, compact = false): string {
  const map = referenceMap(s);
  const width = compact ? 360 : 800,
    left = compact ? 36 : 62,
    right = compact ? 342 : 772;
  const x = (reference: number) => left + ((reference - 430) * (right - left)) / 20;
  const y = (count: number) => 185 - (count - 7) * 40;
  const line = map.intervals
    .map(
      (interval, index) =>
        `${index ? "L" : "M"}${x(interval.lower)} ${y(interval.keys.length)}H${x(interval.upper)}`,
    )
    .join("");
  const marker = (reference: number, held: boolean) =>
    `<path d="M${x(reference)} 40V203" stroke="${held ? "#006a70" : "#17383f"}" stroke-width="${held ? 2 : 3}"${held ? ' stroke-dasharray="5 4"' : ""}/><path d="m${x(reference)} 37-5-9h10Z" fill="${held ? "#006a70" : "#17383f"}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="count-profile" viewBox="0 0 ${width} 245" role="img" aria-label="Modern key count across A4 references from 430 to 450 hertz: ${map.minimumCount} to ${map.maximumCount} keys for the current filters. Dashed teal line: held reference ${s.against}; solid dark line: current reference ${s.reference}."${standalone ? ' style="font-family:system-ui,sans-serif;background:white"' : ""}>
<rect width="${width}" height="245" fill="white"/><text x="${left}" y="18" fill="#17383f" font-size="14">Occupied modern keys</text>
${[7, 8, 9, 10].map((count) => `<path d="M${left} ${y(count)}H${right}" stroke="#d7e1e4"/><text x="${left - 12}" y="${y(count) + 5}" text-anchor="end" fill="#17383f" font-size="15">${count}</text>`).join("")}
<path d="${line}V203H${left}Z" fill="#efe7ef"/><path d="${line}" fill="none" stroke="#783d78" stroke-width="3"/>
${map.boundaries.map((event) => `<path d="M${x(event.reference)} 203v5" stroke="#783d78"/>`).join("")}
${marker(s.against, true)}${marker(s.reference, false)}
${[430, 435, 440, 445, 450].map((reference) => `<text x="${x(reference)}" y="229" text-anchor="middle" fill="#17383f" font-size="15">${reference}</text>`).join("")}<text x="${left}" y="243" fill="#526970" font-size="${compact ? 13 : 11}">${compact ? "A4 reference / Hz" : "A4 reference / Hz. Each short tick is a label boundary; some leave the total unchanged."}</text></svg>`;
}

export function comparisonRows(s: Reading): string {
  const comparison = referenceComparison(s);
  return comparison.changed.length
    ? `<div class="table-scroll" role="region" tabindex="0" aria-label="Entries with changed modern labels"><table><caption>Held A4: ${s.against} Hz. Current A4: ${s.reference} Hz.</caption><thead><tr><th>CsM entry</th><th>Hz</th><th>Held</th><th>Current</th></tr></thead><tbody>${comparison.changed.map((row) => `<tr><th>${row.bell} · ${row.position}${row.listPosition}</th><td>${row.hz}</td><td>${row.held.name}</td><td>${row.current.name}</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="reference-empty">No entry changes its nearest-key label between these two references.</p>';
}

export function referenceReading(s: Reading): string {
  const map = referenceMap(s),
    comparison = referenceComparison(s);
  const event = map.boundaries[nearestBoundary(map.boundaries, s.reference)];
  return `<section class="retained-reference"><h2>The same measurements, two modern grids</h2><p>Both sides retain ${map.entries.length} table entries from ${s.group === "burial" ? "all ten bells" : "the nine similarly decorated bells"}, using ${s.values === "all" ? "every listed frequency" : "the leading entries"}. The hertz measurements remain fixed.</p>
<p><strong>Held A4 ${s.against} Hz: ${comparison.heldKeys.length} keys.</strong> Current A4 ${s.reference} Hz: ${comparison.currentKeys.length} keys. Changed table entries: ${comparison.changed.length}.</p>
<div class="wide">${countProfile(s)}</div><div class="phone">${countProfile(s, false, true)}</div>${comparisonRows(s)}
<p>Across the chosen modern 430–450 Hz range, the count varies from ${map.minimumCount} to ${map.maximumCount}. The calculation solves all ${map.boundaries.length} label boundaries, including those that leave the total unchanged.</p>
${event ? `<p>Nearest boundary: A4 = ${referenceNumber(event.reference)} Hz for the reported ${event.hz} Hz. As A4 rises, ${event.entries.map((entry) => `CsM ${entry.bell} ${entry.position}${entry.listPosition}`).join(", ")} move from ${name(event.upperMidi)} to ${name(event.lowerMidi)}. The total changes from ${event.beforeKeys.length} to ${event.afterKeys.length}. The printed decimal is rounded; the calculation uses the unrounded boundary.</p>` : ""}
<p>This is sensitivity to a modern classification choice. The extra decimal places locate a calculated boundary; they do not increase the precision of the reported integer frequencies. The source supplies no measurement error bars. Table positions such as B7 mean the seventh listed B frequency, not the seventh strike.</p></section>`;
}

export function referenceCsv(s: Reading): string {
  const map = referenceMap(s),
    comparison = referenceComparison(s);
  const rows: (string | number)[][] = [
    [
      "record",
      "group",
      "values",
      "entry",
      "reported_hz",
      "a4_hz",
      "upper_a4_hz",
      "lower_inclusive",
      "upper_inclusive",
      "held_label",
      "current_label",
      "held_key_count",
      "current_key_count",
      "keys_midi",
      "source_doi",
    ],
  ];
  for (const interval of map.intervals)
    rows.push([
      "interval",
      s.group,
      s.values,
      "",
      "",
      interval.lower,
      interval.upper,
      interval.lower === 430 ? "yes" : "no",
      "yes",
      "",
      "",
      "",
      interval.keys.length,
      interval.keys.join(" "),
      source.doi,
    ]);
  for (const event of map.boundaries)
    for (const entry of event.entries)
      rows.push([
        "boundary",
        s.group,
        s.values,
        entry.id,
        entry.hz,
        event.reference,
        "",
        "",
        "",
        name(event.upperMidi),
        name(event.lowerMidi),
        event.beforeKeys.length,
        event.afterKeys.length,
        "",
        source.doi,
      ]);
  for (const row of comparison.rows)
    rows.push([
      "comparison",
      s.group,
      s.values,
      row.id,
      row.hz,
      s.against,
      s.reference,
      "",
      "",
      row.held.name,
      row.current.name,
      comparison.heldKeys.length,
      comparison.currentKeys.length,
      "",
      source.doi,
    ]);
  return `${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")}\r\n`;
}

export function referenceSvg(s: Reading): string {
  const comparison = referenceComparison(s),
    map = referenceMap(s);
  const height = 435 + Math.max(1, comparison.changed.length) * 27;
  return countProfile(s, true)
    .replace('viewBox="0 0 800 245"', `viewBox="0 0 800 ${height}"`)
    .replace('<rect width="800" height="245"', `<rect width="800" height="${height}"`)
    .replace(
      "</svg>",
      `<g fill="#17383f" font-size="15"><text x="62" y="280">Shiguzhai: ${map.entries.length} reported entries; ${s.group}, ${s.values}.</text><text x="62" y="307">Held A4 ${s.against} Hz: ${comparison.heldKeys.length} keys. Current A4 ${s.reference} Hz: ${comparison.currentKeys.length} keys.</text><text x="62" y="334">Reported Hz stay fixed. ${comparison.changed.length} table entries change their modern label.</text>${comparison.changed.map((row, index) => `<text x="62" y="${365 + index * 27}">CsM ${row.bell} ${row.position}${row.listPosition}: ${row.hz} Hz; ${row.held.name} to ${row.current.name}.</text>`).join("")}${!comparison.changed.length ? '<text x="62" y="365">No labels change between the selected references.</text>' : ""}<text x="62" y="${height - 47}" font-size="12">Li et al. (2024), Table 1, p. 6. DOI ${source.doi}</text><text x="62" y="${height - 26}" font-size="12">Modern reference sensitivity; no ancient tuning or measurement error bars inferred.</text><text x="62" y="${height - 8}" font-size="11">Original diagram and analysis: PolyForm NC, Copyright (c) 2026 Anthony Mercer.</text></g></svg>`,
    );
}
