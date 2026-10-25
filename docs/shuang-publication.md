# The public two-room bell edition

The new workshop is <https://antonsoo.github.io/shiguzhai/shuang.html>.
The original Shiguzhai exhibit remains at <https://antonsoo.github.io/shiguzhai/>.
They use different source sets and share one complete offline edition.

| Boundary                | Recorded identity or result                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Public source           | [311710c](https://github.com/antonsoo/shiguzhai/tree/311710c)                                         |
| Pages branch            | `2db064c`, preserving the previous branch history                                                     |
| Clean Node 24 build     | [37 identical static files](shuang-build-review.json)                                                 |
| Fresh public clone      | [Install, checks, identical build and documented development server](shuang-public-clone-review.json) |
| Canonical hosted bytes  | [37 of 37 files](shuang-hosted-files.json), root HTML checked before and after the inventory          |
| Actual hosted operation | [Chromium and Firefox, 1440px and 375px](shuang-hosted-browser.json)                                  |
| Hosted worker SHA-256   | `2be8387c5bd4dd12bd0ca0703c5e2f2d9599e4f473b0aedcbb02ccdbfee88300`                                    |

The canonical inventory completed on 25 October 2026 UTC. The hosted browser
review operated native controls, compared the actual Web Audio PCM with a saved
WAV, read all six Chinese selections, restored shared state, reopened files,
played embedded study audio and used both rooms after disconnecting the browser
context. Missing ROM pitches remained missing in the interface and exports.

The local upgrade review is a separate observation. Its starting fixture first
matched all sixteen canonical files of the previously hosted one-room edition.
The controlled server then delayed the source PDF beyond the old eight-second
timeout, installed the new edition, and disabled its origin. Both browsers
navigated between the two rooms and saved new readings. Cache inspection did not
recreate a deleted cache. [The direct review](shuang-review.md) retains the source,
signal, original-room, printed-study and upgrade evidence.

The complete printed study retains all 36 teaching field strings and the museum
JPEG byte for byte in twelve pages. Printing preserves the written lesson;
the standalone HTML or WAV retains sound. The sounds are newly synthesized,
and the drawings are teaching models, not scanned modes or ancient recordings.

Later documentation commits retain these receipts without changing application
inputs. No registry release, remote CI result or further deployment is inferred
from these checks.

A later [retained-source loader follow-up](source-json-development.md) records
the development warning correction, updated canonical hosted files and a new
actual public-browser review. This page retains the earlier publication identity.
