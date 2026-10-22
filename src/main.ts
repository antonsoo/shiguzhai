import { Player, renderWav } from "./audio";
import {
  centsBetween,
  coverage,
  inGroup,
  normalize,
  type Playback,
  pitch,
  plan,
  readState,
  signed,
  writeState,
} from "./core/pitches";
import { bellById, bells, source } from "./data";
import { coverageKeys, escapeHtml, pitchChart, strikeDiagram } from "./drawing";
import { illustratedReading, measurementCsv, readingSnapshot } from "./export";
import { offlineStatus } from "./offline";
import hashes from "./source-hashes.json";

const get = <T extends HTMLElement = HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing ${id}`);
  return node as T;
};
let state = readState(location.search);
const player = new Player();
let playbackGeneration = 0;
const compact = matchMedia("(max-width:650px)");
get("app").innerHTML = `
<a class="skip" href="#workshop">Skip to the measurements</a>
<header><a class="brand" href="./">Shiguzhai <span lang="zh-Hant">石鼓寨</span></a><nav aria-label="Main"><a href="#listen">Listen</a><a href="#workshop">Compare</a><a href="#evidence">Evidence</a></nav></header>
<main>
<section class="opening" aria-labelledby="title"><div class="opening-copy"><h1 id="title">Ten bells.<br>How many notes?</h1><p>These bronze bells were made in ancient China, more than three thousand years ago. Striking a different part can bring out a different pitch.</p><p>But the surviving objects do not give us a neat row of piano keys. Hear the measured frequencies. Decide what belongs in the comparison.</p><a class="primary-link" href="#listen">Hear a bell’s two reported pitches</a></div><figure class="opening-photo"><img src="./sources/li-2024-figure-3.jpg" width="1592" height="1055" alt="The almond-shaped mouth and knob decoration of a bronze bell, CsM IX"><figcaption>CsM IX, Changsha Museum 1632.6. Photograph by Kin Sum Li, figure 3 in the <a href="${source.url}">2024 study</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</figcaption></figure></section>
<section id="listen" class="listening" aria-labelledby="listen-title"><div class="section-heading"><h2 id="listen-title" tabindex="-1">Change the place you strike.</h2><p>A and B name strike positions, not musical notes.</p></div><div class="bell-list" id="bell-list" role="group" aria-label="Bell to inspect">${bells.map((b) => `<button type="button" data-bell="${b.id}" aria-pressed="false" aria-label="Inspect bell ${b.id}">${b.id}</button>`).join("")}</div>
<div class="listening-grid"><div class="bell-context"><h3 id="selected-title" tabindex="-1"></h3><p id="selected-identity"></p>${strikeDiagram()}<p id="selected-dimensions" class="small"></p><p id="excluded-selection" class="notice" hidden></p><p class="small">The drawing locates strike areas. It does not simulate the bell’s vibration. <a href="#strike-photo">See a photographed example</a>.</p></div>
<div class="sound-controls"><div class="tone-pair"><div class="tone-panel a-panel"><label for="a-frequency"><span class="position-label">A · middle of face</span><strong id="a-number"></strong></label><select id="a-frequency" aria-label="Reported A frequency"></select><p id="a-reference"></p><button type="button" data-play="A">Play A</button></div><div class="tone-panel b-panel"><label for="b-frequency"><span class="position-label">B · curved side</span><strong id="b-number"></strong></label><select id="b-frequency" aria-label="Reported B frequency"></select><p id="b-reference"></p><button type="button" data-play="B">Play B</button></div></div>
<p id="interval" class="interval"></p><div class="play-actions"><button type="button" class="primary-button" data-play="pair">Hear A then B</button><button type="button" id="stop">Stop</button><button type="button" data-play="reference">Compare B with its nearest key</button></div><p id="audio-status" role="status">Sound starts only when you press play.</p><p class="sound-boundary">You hear modern sine tones at the selected frequencies, not recordings or reconstructed bell timbre. The piano comparison uses modern equal temperament. <span id="audio-reference"></span></p><p id="frequency-priority" class="small"></p><div class="observation-play"><button type="button" data-play="observations">Hear every B value</button><p>One short tone per listed value, in table order. This sequence is a comparison, not a melody or the order of the original strikes.</p></div><button type="button" id="view-comparison" class="text-button">Find this bell in the comparison</button></div></div></section>
<section id="workshop" class="workshop" aria-labelledby="workshop-title"><div class="section-heading"><h2 id="workshop-title" tabindex="-1">What changes when you keep every measurement?</h2><p>The source lists several frequencies for some strike positions. Keep them visible instead of making each bell fit a single modern note.</p></div>
<div class="comparison-controls"><fieldset><legend>Which bells belong together?</legend><label><input type="radio" name="group" value="burial"> Same June 1993 find · 10 bells</label><label><input type="radio" name="group" value="decoration"> Similar knob decoration · 9 bells</label></fieldset><fieldset><legend>Which reported values do you keep?</legend><label><input type="radio" name="values" value="leading"> Leading table entries · one A and one B</label><label><input type="radio" name="values" value="all"> Every listed frequency</label></fieldset></div>
<fieldset class="reference-control"><legend>Move the modern reference grid.</legend><div><label for="reference-pitch">A4 reference: <output id="reference-value" for="reference-pitch">440 Hz</output></label><input type="range" id="reference-pitch" min="430" max="450" step="1" value="440"><button type="button" id="reset-reference">Use the study’s 440 Hz reference</button></div><p>The hertz measurements stay fixed. Only the present-day key labels move. This slider explores a classification choice; it does not tune the ancient bells.</p></fieldset><div class="chart-summary"><p id="coverage-summary" aria-live="polite"></p><div class="chart-legend"><span><i class="a-dot" aria-hidden="true"></i> A position</span><span><i class="b-diamond" aria-hidden="true"></i> B position</span></div></div>
<div id="pitch-chart"></div><p class="chart-help">Select a bell’s row to inspect it above. Marks use a logarithmic frequency axis; the grid is a modern reference.</p><div id="coverage-keys"></div><p class="interpretation">Nearest-key coverage is a classification, not evidence that ancient makers used equal temperament. Empty keys mean that no plotted value rounds to that key; they do not prove an ancient musician could never sound it.</p>
<div class="try-observation"><div><h3>Find the extra key.</h3><p>Bell I’s leading B value is 283 Hz. The full list also includes 269 Hz, close to a different modern key. At the study’s 440 Hz reference, 269 Hz is only 1.9 cents below the boundary between C4 and C♯4. The source gives integer hertz values without measurement error bars. Listen, then move the modern reference grid and watch the key count change.</p></div><button type="button" id="try-low-b">Inspect bell I at 269 Hz</button></div>
<details class="measurement-details"><summary>Read all reported frequencies and object identities</summary><p>Each list preserves the table’s order. The first B entry is the clearest or most often occurring according to the authors. The first A is simply the first listed. Repeated frequencies were omitted by the study: these are neither frequency occurrence counts nor a time series.</p><div class="table-scroll" role="region" tabindex="0" aria-label="Published measurements; scroll horizontally to read every column"><table><thead><tr><th>Bell</th><th>Accession</th><th>A / Hz</th><th>B / Hz</th><th>Side / cm</th></tr></thead><tbody>${bells.map((b) => `<tr><th>CsM ${b.id}</th><td>${b.accession}</td><td>${b.A.join(", ")}</td><td>${b.B.join(", ")}</td><td>${b.sideCm}</td></tr>`).join("")}</tbody></table></div></details>
<div class="save-actions"><button type="button" id="share">Copy this reading’s link</button><button type="button" id="save-reading">Save illustrated reading</button><button type="button" id="save-wav">Save A then B (WAV)</button><button type="button" id="save-csv">Save all measurements (CSV)</button><button type="button" id="save-json">Save comparison data (JSON)</button><p id="save-status" role="status"></p></div></section>
<section class="grouping" aria-labelledby="grouping-title"><h2 id="grouping-title">A set is a question, too.</h2><div class="grouping-copy"><p>Nine bells share a knob-covered design. Bell III looks different. All ten were found together in June 1993. Should appearance or their available pitches decide what counts as a musical set?</p><p>Li and colleagues argue for comparing the sounds as well as the objects. Their argument is an interpretation of the evidence. The switches above expose two of the choices involved.</p></div><figure class="nine-photo"><img src="./sources/li-2024-figure-5.jpg" width="1959" height="267" loading="lazy" alt="Nine knob-decorated bronze bells displayed together in the Changsha Museum"><figcaption>The nine similarly decorated bells. Kin Sum Li, figure 5, CC BY 4.0. This display photograph does not establish their ancient hanging or playing arrangement.</figcaption></figure><div class="outlier"><figure><img src="./sources/li-2024-figure-2.jpg" width="896" height="1354" loading="lazy" alt="The differently decorated bell CsM III, Changsha Museum 1633"><figcaption>CsM III, Changsha Museum 1633. Kin Sum Li, figure 2, CC BY 4.0.</figcaption></figure><div><h3>Different decoration. Still part of the find.</h3><p>Its A list is 313 and 312 Hz. Its B list extends from 306 to 350 Hz. The source’s leading B value is 350 Hz.</p><p>Neither the list’s spread nor its first entry tells us how often ancient players used each pitch. The study supplies no counts of how often each frequency occurred, and these measurements were made on the surviving bell in 2022.</p><button type="button" id="try-bell-iii">Inspect bell III’s full list</button></div></div></section>
<section class="context" aria-labelledby="context-title"><h2 id="context-title">Seventeen from the hill. Ten in this comparison.</h2><ol class="finds"><li><strong>1959</strong><span>Five bells found in one pit.</span></li><li class="included-find"><strong>June 1993</strong><span>Ten bells found together. These are the ten plotted here.</span></li><li><strong>August 1993</strong><span>Two more bells recovered from the hill.</span></li><li><strong>August 2022</strong><span>The measurements used here were made in the Changsha Museum.</span></li></ol><p>The paper dates the manufacture of these ten bells to the twelfth century BCE. Find dates, manufacture dates and modern measurement dates answer different questions. Its table includes two additional bells; this exhibit keeps their data outside the ten-bell comparison.</p></section>
<section class="names" aria-labelledby="names-title"><h2 id="names-title">Names to carry with you.</h2><div class="word-list"><article><h3 lang="zh-Hant">鐃</h3><p><strong>náo</strong> · the bell type studied here</p><p>These bells are positioned with the mouth up and shank below. Their form differs from the hanging bells often pictured in later ensembles. <a href="https://dict.variants.moe.edu.tw/dictView.jsp?ID=-47619&la=1">Character and modern reading</a>.</p></article><article><h3 lang="zh-Hant">鐘</h3><p><strong>zhōng</strong> · bell</p><p>A general bell word. Modern Mandarin pronunciation helps you read museum labels; it is not a reconstruction of Bronze Age speech. <a href="https://dict.mini.moe.edu.tw/SearchIndex/searchResult?dictSearchField=%E9%90%98&searchType=one">Dictionary</a>.</p></article><article><h3 lang="zh-Hant">編鐘</h3><p><strong>biānzhōng</strong> · an ordered set of bells</p><p>A useful comparison is the later ensemble of Marquis Yi of Zeng, buried in 433 BCE. Its inscriptions offer a different kind of musical evidence. <a href="https://hbww.org.cn/treasureofmuseum/p/11496.html">Hubei Provincial Museum</a>.</p></article></div><p>For another ancient musical witness, <a href="https://antonsoo.github.io/pyknon/song.html">read the Seikilos song against its surviving Greek inscription</a>. A written score and a modern measurement of an old instrument preserve different information.</p></section>
<section id="evidence" class="evidence" aria-labelledby="evidence-title"><h2 id="evidence-title" tabindex="-1">Keep the evidence in view.</h2><p><a href="${source.url}">${source.authors}, <cite>${source.title}</cite></a>. <cite>Heritage Science</cite> 12, 264 (2024), Table 1, page 6. The full paper, source table and credited photographs are bundled for offline reading.</p><div class="evidence-links"><a href="./sources/li-2024-shiguzhai.pdf#page=6">Open the paper at Table 1 (PDF)</a><a href="./sources/li-2024-table-1.html">Read the extracted source table (HTML)</a><button type="button" id="show-table">Show the printed table here</button></div><figure id="printed-table" hidden><svg class="source-table" viewBox="0 0 2600 1957" role="img" aria-label="Complete source Table 1, rotated clockwise for reading"><image href="./sources/li-2024-table-1.jpg" width="1957" height="2600" transform="translate(2600 0) rotate(90)"/></svg><figcaption>The entire page, rotated for reading. Its two leftmost bells are outside this exhibit’s ten-bell comparison. <a href="./sources/li-2024-table-1.jpg">Open the full page image</a>.</figcaption></figure>
<div class="methods"><div><h3>What was measured?</h3><p>The authors report three strikes at each of two A areas and four B areas, sometimes more at B, using a wooden mallet, recording with a laptop and analyzing frequencies in Audacity. They list distinct frequencies, omitting repetitions, and identify a leading B entry as the clearest or most often occurring.</p><p>These integers are reported measurements, not error bars or known original tunings. The exact historical performance, casting intentions and effects of condition cannot be recovered from this table alone.</p></div><figure id="strike-photo"><img src="./sources/li-2024-figure-1.jpg" width="896" height="1353" loading="lazy" alt="A different bell from the 1959 find, with A and B strike areas labeled in the source photograph"><figcaption>Anatomy example: the tiger1 bell from the 1959 find, Hunan Museum 39206. It is <strong>not one of the ten plotted bells</strong>. Labels are part of the original photograph. Kin Sum Li, figure 1, CC BY 4.0.</figcaption></figure></div><p class="license-note">Photographs and article material: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, Li et al. (2024). Source data carry the article’s CC0 notice. Photographs are unchanged; the source table and footnotes are extracted and styled, and its page image is rotated in the viewer. Diagrams, calculations and teaching text are new.</p></section>
</main><footer><a class="brand" href="./">Shiguzhai <span lang="zh-Hant">石鼓寨</span></a><span id="offline-status" role="status">Saving bells and evidence for offline use…</span><a href="https://github.com/antonsoo/shiguzhai">Source &amp; license</a></footer>`;

function stop(message = "Stopped.") {
  playbackGeneration++;
  player.stop();
  document.body.removeAttribute("data-playing");
  document.querySelectorAll(".is-sounding").forEach((mark) => {
    mark.classList.remove("is-sounding");
  });
  get("audio-status").textContent = message;
}
function update() {
  state = normalize(state);
  const bell = bellById(state.bell);
  const focusedRow = document.activeElement?.closest<HTMLElement>('[role="button"][data-bell]')
    ?.dataset.bell;
  get("selected-title").textContent = `Bell ${bell.id}`;
  get("selected-identity").textContent =
    `Changsha Museum ${bell.accession} · ${bell.decoration === "knobs" ? "knob decoration" : "animal-mask decoration"}`;
  get("selected-dimensions").textContent =
    `Reported side length ${bell.sideCm} cm; spine length ${bell.spineCm} cm; overall height ${bell.heightCm} cm. These are measurements of the surviving object.`;
  document.querySelectorAll<HTMLButtonElement>("#bell-list [data-bell]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.bell === bell.id));
  });
  for (const [id, position, value] of [
    ["a", "A", state.a],
    ["b", "B", state.b],
  ] as const) {
    get(`${id}-number`).textContent = `${value} Hz`;
    const select = get<HTMLSelectElement>(`${id}-frequency`);
    select.innerHTML = bell[position]
      .map((hz, i) => `<option value="${hz}">${hz} Hz${i === 0 ? " · leading entry" : ""}</option>`)
      .join("");
    select.value = String(value);
    get(`${id}-reference`).textContent =
      `Nearest modern key: ${pitch(value, state.reference).name}, ${signed(pitch(value, state.reference).cents)} cents`;
  }
  get("interval").textContent =
    `Selected B is ${signed(centsBetween(state.a, state.b))} cents relative to selected A. One modern semitone is 100 cents.`;
  get("frequency-priority").textContent =
    state.values === "leading"
      ? "Showing the first listed A and the source’s clearest or most often occurring B. Choose another value to show the full observation lists."
      : "Every listed frequency is visible. This retains variation; it does not assign repetition counts or probabilities.";
  get("excluded-selection").hidden = inGroup(bell, state);
  get("excluded-selection").textContent =
    "Bell III is outside the similar-decoration group. Its measurements remain available to inspect here.";
  for (const name of ["group", "values"] as const)
    document.querySelectorAll<HTMLInputElement>(`[name="${name}"]`).forEach((input) => {
      input.checked = input.value === state[name];
    });
  get<HTMLInputElement>("reference-pitch").value = String(state.reference);
  get("reference-value").textContent = `${state.reference} Hz`;
  get("audio-reference").textContent = `Current reference: A4 = ${state.reference} Hz.`;
  const c = coverage(state);
  get("coverage-summary").innerHTML =
    `<strong>${c.rows.length} plotted entries</strong> fall nearest to <strong>${c.keys.length} modern keys</strong> in C4–B4.`;
  get("pitch-chart").innerHTML = pitchChart(state, compact.matches);
  get("coverage-keys").innerHTML = coverageKeys(state);
  if (focusedRow)
    document
      .querySelector<HTMLElement>(`#pitch-chart [data-bell="${focusedRow}"]`)
      ?.focus({ preventScroll: true });
  history.replaceState(null, "", `${location.pathname}${writeState(state)}${location.hash}`);
}
function selectBell(id: string, focus = false) {
  stop("Selected another bell. Press play to hear it.");
  const bell = bellById(id);
  state = { ...state, bell: bell.id, a: bell.A[0] as number, b: bell.B[0] as number };
  update();
  if (focus) {
    get("selected-title").focus();
    get("listen").scrollIntoView();
  }
}
document.addEventListener("click", async (event) => {
  const target =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-bell],[data-play]")
      : null;
  if (target?.dataset.bell)
    selectBell(target.dataset.bell, target.closest("#pitch-chart") !== null);
  if (target?.dataset.play) {
    stop("Preparing reference tones…");
    if (target.dataset.play === "observations") {
      state = { ...state, values: "all" };
      update();
    }
    const generation = playbackGeneration;
    try {
      await player.play(
        plan(state, target.dataset.play as Playback),
        (tone) => {
          if (generation !== playbackGeneration) return;
          document.querySelectorAll(".is-sounding").forEach((mark) => {
            mark.classList.remove("is-sounding");
          });
          if (tone) {
            document.body.dataset.playing = tone.position;
            document
              .querySelectorAll(
                `#pitch-chart [data-bell="${state.bell}"] [data-position="${tone.position}"][data-hz="${tone.hz}"]`,
              )
              .forEach((mark) => {
                mark.classList.add("is-sounding");
              });
            get("audio-status").textContent = `Synthesized ${tone.label}`;
          } else document.body.removeAttribute("data-playing");
        },
        () => {
          get("audio-status").textContent = "Finished reference tones.";
        },
      );
    } catch {
      if (generation === playbackGeneration)
        get("audio-status").textContent =
          "Audio could not start. Enable sound in your browser and try again.";
    }
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element) {
    const row = event.target.closest<HTMLElement>('[role="button"][data-bell]');
    if (row?.dataset.bell) {
      event.preventDefault();
      selectBell(row.dataset.bell, true);
    }
  }
});
for (const id of ["a", "b"] as const)
  get(`${id}-frequency`).addEventListener("change", () => {
    stop("Frequency changed. Press play to hear it.");
    state = {
      ...state,
      values: "all",
      [id]: Number(get<HTMLSelectElement>(`${id}-frequency`).value),
    };
    update();
  });
for (const name of ["group", "values"] as const)
  document.querySelectorAll<HTMLInputElement>(`[name="${name}"]`).forEach((input) => {
    input.addEventListener("change", () => {
      stop("Comparison changed. Press play to hear the selected values.");
      state = { ...state, [name]: input.value };
      update();
    });
  });
get("reference-pitch").addEventListener("input", () => {
  stop("Modern reference changed. The measured hertz values are unchanged.");
  state = { ...state, reference: Number(get<HTMLInputElement>("reference-pitch").value) };
  update();
});
get("reset-reference").addEventListener("click", () => {
  stop("Restored the study’s modern reference.");
  state = { ...state, reference: 440 };
  update();
});
get("stop").addEventListener("click", () => stop());
get("view-comparison").addEventListener("click", () => {
  get("workshop-title").focus();
  get("workshop").scrollIntoView();
});
get("try-low-b").addEventListener("click", () => {
  stop();
  state = { ...state, bell: "I", a: 280, b: 269, values: "all", reference: 440 };
  update();
  get("selected-title").focus();
  get("listen").scrollIntoView();
});
get("try-bell-iii").addEventListener("click", () => {
  state = { ...state, values: "all" };
  selectBell("III", true);
});
get("show-table").addEventListener("click", () => {
  get("printed-table").hidden = !get("printed-table").hidden;
  get("show-table").textContent = get("printed-table").hidden
    ? "Show the printed table here"
    : "Hide the printed table";
});
get("share").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}${writeState(state)}#workshop`;
  try {
    await navigator.clipboard.writeText(url);
    get("save-status").textContent =
      "Copied the selected bell, frequencies, grouping and observation choice.";
  } catch {
    get("save-status").innerHTML =
      `<label for="reading-link">Copy this reading’s link</label><input id="reading-link" readonly value="${escapeHtml(url)}">`;
    get<HTMLInputElement>("reading-link").select();
  }
});
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
get("save-csv").addEventListener("click", () => {
  download(
    new Blob([measurementCsv()], { type: "text/csv;charset=utf-8" }),
    "shiguzhai-reported-measurements.csv",
  );
  get("save-status").textContent =
    "Saved all reported A and B frequencies for the ten bells, with identities and source references.";
});
get("save-json").addEventListener("click", () => {
  download(
    new Blob([`${JSON.stringify(readingSnapshot(state), null, 2)}\n`], {
      type: "application/json",
    }),
    "shiguzhai-reading.json",
  );
  get("save-status").textContent =
    "Saved the current comparison, selected values and source boundaries.";
});
get("save-wav").addEventListener("click", async () => {
  const selected = { ...state },
    button = get<HTMLButtonElement>("save-wav");
  button.disabled = true;
  try {
    download(
      await renderWav(plan(selected, "pair")),
      `shiguzhai-${selected.bell}-A${selected.a}-B${selected.b}-reference.wav`,
    );
    get("save-status").textContent =
      "Saved two synthesized reference tones: A, then B. This WAV is not a bell recording.";
  } catch {
    get("save-status").textContent = "The audio export could not be rendered. Try another browser.";
  } finally {
    button.disabled = false;
  }
});
get("save-reading").addEventListener("click", async () => {
  const selected = { ...state },
    button = get<HTMLButtonElement>("save-reading");
  button.disabled = true;
  get("save-status").textContent = "Preparing the reading with its source photographs and table…";
  try {
    const images = Object.fromEntries(
      await Promise.all(
        [
          "sources/li-2024-figure-2.jpg",
          "sources/li-2024-figure-5.jpg",
          "sources/li-2024-table-1.jpg",
          "fonts/NotoSansCJK-subset.woff2",
          "fonts/NotoCJK-OFL.txt",
        ].map(async (file) => {
          const response = await fetch(`./${file}`);
          if (!response.ok) throw new Error("Source unavailable");
          const buffer = await response.arrayBuffer();
          const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          if (digest !== hashes[file as keyof typeof hashes]) throw new Error("Source changed");
          if (file.endsWith(".txt")) return [file, new TextDecoder().decode(buffer)];
          const encoded = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(
              new Blob([buffer], { type: file.endsWith("woff2") ? "font/woff2" : "image/jpeg" }),
            );
          });
          return [file, encoded];
        }),
      ),
    );
    download(
      new Blob([illustratedReading(selected, images)], { type: "text/html;charset=utf-8" }),
      `shiguzhai-${selected.bell}-${selected.group}-${selected.values}.html`,
    );
    get("save-status").textContent =
      "Saved the selected measurements, full frequency lists, photographs and source table. Open the reading offline or print it.";
  } catch {
    get("save-status").textContent =
      "The source images could not be verified. Reconnect and try saving again.";
  } finally {
    button.disabled = false;
  }
});
compact.addEventListener("change", update);
addEventListener("popstate", () => {
  stop();
  state = readState(location.search);
  update();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
update();
if (location.hash === "#workshop" || location.hash === "#listen")
  requestAnimationFrame(() => get(location.hash.slice(1)).scrollIntoView());
void offlineStatus(get("offline-status"));
