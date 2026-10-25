# Contributing

Use Node 24 or newer, `npm ci`, then `npm run check`. Review the production build
with `npm run preview`. Keep source facts, assumptions, modern sound synthesis
and historical interpretation visibly distinct. Missing source values must remain
missing. Do not replace the observed frequencies with modern tuning by default.

Data changes require checking the printed original tables and retaining the
source identity. The source review validates known identities and text mapping;
it does not automatically extract the raster tables. Run
`python scripts/shuang-source-review.py --online` when changing source material.

To review the actual sound files, install NumPy in an isolated Python environment,
run `node --import tsx scripts/shuang-audio-cases.ts /tmp/shuang-wavs`, then
`python scripts/shuang-audio-review.py /tmp/shuang-wavs`. The oracle uses Python's WAV
decoder, FFT peaks and independent amplitude fitting against the source-table Hz.

With Playwright Chromium and Firefox available, run
`node scripts/shuang-browser-review.mjs http://127.0.0.1:4350/shiguzhai/shuang.html /tmp/shuang-browser`.
The script operates native controls, plays the actual Web Audio buffers, compares
them with saved WAV PCM, reopens standalone files, checks missing pitches and
disconnects the browser after offline installation. It also delays AudioContext
resume to check cancellation and rapid competing strikes. Inspect actual screenshots.
Use a temporary output directory; copy retained receipts only after success.

Run `node --import tsx scripts/shuang-print-review.ts ACTUAL_STUDY.pdf RECEIPT.json`
against the browser-generated PDF. This requires Poppler's `pdftotext`, `pdfimages`
and `pdfinfo`. It checks complete teaching fields and the original JPEG bytes.

The CJK font recipe requires fontTools and brotli:
`uv run --with fonttools --with brotli python scripts/shuang-prepare-font.py ORIGINAL.otf`.
The checksum-pinned source is recorded in the font provenance. Glyph shapes must
remain unchanged, source notices must remain intact, and all characters used by
the interface must be retained.

Keep dependencies small. Preserve keyboard operation, phone scrolling, reduced
motion, script-free retention and full offline installation. Publication requires
separate canonical hosted-file and hosted browser evidence. Do not treat local
checks or HTTP success as a deployment claim.
