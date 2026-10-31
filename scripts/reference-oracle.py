#!/usr/bin/env python3
"""Check analytic reference boundaries against the publisher table with Decimal."""
import hashlib
import json
from decimal import Decimal, ROUND_FLOOR, localcontext
from pathlib import Path
import runpy
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
bells = runpy.run_path(str(ROOT / "scripts/source-oracle.py"))["published_bells"]()
actual = json.loads(subprocess.check_output(
    ["node", "--import", "tsx", "scripts/reference-cases.ts"], cwd=ROOT, text=True))


def key(hz, reference):
    value = Decimal(69) + 12 * (Decimal(hz) / reference).ln() / Decimal(2).ln()
    return int((value + Decimal(".5")).to_integral_value(rounding=ROUND_FLOOR))


checked_boundaries = checked_rows = 0
reports = []
maximum_error = Decimal(0)
with localcontext() as ctx:
    ctx.prec = 60
    for case in actual:
        rows = [(b["id"], position, i + 1, hz) for b in bells
                if case["group"] == "burial" or b["id"] != "III"
                for position in ("A", "B")
                for i, hz in enumerate(b[position] if case["values"] == "all" else b[position][:1])]
        events = {}
        for bell, position, index, hz in rows:
            for lower in range(48, 85):
                reference = Decimal(hz) / (Decimal(2).ln() * (Decimal(lower) + Decimal(".5") - 69) / 12).exp()
                if 430 < reference < 450:
                    events.setdefault((reference, lower, hz), []).append(f"{bell}:{position}:{index}")
        expected = sorted(events)
        assert len(expected) == len(case["boundaries"])
        limits = [Decimal(430)] + [e[0] for e in expected] + [Decimal(450)]
        counts = []
        for index, interval in enumerate(case["intervals"]):
            lower, upper = limits[index:index + 2]
            midpoint = (lower + upper) / 2
            keys = sorted({key(hz, midpoint) for _, _, _, hz in rows})
            assert interval["keys"] == keys
            assert abs(Decimal(str(interval["lower"])) - lower) < Decimal("1e-10")
            assert abs(Decimal(str(interval["upper"])) - upper) < Decimal("1e-10")
            counts.append(len(keys))
        for event, observed, sides, tie in zip(expected, case["boundaries"], case["sides"], case["ties"], strict=True):
            reference, lower, hz = event
            error = abs(reference - Decimal(str(observed["reference"])))
            maximum_error = max(error, maximum_error)
            assert error < Decimal("1e-10")
            assert [r["id"] for r in observed["entries"]] == events[event]
            assert [r["id"] for r in sides["changed"]] == events[event]
            assert tie == lower + 1
            for row, (_, _, _, frequency) in zip(sides["rows"], rows, strict=True):
                assert row["hz"] == frequency
                assert row["held"]["midi"] == key(frequency, Decimal(str(observed["before"])))
                assert row["current"]["midi"] == key(frequency, Decimal(str(observed["after"])))
                checked_rows += 1
            checked_boundaries += 1
        reports.append({"group": case["group"], "values": case["values"], "entries": len(rows),
                        "boundaries": len(expected), "minimumCount": min(counts), "maximumCount": max(counts)})

report = {"source": "Li et al. 2024, Table 1, publisher HTML; not imported from application data",
          "sourceSha256": hashlib.sha256((ROOT / "public/sources/li-2024-table-1.html").read_bytes()).hexdigest(),
          "method": "Independent 60-digit Decimal exponentials and logarithms; all open intervals and both sides of every boundary",
          "scopes": reports, "boundariesChecked": checked_boundaries, "entryPairsChecked": checked_rows,
          "maximumBoundaryErrorHz": str(maximum_error),
          "limits": "Modern label sensitivity only. No claim about acoustic measurement accuracy or ancient tuning."}
target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs/reference-oracle.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
