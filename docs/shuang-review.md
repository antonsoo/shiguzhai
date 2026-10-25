# The listening bench: review

## What a learner can do

Choose an ancient Piao-shi bell from the reported set, hear its two published
resonances separately, then move a model strike to hear a mixture. The frequencies
stay fixed. Compare the two ideal bending patterns and their nodal points rather
than interpreting mallet position as retuning the metal.

Start with No. 8 or No. 10. Their intervals are near 351 cents. A modern semitone
projection rounds both to a 300-cent interval, discarding the measured distinction.
Keep the observed Hz, independently rounded printed cents and modern projection
separate. Select either ROM object to see real dimensions alongside unreported
pitch and mass; no note is filled in.

Change a separate size scale and compare two wall-thickness assumptions. Doubling
every dimension halves frequency under the conditional scaling model; doubling
size while retaining wall thickness quarters it. The experiment does not alter
the listening pitches or claim a universal law for bells.

Read six Chinese clauses, technical words, modern pinyin, new English and source
notes. Locate the six measurements in new front and plan diagrams. Compare two
interpretations of “remove two parts” with the surviving dimensions. The full
transmitted section and its punctuation remain available separately.

Save actual WAV, CSV and SVG files. Keep a complete script-free HTML study with
three playable WAVs, the source photograph, fonts, all Chinese readings, all
numerical rows and source notices. Reopen it from disk without automatic network
requests. Print the written lesson, or disconnect the browser after installation
and continue listening and saving new studies.

## Evidence boundaries

| Boundary                                  | Retained evidence                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original source identity and text mapping | [Source review](shuang-source-review.json): original paper SHA-256, pinned Wikisource revision, six mapped character selections and retained assets                           |
| Actual synthesized audio files            | [Independent signal review](shuang-audio-review.json): 72 complete RIFF files decoded by Python, with FFT peaks and independently fitted coefficients against source-table Hz |
| Production browser operation              | [Browser receipt](shuang-browser-review.json): Chromium and Firefox at desktop and phone widths, actual Web Audio and saved-file workflows                                    |
| Printed lesson                            | [Print receipt](shuang-print-review.json): complete teaching field strings and original museum JPEG recovered from the actual PDF                                             |
| Existing exhibit                          | [Original-room review](shuang-existing-exhibit-review.json): native observations, reference grid, audio, files and offline reading in both browsers at both widths            |
| Slow installation and upgrade             | [Controlled review](shuang-upgrade-review.json) using the [16 verified prior hosted files](shuang-prior-hosted-files.json)                                                    |

The signal oracle reviews all twelve reported bells, both tuning modes, and
strikes at 0°, 22° and 45°. It checks 44.1 kHz mono 16-bit PCM, a two-second
duration, unclipped samples, source comments, expected spectral peaks and model
coefficients. Its peak-estimation tolerance is 0.05 Hz. This is a check of the
generated signal, not a claim about ancient measurement accuracy or listening
quality through physical headphones.

The source review verifies the original PDF's identity and the exact complete Fu
section against the pinned Wikisource API revision. The table values were checked
visually against printed pages 300–301; no automatic independent table extraction
is claimed. All characters and full-width punctuation in the interface are
retained in the CJK subset; its encoded glyphs were also checked with fontTools.

The browser review compares every PCM sample supplied to Web Audio with the
quantized samples in the actual downloaded WAV. It reopens SVG and standalone
HTML, plays an embedded WAV through native media controls, verifies the embedded
CSV and source JPEG identities, and preserves unreported ROM values in both
exports. Native selection controls, range keys, browser Back and shared state
are exercised. Repeated audition leaves the history length unchanged.

Delayed AudioContext resume is tested separately with animation enabled. A
selection change cancels pending audio and animation. Of two pending strikes,
only the latest starts. Stop leaves no late animation running. A substituted
image in the isolated browser's cache is rejected before a complete study can
be downloaded.

Offline evidence means a disconnected browser context after complete edition
installation, followed by reload, listening and new exports. It does not mean
the origin machine was physically disconnected. A local test result does not
by itself establish publication. [The model notes](shuang-model.md) explain historical,
acoustic and geometrical limits.

The controlled upgrade begins with bytes that independently matched all sixteen
canonical files of the hosted one-room edition. In that prior edition, delaying
the source PDF beyond eight seconds reproduces a failure message that remains
after the worker completes. The new lifecycle observer keeps reporting the
download and eventually confirms the current complete edition. Both browsers
upgrade while the PDF is held for nine seconds, then navigate between rooms and
save a new study with the test origin disabled. Inspection after deleting the
current cache returns incomplete without recreating it. A separate cold install
also completes after the same delay. These local scenarios do not claim the new
build has been published.
