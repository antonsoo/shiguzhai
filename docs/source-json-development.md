# Retained source JSON in the development server

The Node 24 development server printed Vite's public-import warning while
loading `public/shuang/sources/measurements.json` as a JavaScript module. The page and its operations loaded;
the [before receipt](source-json-before.json) retains the actual `/public/`
module request and reproduced warning.

A small Vite resolver now exposes that same retained JSON as a virtual module.
It reads the file, parses it and returns its default export, while watching the
original source. Node calculations retain their existing JSON import and the
raw public download retains its original bytes. There is one authoritative
file. No dataset, model, source reading or visual treatment changes.
The implementation follows Vite's [virtual-module API](https://v8.vite.dev/guide/api-plugin#virtual-modules-convention).

The [Node 24 development receipt](source-json-development.json) covers native
Chromium and Firefox at 375 pixels, raw-download/module identity, the substantive
experiment and a complete native study download. The server log has no
unsupported-public-import warnings and the browser makes no `/public/` module
request. In a separate temporary clone, the recipe changes one source field,
checks that reload exposes the new value, restores the original bytes and checks
the original value again. The temporary field is a watcher fixture, not a
historical reading or measured frequency.

The [reproducer](../scripts/source-json-development.mjs) requires an isolated
clone under the OS temporary directory. Run its dev server using Node 24, then:

```sh
node scripts/source-json-development.mjs BASE_URL ISOLATED_TEMP_CLONE SERVER_LOG OUTPUT_DIR
```

The supplied clone is edited and restored; the checked-out source dataset is
unchanged. This development check is separate from production build identity,
browser/offline operations and hosted publication records.

## Production review

The [clean Node 24 archive](source-json-build.json) passes `npm ci` and
`npm run check`; all 37 static files are byte identical to the reviewed
Node 26 build. The [native production review](source-json-production.json)
repeats Chromium and Firefox at 1440 and 375 pixels, complete reading/study
downloads, source images, keyboard controls and all rooms browser-offline.
The source corpus and learning model are unchanged.

The [print inspection](source-json-print.json) recovers all 36 complete Chinese
reading fields and the original museum JPEG from twelve pages. The production
review also compares native Web Audio PCM with the actual downloaded WAV.

## Hosted follow-up

The corrected source `5967891d55a94e8805963c78ea23890efd9c491f` was pushed to public `main`.
Its static output was pushed as Pages commit `4a72638df3c98fa51828bf1057042038d52937dd`
with normal history preserved. At `2026-10-25T03:22:39.688Z`, the
[canonical hosted receipt](source-json-hosted-files.json) matches all
37 current build files, with the directory entry verified before
and after the pass. The [actual hosted browser receipt](source-json-hosted-browser.json)
repeats the substantive controls, complete studies and browser-offline rooms.
The public origin remains online; browser networking is disabled for that
hosted offline review. The earlier source, model and first-publication records
are retained separately. No registry release or hosted CI run is inferred.

The [hosted study inspection](source-json-hosted-print.json) checks the actual
public download and printed source fields and recovers the original source JPEGs.
