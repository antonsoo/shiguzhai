# Public reference investigation and recovery review

Verified 2026-11-01 UTC. The [live comparison](https://antonsoo.github.io/shiguzhai/?bell=I&a=280&b=269&group=burial&values=all&reference=439.524&against=439.523#reference)
and [craft bench](https://antonsoo.github.io/shiguzhai/shuang.html) serve the
reviewed edition. The [audit](reference-audit.md) records the failures, repairs,
independent source checks and limits.

## Delivery identity

| Evidence                | Observed identity                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Production source       | `4bba688` and its fresh Node 24.22.1 archive build                                                                       |
| Audit source snapshot   | `fa723942669e0b9b18c2b1c5e214d16d6529a434`                                                                               |
| Published Pages commit  | `71e264755f8313f4c4dc239ca7f146636e2083e5`                                                                               |
| Complete current output | 37 files, produced by `npm run build` in `dist/`                                                                         |
| Public entry            | `/shiguzhai/` and `/shiguzhai/index.html` both match                                                                     |
| Deployment run          | [41255385246](https://github.com/antonsoo/shiguzhai/actions/runs/41255385246), three successful jobs with recorded steps |

The [before](reference-public-bytes-before.json) and
[after](reference-public-bytes-after.json) passes compare all canonical files,
their complete byte lengths and SHA-256 hashes with the clean build. Both
directory-entry observations bracket each pass. Prior hashed assets remain
available for cached older entry pages; extra hosted files are outside the
current 37-file inventory.

[Public source receipt](reference-public-source.json) compares 22 unauthenticated,
immutable raw artifacts with the clean synchronized source snapshot: audit,
original review, source fixtures, retained readings and numerical/recovery
receipts. These observations precede the documentation-only commit retaining
this publication record. They do not recursively claim to verify their own
future receipt.

## Operated public rooms

Chromium and Firefox at 1440 and 375 px use canonical public URLs without
response interception. [Reference review](reference-public-browser.json) covers
the exact deep link, keyboard controls, all four source-entry scopes, unchanged
frequencies and WAVs, source table, actual CSV/SVG/JSON/HTML downloads and native
readings opened with JavaScript disabled. Its simulated-offline observations
are supplemented by the stronger disconnected recovery check below.

[Craft review](reference-public-craft.json) operates all fourteen object choices,
six Chinese readings, measured and optional modern comparisons, model strike,
audio, dimensions, sharing and actual native files. The two unreported pitch
pairs remain absent. Its intentional source-corruption case refuses export.

Both rooms' Chromium HTML downloads match their retained examples byte for byte:
[reference reading, gzip](../examples/reference-reading.html.gz) and
[craft study](../examples/shuang-study.html). Craft attachment order is stable
when different sources finish last. The [reference artifact review](reference-public-artifacts.json)
checks downloaded intervals, changed entries, SVG coordinates and its five-page
printed reading. The [craft PDF review](reference-public-craft-print.json)
extracts all 36 complete language-learning fields from twelve pages and recovers
the original museum JPEG byte for byte. PDFs are untagged; physical printing
and original acoustic experiments remain unverified.

## Public repair with connections refused

[Recovery receipt](reference-public-recovery.json), both engines and widths:
1. Open both public rooms and confirm their complete current edition.
2. Substitute one source JPEG in the isolated browser's private cache. Both
   rooms withdraw their saved claim.
3. Close every local HTTPS CONNECT tunnel and refuse new connections. Repair
   remains incomplete and re-enables its action.
4. Focus the repair action, reconnect and keep that focus through the online
   recheck. Press Enter. The real canonical origin supplies the repair; the
   restored JPEG's SHA-256 matches the retained source.
5. Refuse connections again. Both rooms reload with their operated selections,
   show a complete edition and save complete native HTML readings.

The tunnel forwards opaque TLS bytes; it does not substitute public responses.
Only the private cache mutation is synthetic. This extra network boundary is
necessary because Firefox worker requests were observed reaching the origin
under Playwright's `context.setOffline` alone. The separate local upgrade test
also disables its origin after upgrading from captured prior public bytes.

## Discovery and verification boundaries

[Officina's source-word search](https://antonsoo.github.io/officina/?q=269+Hz&audience=Ancient+world)
leads to the comparison and an immutable audit review. Its own public journey
checks search, explicit copied filter links, keyboard review/lesson navigation,
operated references, the original table image and a downloaded reading.

The [source CI run](https://github.com/antonsoo/shiguzhai/actions/runs/41255383278)
did not execute its checks: the recorded job has zero steps.
[CI job evidence](reference-ci-jobs.json). This is separate from the successful
[branch deployment jobs](reference-pages-jobs.json), local clean checks and
observed public bytes. No registry release or tag is asserted.

Reproduce the public operation review after building locally:

```sh
node scripts/reference-browser.mjs /tmp/shiguzhai-public https://antonsoo.github.io/shiguzhai/
node scripts/shuang-browser-review.mjs https://antonsoo.github.io/shiguzhai/shuang.html /tmp/shuang-public
node scripts/hosted-recovery.mjs /tmp/shiguzhai-public-recovery
```

The last command modifies only its new browser contexts' private caches and
closes its local tunnel on exit. Python, Poppler and the installed Playwright
browsers are needed for the associated source, artifact and browser checks.
