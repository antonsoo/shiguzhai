import "./style.css";
import { offlineStatus } from "../offline";
import { bellAt, bells, paperPDF, paperURL } from "./bells";
import { chineseSource, museum, readings } from "./content";
import {
  anatomyDrawing,
  dimensionsDrawing,
  esc,
  intervalDrawing,
  modeDrawing,
  pitchMap,
} from "./drawing";
import {
  cents,
  decimal,
  dimensions,
  initial,
  pitches,
  proportions,
  readState,
  type State,
  scaleFrequency,
  stateQuery,
} from "./model";
import { Listening, wavBytes } from "./sound";
import { measurementsCSV, measurementTable, saveFile, studyHTML } from "./study";

let state = readState(new URLSearchParams(location.search));
const sound = new Listening();
let animation = 0;
let playbackRequest = 0;
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing listening bench");
app.innerHTML = `<a class="skip" href="#bench">Skip to the listening bench</a><div class="page">
<header class="mast"><a class="brand" href="${import.meta.env.BASE_URL}shuang.html"><span class="zh" lang="zh-Hant">雙</span>SHUANG</a><nav aria-label="Sections"><a href="#bench">Listen</a><a href="#measures">Measure</a><a href="#read">Read</a><a href="#keep">Keep</a></nav></header>
<main><section class="hero"><div><p class="eyebrow">Ancient Chinese bells / a measured listening bench</p><h1>Two voices<br>cast into <em>one bell.</em></h1></div><div><p class="intro">Strike the face. Then the flank.<br>A new voice can come from the same metal.</p><p class="small">Explore two published resonances, hear what a modern tuning grid changes, and read a bell-maker’s proportions in Chinese.</p></div></section>
<section id="bench" class="focus-target" aria-labelledby="bench-title"><div class="section-head"><p class="eyebrow">01 / Where the mallet lands</p><h2 id="bench-title">Change the mixture, not the metal.</h2></div><div class="bench"><div class="figure"><div id="mode"></div><p class="caption mode-caption">In an ideal round, symmetric bell, a rotated pair of patterns can share one frequency. A noncircular shape can separate them. These lens-like patterns are new analogies, not scanned modes of this bell. Deformation is enlarged; any animation is slowed. The coefficients describe this model’s mixture, not measured energies.</p><div id="interval-figure"></div></div>
<div class="controls"><div class="control-line"><label for="bell">Select a reported bell</label><select id="bell">${bells.map((b) => `<option value="${b.id}">${esc(b.label)}${b.location === "ROM" ? " — dimensions only" : " — Kyoto"}</option>`).join("")}</select></div><span class="source-mark">Piao-shi set / Takahashi 1989, Tables 1–2</span><dl class="frequencies"><div class="frequency"><dt>a / face end of the model</dt><dd id="a-hz"></dd></div><div class="frequency b"><dt>b / flank end of the model</dt><dd id="b-hz"></dd></div></dl><p class="caption" id="frequency-condition"></p>
<label for="strike">Model strike position <output id="strike-value" for="strike"></output></label><input id="strike" type="range" min="0" max="45" step="1"><div class="range-ends"><span>0° / a alone</span><span>45° / b alone</span></div><div class="button-row"><button class="primary" id="listen-a">Hear a</button><button class="primary" id="listen-b">Hear b</button><button id="listen-mixture">Hear this mixture</button><button id="stop">Stop</button></div><p id="sound-status" class="status" role="status">Choose a voice. Sound starts only when requested.</p><p class="caption">Synthesized, two-second damped sine waves at the selected frequencies. No ancient recording or original bell timbre is implied. Start at a comfortable listening volume.</p><p id="interval-copy" class="interval-copy"></p>
<div class="tuning-select"><label for="tuning">Compare the reported pitches with a modern grid</label><select id="tuning"><option value="measured">Published Hz / preserve the measured intervals</option><option value="semitone">Round each tone to a modern semitone grid</option></select><p class="caption" id="tuning-note"></p></div><details class="source-details"><summary>What this sound and drawing can tell you</summary><p>Different strike positions couple to different bending patterns of a noncircular bell. The resonant frequencies belong to the object; moving a mallet does not change them. This model uses cos(2θ) and sin(2θ) to separate two ideal quadrupole patterns. Its angle, contour and damping are teaching choices, not measurements of any Piao-shi bell. Higher partials, impact noise and room acoustics are absent.</p><p>The reported pitch pair is evidence. An ancient tune, exact historical timbre, or original tuning intention is not reconstructed here. <a href="${paperURL}">Read the measurement paper</a>; <a href="https://doi.org/10.1121/1.396250">Rossing et al. on two-tone bell modes (1988)</a>.</p></details></div></div></section>
<section id="measures" class="focus-target" aria-labelledby="measure-title"><div class="section-head"><p class="eyebrow">02 / What was actually reported</p><h2 id="measure-title">An interval can resist its label.</h2></div><div class="sheet"><p class="explain">The two voices of Nos. 8 and 10 are about 351 cents apart. A modern minor third is 300 cents; a major third is 400. Hear the measured pair before asking a grid to tidy it up.</p><div class="sheet-grid"><div><div id="pitch-map" class="plot" tabindex="0" role="region" aria-label="Scrollable map of reported bell frequencies"></div><p class="caption" id="map-caption"></p></div><div><h3>Fourteen bells. Twelve measured pairs.</h3><p class="small">The paper reports dimensions for fourteen bells in Kyoto and the Royal Ontario Museum. Its frequency table contains only the twelve Kyoto bells. Select a ROM bell: its dimensions remain available, while its pitches and audio remain unreported.</p><p class="small">The cents in the printed table were rounded independently. This bench calculates intervals from Hz. For No. 2, subtracting printed cents gives 305, but the interval from Hz rounds to 304. Those are different operations.</p><p class="small"><a href="${paperPDF}">Tables 1–2, printed pages 300–301</a>. The paper’s temperature condition is 30°C. Decimal places are preserved without inventing a measurement uncertainty.</p></div></div><details><summary>Inspect all reported dimensions, masses and frequencies</summary><div class="scroll" tabindex="0" role="region" aria-label="Scrollable table of all fourteen bells">${measurementTable()}</div></details>
<div class="scaling"><div><h3>Double its size. What else grew?</h3><p class="small">For this set the paper fits frequency approximately to inverse tip-to-tip width squared. It connects that fit with nearly constant wall thickness, inferred from mass. It is not a universal bell law.</p><p class="small">The conditional thin-shell comparison <strong>f ∝ h / L²</strong> gives two different answers. Keep the shape and alloy fixed, then decide whether wall thickness h grows with width L. These numbers are a separate scaling exercise; they do not change the sound above.</p></div><div><label for="scale">Linear size scale <output id="scale-value" for="scale"></output></label><input id="scale" type="range" min="50" max="200" step="1"><dl class="scale-pair"><div><dt>All lengths grow<br>f / λ</dt><dd id="scaled-wall"></dd></div><div><dt>Wall stays as thick<br>f / λ²</dt><dd id="fixed-wall"></dd></div></dl><p id="scale-copy" class="caption"></p></div></div></div></section>
<section id="read" class="proportions focus-target" aria-labelledby="read-title"><div class="section-head"><p class="eyebrow">03 / Read the maker’s arithmetic</p><h2 id="read-title">“Remove two parts.” Of which whole?</h2></div><p class="explain">A transmitted craft text gives names to a bell’s regions and rules for their sizes. Two readings of its subtraction produce different proportions. Put each beside the surviving measurements.</p><div class="proportion-layout"><div class="reading"><div class="reading-controls"><select id="reading" aria-label="Chinese reading">${readings.map((r, i) => `<option value="${i}">${i + 1}. ${esc(r.title)}</option>`).join("")}</select><button id="previous" aria-label="Previous reading">←</button><button id="next" aria-label="Next reading">→</button></div><div id="reading-body"></div><details><summary>Locate the six named measurements</summary><div id="anatomy" class="proportion-svg" tabindex="0" role="region" aria-label="Scrollable diagram locating six dimensions"></div></details><p class="caption"><a href="${chineseSource}">Zhouli, Kaogongji / Fu craft section</a>. Characters follow Wikisource revision 2159477; full stops at shortened excerpt boundaries are new. English and explanatory notes are new. Pinyin is modern Mandarin, not ancient pronunciation.</p></div><div><div class="rule-controls"><label for="rule">How are the later “two parts” understood?</label><select id="rule"><option value="successive">Take four fifths again: 10 : 8 : 8 : 6.4 : 6.4 : 5.12</option><option value="fixed">Subtract original parts: 10 : 8 : 8 : 6 : 6 : 4</option></select></div><div class="proportion-legend"><span>Reported bell</span><span>Selected reading</span></div><div id="dimension-figure" class="proportion-svg" tabindex="0" role="region" aria-label="Scrollable comparison of six bell dimensions"></div><p id="dimension-copy" class="caption"></p><details><summary>Compare the six dimensions in centimetres</summary><div id="dimension-table"></div></details></div></div>
<div class="source-photo"><figure><img src="${import.meta.env.BASE_URL}shuang/sources/cleveland-1962.44.jpg" width="463" height="600" alt="Bronze bell with raised bosses and an animal-shaped suspension handle" loading="lazy"><figcaption class="caption">Museum Open Access / CC0</figcaption></figure><div><h3>A surviving object, separately identified.</h3><p class="small">${museum.title}, ${museum.date}. ${museum.museum}, ${museum.accession}; ${museum.credit}.</p><p class="small">${museum.note}</p><div class="source-links"><a href="${museum.url}">Object record</a><a href="${museum.rights}">Rights</a><a href="${import.meta.env.BASE_URL}shuang/sources/provenance.json">Source identities</a></div></div></div></section>
<section id="keep" class="keep focus-target" aria-labelledby="keep-title"><p class="eyebrow">04 / Keep the evidence with the lesson</p><h2 id="keep-title">A listening study that stays with you.</h2><p>Save the selected synthesized strike as WAV, all fourteen measurement rows as CSV, or the current rim drawing as SVG. The complete study is a script-free HTML file with embedded fonts, the photograph, all six Chinese readings, all measurements, and three playable WAVs when pitches are reported. Print it for paper; retain the HTML or WAV for sound.</p><div class="button-row"><button id="save-wav">Save this strike / WAV</button><button id="save-csv">Measurements / CSV</button><button id="save-svg">Rim drawing / SVG</button><button id="save-study" class="primary">Keep complete study / HTML</button></div><p id="save-status" class="status" role="status"></p><label for="share-url" class="caption">Share this exact selection</label><input id="share-url" class="share-url" type="url" readonly><div class="button-row"><button id="copy-link">Copy link</button><button id="reset">Reset bench</button></div><p class="caption" id="offline-status" role="status">Checking offline edition…</p></section></main>
<footer class="footer"><span>SHUANG / <span class="chinese-inline" lang="zh-Hant">雙</span> means double.<br>New code & diagrams: MIT · New lessons: CC BY-SA 4.0</span><span><a href="${import.meta.env.BASE_URL}">Shiguzhai bells</a> · <a href="https://github.com/antonsoo/shiguzhai/blob/main/docs/shuang-model.md">Source & model</a> · <a href="${import.meta.env.BASE_URL}shuang/sources/NOTICES.txt">Credits & licenses</a><br>No account, tracking, or automatic sound.</span></footer></div>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing ${id}`);
  return node as T;
};
const say = (message: string) => {
  el("sound-status").textContent = message;
};
function halt() {
  playbackRequest++;
  sound.stop();
  cancelAnimationFrame(animation);
  animation = 0;
}
function render() {
  const b = bellAt(state.bell),
    p = pitches(b, state.tuning),
    observed = b.aHz && b.bHz ? cents(Number(b.bHz), Number(b.aHz)) : null;
  el<HTMLSelectElement>("bell").value = state.bell;
  el<HTMLInputElement>("strike").value = String(state.angle);
  el("strike-value").textContent = `${state.angle}°`;
  el<HTMLInputElement>("scale").value = String(state.size);
  el("scale-value").textContent = `${state.size / 100}×`;
  el<HTMLSelectElement>("tuning").value = state.tuning;
  el<HTMLSelectElement>("rule").value = state.rule;
  el<HTMLSelectElement>("reading").value = String(state.reading);
  el("a-hz").innerHTML = p
    ? `${state.tuning === "measured" ? b.aHz : decimal(p.a, 2)} <span class="unit">Hz</span>`
    : '<span class="unit">not reported</span>';
  el("b-hz").innerHTML = p
    ? `${state.tuning === "measured" ? b.bHz : decimal(p.b, 2)} <span class="unit">Hz</span>`
    : '<span class="unit">not reported</span>';
  el("frequency-condition").textContent = p
    ? state.tuning === "measured"
      ? "Reported at 30°C. Changing the strike leaves both frequencies fixed."
      : "Modern projection; these are calculated pitches, not the reported Hz."
    : "Dimensions are reported for this ROM bell. No Hz or mass is supplied in the paper.";
  for (const id of ["listen-a", "listen-b", "listen-mixture", "save-wav"])
    el<HTMLButtonElement>(id).disabled = !p;
  el("mode").innerHTML = modeDrawing(state);
  el("interval-figure").innerHTML = intervalDrawing(b);
  el("interval-copy").innerHTML =
    observed === null
      ? "No measured interval is available for this bell."
      : `<strong>${esc(b.label)}: ${decimal(observed, 1)} cents from reported Hz.</strong> ${observed > 340 && observed < 365 ? "Between modern minor and major thirds; rounding discards the difference." : "The dot compares its interval with modern 300-cent and 400-cent thirds."}${p && state.tuning === "semitone" ? ` The projected pair is ${decimal(cents(p.b, p.a), 1)} cents apart.` : ""}`;
  el("tuning-note").textContent =
    state.tuning === "measured"
      ? "The measured pair is the default. A modern comparison grid is optional."
      : "Each voice is rounded independently to 100-cent steps above 364.07 Hz. This is not evidence of ancient equal temperament; the anchor is not A = 440 Hz.";
  el("pitch-map").innerHTML = pitchMap(state);
  el("map-caption").textContent =
    `${state.tuning === "measured" ? "Reported Hz" : "Modern projected Hz"}, expressed in cents above the lowest reported tone, 364.07 Hz. Red = a; teal = b. Horizontal scrolling preserves the shared scale on a phone.`;
  el("scaled-wall").textContent = p
    ? `${decimal(scaleFrequency(p.a, state.size / 100, "scaled"), 2)} Hz`
    : "unreported";
  el("fixed-wall").textContent = p
    ? `${decimal(scaleFrequency(p.a, state.size / 100, "fixed"), 2)} Hz`
    : "unreported";
  el("scale-copy").textContent =
    `${b.label} tip-to-tip width: ${b.xianjian.toFixed(1)} cm → ${decimal((b.xianjian * state.size) / 100, 2)} cm. ${p ? `Starting a pitch: ${decimal(p.a, 2)} Hz${state.tuning === "semitone" ? " (modern projection)" : " (reported)"}. Both comparisons assume the same alloy and profile.` : "No starting frequency has been invented."}`;
  const r = readings[state.reading] ?? readings[0];
  if (!r) throw new Error("No readings");
  el("reading-body").innerHTML =
    `<h3>${esc(r.title)}</h3><p class="chinese" lang="zh-Hant">${esc(r.chinese)}</p><p class="translation">${esc(r.english)}</p><p class="word"><span lang="zh-Hant">${esc(r.word)}</span><span class="pinyin">${esc(r.pinyin)}</span></p><p class="small">${esc(r.gloss)}</p><p class="reading-note">${esc(r.note)}</p>`;
  el("anatomy").innerHTML = anatomyDrawing(r.fields);
  el<HTMLButtonElement>("previous").disabled = state.reading === 0;
  el<HTMLButtonElement>("next").disabled = state.reading === readings.length - 1;
  el("dimension-figure").innerHTML = dimensionsDrawing(b, state);
  el("dimension-copy").textContent =
    `${b.label}: all six dimensions are divided by its ${b.xianchang.toFixed(1)} cm ridge length and multiplied by ten. The black bars retain the reported proportions. The red rule is an interpretation of a text, not a contour reconstruction.`;
  const prediction = proportions(state.rule);
  el("dimension-table").innerHTML =
    `<table class="data-table"><thead><tr><th>Dimension</th><th>Reported / cm</th><th>Rule / cm</th></tr></thead><tbody>${dimensions.map((d, i) => `<tr><th><span class="chinese-inline" lang="zh-Hant">${d.chinese}</span> / ${esc(d.name)}</th><td>${b[d.key].toFixed(1)}</td><td>${decimal(((prediction[i] ?? 0) * b.xianchang) / 10, 3)}</td></tr>`).join("")}</tbody></table>`;
  el<HTMLInputElement>("share-url").value =
    `${location.origin}${import.meta.env.BASE_URL}shuang.html?${stateQuery(state)}#bench`;
}
function commit() {
  const next = `?${stateQuery(state)}${location.hash}`;
  // Replaying a voice should not strand Back behind identical selections.
  if (next !== `${location.search}${location.hash}`) history.pushState(null, "", next);
  render();
}
function change<K extends keyof State>(key: K, value: State[K], record = true) {
  halt();
  state = { ...state, [key]: value };
  render();
  say("Selection changed. Choose a voice to hear it.");
  if (record) commit();
}
el<HTMLSelectElement>("bell").addEventListener("change", (e) =>
  change("bell", (e.target as HTMLSelectElement).value),
);
el<HTMLSelectElement>("tuning").addEventListener("change", (e) =>
  change("tuning", (e.target as HTMLSelectElement).value as State["tuning"]),
);
el<HTMLSelectElement>("rule").addEventListener("change", (e) =>
  change("rule", (e.target as HTMLSelectElement).value as State["rule"]),
);
el<HTMLSelectElement>("reading").addEventListener("change", (e) =>
  change("reading", Number((e.target as HTMLSelectElement).value)),
);
for (const [id, key] of [
  ["strike", "angle"],
  ["scale", "size"],
] as const) {
  el<HTMLInputElement>(id).addEventListener("input", (e) =>
    change(key, Number((e.target as HTMLInputElement).value), false),
  );
  el(id).addEventListener("change", commit);
}
el("previous").addEventListener("click", () => change("reading", Math.max(0, state.reading - 1)));
el("next").addEventListener("click", () =>
  change("reading", Math.min(readings.length - 1, state.reading + 1)),
);
async function play(angle: number) {
  halt();
  state = { ...state, angle };
  commit();
  const snapshot = { ...state },
    request = playbackRequest;
  say(
    `Playing ${bellAt(snapshot.bell).label}: ${angle}° model strike, ${snapshot.tuning === "measured" ? "published frequencies" : "modern projected frequencies"}.`,
  );
  try {
    await sound.play(snapshot, () => {
      cancelAnimationFrame(animation);
      animation = 0;
      el("mode").innerHTML = modeDrawing(state);
      say("Strike finished. The resonant frequencies have not changed.");
    });
    if (request !== playbackRequest) return;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const start = performance.now();
      const frame = (now: number) => {
        el("mode").innerHTML = modeDrawing(
          snapshot,
          Math.cos(((now - start) / 1000) * 2 * Math.PI * 2),
        );
        animation = requestAnimationFrame(frame);
      };
      animation = requestAnimationFrame(frame);
    }
  } catch (error) {
    if (request !== playbackRequest) return;
    say(
      error instanceof Error
        ? `Sound unavailable: ${error.message}`
        : "Sound unavailable. You can still retain the WAV.",
    );
  }
}
el("listen-a").addEventListener("click", () => void play(0));
el("listen-b").addEventListener("click", () => void play(45));
el("listen-mixture").addEventListener("click", () => void play(state.angle));
el("stop").addEventListener("click", () => {
  halt();
  render();
  say("Stopped.");
});
el("save-wav").addEventListener("click", () => {
  saveFile(`shuang-${state.bell}-${state.angle}-${state.tuning}.wav`, wavBytes(state), "audio/wav");
  el("save-status").textContent =
    "Synthesized strike saved as WAV. The filename retains the selection.";
});
el("save-csv").addEventListener("click", () => {
  saveFile("shuang-measurements.csv", measurementsCSV(), "text/csv;charset=utf-8");
  el("save-status").textContent =
    "All fourteen measurement rows saved; unreported values remain empty.";
});
el("save-svg").addEventListener("click", () => {
  saveFile("shuang-rim.svg", modeDrawing(state), "image/svg+xml");
  el("save-status").textContent = "Current model rim saved as SVG, including its schematic label.";
});
el("save-study").addEventListener("click", async () => {
  const button = el<HTMLButtonElement>("save-study"),
    snapshot = { ...state };
  button.disabled = true;
  el("save-status").textContent = "Checking and embedding sources, fonts and sound…";
  try {
    const html = await studyHTML(snapshot);
    saveFile("shuang-study.html", html, "text/html;charset=utf-8");
    el("save-status").textContent =
      "Complete study saved. Open it from disk; print it there to keep the written lesson as PDF.";
  } catch (error) {
    el("save-status").textContent =
      error instanceof Error ? error.message : "The complete study could not be saved.";
  } finally {
    button.disabled = false;
  }
});
el("copy-link").addEventListener("click", async () => {
  const input = el<HTMLInputElement>("share-url");
  try {
    await navigator.clipboard.writeText(input.value);
    el("save-status").textContent = "Shared selection copied.";
  } catch {
    input.focus();
    input.select();
    el("save-status").textContent = "Select and copy the shared link from the field.";
  }
});
el("reset").addEventListener("click", () => {
  halt();
  state = { ...initial };
  commit();
  say("Bench reset.");
});
window.addEventListener("popstate", () => {
  halt();
  state = readState(new URLSearchParams(location.search));
  render();
  say("Shared selection restored.");
});
window.addEventListener("pagehide", halt);
render();
void offlineStatus(el("offline-status"));
