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
