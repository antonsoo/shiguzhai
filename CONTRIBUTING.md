# Contributing

Use Node.js 24 or newer. Inside the checkout, run `npm ci` and `npm run dev`.
The exhibit is at `http://127.0.0.1:4350/shiguzhai/`.

Before proposing a change, run `npm run check` and
`python3 scripts/source-oracle.py`. For UI, audio or export changes, build and run
`node scripts/browser-review.mjs /tmp/shiguzhai-review/browser.json`, then run the
rendered and audio oracles on that report. Install Chromium and Firefox with
`npx playwright install chromium firefox` if they are absent.

Keep source order, identities and frequency occurrence counts distinct. Cite a
primary source for historical changes, preserve rights and attribution, and
label modern analytical choices. A novel interpretation belongs in explanation,
not in a silent rewrite of the published data. Source images in the offline
reading must pass their SHA-256 checks.

The application has no runtime dependencies or external requests. Keep the
375-pixel layout and keyboard controls usable. Review screenshots and printed
readings after changing their layout. The build command is `npm run build`;
GitHub Pages serves its `dist/` output from the `gh-pages` branch.
