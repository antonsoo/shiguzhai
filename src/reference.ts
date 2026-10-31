import { frequency, pitch, type Reading } from "./core/pitches";
import { nearestBoundary, referenceComparison, referenceMap } from "./core/reference";
import {
  comparisonRows,
  countProfile,
  referenceCsv,
  referenceNumber,
  referenceSvg,
} from "./reference-view";

const keyName = (midi: number) => pitch(frequency(midi), 440).name;
export function mountReference(
  root: HTMLElement,
  read: () => Reading,
  commit: (s: Reading, inspect?: boolean) => void,
  download: (blob: Blob, name: string) => void,
) {
  root.innerHTML = `<div class="section-heading"><h2 id="reference-title" tabindex="-1">Cross a boundary. Keep the sound.</h2><p>When does one modern label change? Does the number of occupied keys change with it? The reported hertz values stay fixed throughout.</p></div>
<button type="button" id="try-boundary">Try the 269 Hz boundary</button>
<div id="count-profile"></div><p id="profile-summary" class="small"></p><p id="profile-resolution" class="small"></p>
<div class="reference-operate"><div class="reference-boundary"><label for="boundary-choice">Inspect a label boundary</label><select id="boundary-choice"></select><div class="boundary-nav"><button type="button" id="previous-boundary">Previous boundary</button><button type="button" id="next-boundary">Next boundary</button></div><p id="boundary-description"></p><p id="boundary-entries" class="small"></p><div class="boundary-nav"><button type="button" id="cross-boundary">Compare either side</button><button type="button" id="hear-boundary">Inspect its first entry</button></div></div>
<div class="reference-numeric"><form id="precise-reference"><label for="precise-a4">Current A4 reference / Hz</label><div><input id="precise-a4" type="number" min="430" max="450" step="0.001" required><button type="submit">Use reference</button></div></form><p id="held-reference"></p><button type="button" id="hold-reference">Hold the current reference</button><p class="small">The dashed teal line is held; the solid dark line is current. Both sides always use the bell group and entry choice selected above.</p></div></div>
<div class="reference-result"><p id="reference-result" role="status" aria-atomic="true"></p><p id="reference-key-change"></p></div>
<details id="changed-entries" open><summary>Which entries change their label?</summary><p class="small">A2 means the second frequency in that bell’s A list, not the second strike. These are table entries, not independent trials or probabilities.</p><div id="reference-changes"></div></details>
<p class="reference-limits">These decimal places locate a calculated modern boundary. They do not increase the precision of the source’s integer frequencies, which have no reported error bars. This investigation cannot determine the ancient pitch standard or whether the bells formed a musical set.</p>
<div class="boundary-nav reference-downloads"><button type="button" id="save-boundary-csv">Save boundary map (CSV)</button><button type="button" id="save-reference-svg">Save comparison (SVG)</button></div><p class="small">The illustrated reading, JSON and shared link below also keep both references.</p><p id="reference-status" role="status"></p>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`) as T;
  let currentMap = referenceMap(read());
  let index = nearestBoundary(currentMap.boundaries, read().reference);
  const chosen = () => currentMap.boundaries[index];
  function update() {
    const s = read(),
      comparison = referenceComparison(s);
    currentMap = referenceMap(s);
    index = nearestBoundary(currentMap.boundaries, s.reference);
    get("count-profile").innerHTML = countProfile(
      s,
      false,
      matchMedia("(max-width:650px)").matches,
    );
    get("profile-summary").textContent =
      `${currentMap.entries.length} retained entries. Across A4 = 430–450 Hz, ${currentMap.boundaries.length} label boundaries give totals from ${currentMap.minimumCount} to ${currentMap.maximumCount} occupied modern keys.`;
    get<HTMLSelectElement>("boundary-choice").innerHTML = currentMap.boundaries
      .map(
        (event, i) =>
          `<option value="${i}">${referenceNumber(event.reference)} Hz · reported ${event.hz} Hz · ${event.beforeKeys.length} to ${event.afterKeys.length} keys</option>`,
      )
      .join("");
    get<HTMLSelectElement>("boundary-choice").value = String(index);
    const event = chosen();
    if (event) {
      get("boundary-description").textContent =
        `At about A4 = ${referenceNumber(event.reference)} Hz, reported ${event.hz} Hz is halfway between ${keyName(event.lowerMidi)} and ${keyName(event.upperMidi)}. Raising A4 across it moves the entry from ${keyName(event.upperMidi)} to ${keyName(event.lowerMidi)}; the total goes from ${event.beforeKeys.length} to ${event.afterKeys.length} keys.`;
      get("boundary-entries").textContent =
        `Crossing together: ${event.entries.map((entry) => `CsM ${entry.bell} ${entry.position}${entry.listPosition} (accession ${entry.accession})`).join("; ")}. Boundary display is rounded; calculations retain its unrounded value.`;
    }
    get<HTMLButtonElement>("previous-boundary").disabled = index === 0;
    get<HTMLButtonElement>("next-boundary").disabled = index === currentMap.boundaries.length - 1;
    get<HTMLInputElement>("precise-a4").value = String(s.reference);
    get("held-reference").textContent =
      `Held reference: A4 = ${s.against} Hz (${comparison.heldKeys.length} keys).`;
    get("reference-result").textContent =
      `Held ${s.against} Hz: ${comparison.heldKeys.length} keys. Current ${s.reference} Hz: ${comparison.currentKeys.length} keys. Changed table entries: ${comparison.changed.length} of ${comparison.rows.length}.`;
    get("reference-key-change").textContent =
      `Keys gained: ${comparison.gained.map(keyName).join(", ") || "none"}. Keys lost: ${comparison.lost.map(keyName).join(", ") || "none"}.`;
    get("profile-resolution").textContent =
      Math.abs(s.reference - s.against) < 0.01
        ? "At this scale the two reference lines overlap. The comparison below keeps their exact values."
        : "";
    get("reference-changes").innerHTML = comparisonRows(s);
  }
  function go(next: number) {
    const event = currentMap.boundaries[next];
    if (event) commit({ ...read(), reference: event.before });
  }
  get("boundary-choice").addEventListener("change", () =>
    go(Number(get<HTMLSelectElement>("boundary-choice").value)),
  );
  get("previous-boundary").addEventListener("click", () => go(index - 1));
  get("next-boundary").addEventListener("click", () => go(index + 1));
  get("cross-boundary").addEventListener("click", () => {
    const event = chosen();
    if (event) {
      commit({ ...read(), against: event.before, reference: event.after });
      get("reference-status").textContent =
        `Now comparing A4 ${event.before} Hz with ${event.after} Hz. Only the modern grid changed.`;
    }
  });
  get("hear-boundary").addEventListener("click", () => {
    const entry = chosen()?.entries[0];
    if (entry)
      commit({ ...read(), bell: entry.bell, [entry.position.toLowerCase()]: entry.hz }, true);
  });
  get("try-boundary").addEventListener("click", () => {
    const s = { ...read(), bell: "I", a: 280, b: 269, values: "all" as const };
    const event = referenceMap(s).boundaries.find((event) => event.hz === 269);
    if (event) commit({ ...s, reference: event.after, against: event.before });
  });
  get("precise-reference").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = get<HTMLInputElement>("precise-a4");
    if (input.reportValidity()) commit({ ...read(), reference: input.valueAsNumber });
  });
  get("hold-reference").addEventListener("click", () => {
    commit({ ...read(), against: read().reference });
    get("reference-status").textContent =
      `Held A4 ${read().against} Hz. Move the current reference to compare.`;
  });
  for (const [id, file, type, content] of [
    [
      "save-boundary-csv",
      "shiguzhai-reference-boundaries.csv",
      "text/csv;charset=utf-8",
      referenceCsv,
    ],
    ["save-reference-svg", "shiguzhai-reference-comparison.svg", "image/svg+xml", referenceSvg],
  ] as const)
    get(id).addEventListener("click", () => {
      download(new Blob([content(read())], { type }), file);
      get("reference-status").textContent =
        `Saved ${file} with the current filters and both references.`;
    });
  return { update };
}
