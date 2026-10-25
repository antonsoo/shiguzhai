# Two resonances, one object

## Evidence and the modern bench

The application uses the numerical facts in Tables 1 and 2 of Junji Takahashi's
1989 [measurement paper](https://doi.org/10.1250/ast.10.299). Fourteen bells have
six dimensions. Twelve Kyoto bells also have mass and two resonance values.
The two Royal Ontario Museum objects have neither reported pitch nor mass in
these tables. Those entries remain `null`, become empty CSV cells, and disable
the listening and WAV controls. Their retained studies contain no audio.

Frequency strings retain the paper's printed decimal places, including trailing
zeroes. The values are reported for 30 degrees Celsius. Decimal places are not
treated as a statement of uncertainty. The source PDF's SHA-256 is retained in
[provenance.json](../public/shuang/sources/provenance.json), alongside a record of the
Chinese digital edition and the separately identified museum photograph.

The paper's a and b labels are used without inventing Chinese tone-name
inscriptions for these particular bells. The modes are fixed properties of the
object. In an ideal rotationally symmetric bell, the two orientations can be
degenerate: they share a frequency. The noncircular cross-section removes that
rotational equivalence. A different strike can change their excitation, rather than changing
the object's frequencies.

## A deliberately small sound model

For a model angle theta between zero and 45 degrees, the a and b amplitude
coefficients are `cos(2 theta)` and `sin(2 theta)`. The two endpoints isolate one
voice each. These ideal quadrupole coefficients are not measured strike-response
curves, mode energies, or calibrated physical strike angles for an ancient bell.

Each signal contains only the two selected sinusoids. It is mono at 44,100 samples
per second and lasts two seconds. The shared envelope has an 8 ms linear attack,
a 0.65 s exponential decay and a final 25 ms linear fade. The overall coefficient
is 0.14. Original damping, transient pitch change, impact noise, higher partials,
room acoustics and historical playing technique are absent. This is an audible
frequency comparison, not a recording or reconstruction of ancient timbre.

The on-screen drawing uses a lens-like rim and ideal radial quadrupoles, enlarged
for visibility. The two patterns are drawn separately with their nodal points.
Any animation runs at a slowed two cycles per second; it does not visualize
audio-frequency motion in real time. This is neither a scanned ancient contour
nor a finite-element solution.

Web Audio and saved WAV use the same sampled signal. WAV exports are 16-bit
little-endian PCM, with RIFF INFO comments recording the selected bell, angle,
tuning choice, frequencies, source DOI and the fact that the signal is newly
synthesized. A delayed AudioContext resume is cancelled when the selection
changes or Stop is pressed; late audio and animation cannot restore old state.

## Cents and the optional modern grid

Intervals use `1200 log2(b / a)` from the reported Hz. They are not differences
between the table's independently rounded integer relative pitches. In No. 2,
the printed subtraction is 506 - 201 = 305 cents, while the interval computed
from Hz rounds to 304 cents. Both original printed values remain available.

The optional comparison rounds each resonance separately to a 100-cent grid
anchored at the lowest reported a resonance, 364.07 Hz. It is not an A = 440 Hz
projection. It does not establish ancient equal temperament. Nos. 8 and 10 have
intervals near 351 cents; the projected pairs become 300-cent intervals, which
audibly discards the measured distinction. The interval diagram always shows
the reported Hz; the pitch map and audio identify whichever mode is selected.

No melody, ancient scale-name assignment or original tuning intention is inferred
from this grid. Corrosion and change since casting are not numerically undone.

## Two interpretations of a subtraction

The Chinese reading comes from the Fu craft section of the transmitted Zhouli,
Kaogongji, [Wikisource revision 2159477](https://zh.wikisource.org/w/index.php?oldid=2159477&title=周禮/冬官考工記),
dated 29 June 2022. The complete section is retained with its original punctuation.
Six teaching selections omit intervening text and introduce full stops at
shortened clause boundaries. The characters follow the pinned reading, including
修 rather than the variant 脩 printed in the 1989 article. English explanations
are new. Pinyin is modern Mandarin, not reconstructed ancient pronunciation.
The bell-corner sense and reading of 銑 can also be checked in the
[Taiwan Ministry of Education dictionary](https://dict.revised.moe.edu.tw/dictView.jsp?ID=7130&la=0&powerMode=0).

Both interpretations begin with ridge length, body length and tip width in the
ratio 10 : 8 : 8. Subtracting two parts of the original ten gives
10 : 8 : 8 : 6 : 6 : 4. Repeatedly taking four fifths gives
10 : 8 : 8 : 6.4 : 6.4 : 5.12. The paper discusses the common reading and
Okamura's alternative. Comparing these with measured dimensions does not prove
that an individual surviving object was made from the prescription, or establish
one interpretation as the unique ancient practice. The article specifically
notes that a later thickness prescription does not match this bell set.

Each measured dimension is normalized by the same bell's ridge length, then
multiplied by ten. Red bars show the selected interpretation. The optional
centimetre table scales that rule back by the measured ridge length. The new
front and plan diagrams locate six named directions without pretending to be a
measured outline.

## Size and wall thickness

The paper's empirical inverse-square size relation concerns this particular set.
It relates the fit to approximately constant wall thickness inferred from mass,
rather than a direct thickness measurement for every bell. The bench's separate
scaling exercise uses the conditional thin-shell relationship `f proportional to
h / L^2`, holding alloy, profile and other shape details fixed.

At a linear scale lambda, scaling the wall along with every other length gives
`f / lambda`. Holding wall thickness fixed gives `f / lambda^2`. Neither is a
general casting simulator or a way to recover unreported pitches. The exercise
does not change the listening frequencies above it.

## Retained study and offline edition

The script-free HTML retains all Chinese lessons, all numerical rows, the CC0
museum photograph, local fonts and three synthesized WAVs for a reported bell.
Every source and font is checked against the build's SHA-256 manifest before
the study can be saved. Substituted or unavailable assets decline the complete
export. The standalone study makes no automatic HTTP requests. Its printed form
preserves the written lesson; the HTML or WAV is required to retain sound.

The service worker installs the whole edition using per-file integrity checks.
The status reports readiness only after the current edition's complete cache
inventory is confirmed. A different active edition is not called ready.
