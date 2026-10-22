#!/usr/bin/env python3
"""Compare app data and calculations to the publisher table, without importing app math."""
import csv
import hashlib
import io
import json
import math
from decimal import Decimal, localcontext
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


class SourceTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell, self.depth = [], None, None, 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.depth += 1
        if not self.depth:
            return
        if tag == "tr":
            self.row = []
        if tag in ("td", "th"):
            self.cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        if tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        if tag == "table":
            self.depth -= 1

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)


def published_bells():
    parser = SourceTable()
    parser.feed((ROOT / "public/sources/li-2024-table-1.html").read_text())
    rows = parser.rows
    assert len(rows) == 10 and all(len(row) == 13 for row in rows)
    bells = []
    for col in range(3, 13):
        bell = {"id": rows[0][col].removeprefix("CsM "),
                "accession": rows[3][col].removeprefix("CsM ")}
        for position, row in (("A", 1), ("B", 2)):
            # Parenthesized integers are measured hertz. Outside are modern note labels.
            text = re.search(r"\(([^()]*)\)", rows[row][col]).group(1)
            bell[position] = [int(n.strip()) for n in re.split(r"[;,]", text)]
        for name, row in (("sideCm", 4), ("spineCm", 5), ("heightCm", 9)):
            bell[name] = float(rows[row][col])
        bell["decoration"] = "animal-mask" if bell["id"] == "III" else "knobs"
        bells.append(bell)
    return bells


def modern_pitch(hz, reference=440):
    with localcontext() as ctx:
        ctx.prec = 50
        number = Decimal(69) + Decimal(12) * (Decimal(hz) / Decimal(reference)).ln() / Decimal(2).ln()
        midi = int(number.to_integral_value())
        return midi, float((number - midi) * 100)


def main():
    bells = published_bells()
    output = subprocess.check_output(
        ["node", "--import", "tsx", "scripts/calculation-data.ts"], cwd=ROOT, text=True
    )
    actual = json.loads(output)
    assert actual["bells"] == bells, "A transcribed measurement or object identity differs from the source"
    errors = []
    for entry in actual["pitches"]:
        midi, cents = modern_pitch(entry["hz"], entry["reference"])
        assert entry["midi"] == midi
        errors.append(abs(entry["cents"] - cents))
    coverage = []
    for group, values, reference in ((g,v,r) for g in ("burial","decoration") for v in ("leading","all") for r in (430,440,450)):
            entries = [(bell["id"], position, hz)
                       for bell in bells if group == "burial" or bell["id"] != "III"
                       for position in ("A", "B")
                       for hz in (bell[position] if values == "all" else bell[position][:1])]
            expected = {"group": group, "values": values, "reference": reference, "entries": len(entries),
                        "keys": sorted({modern_pitch(hz,reference)[0] for _, _, hz in entries})}
            match = next(c for c in actual["coverage"] if c["group"] == group and c["values"] == values and c["reference"]==reference)
            assert match["entries"] == expected["entries"] and match["keys"] == expected["keys"]
            assert [(r["bell"], r["position"], r["hz"]) for r in match["rows"]] == entries
            coverage.append(expected)
    csv_rows = list(csv.DictReader(io.StringIO(actual["csv"])))
    expected_rows = [(f'CsM {b["id"]}', b["accession"], pos, str(i+1), str(hz))
                     for b in bells for pos in ("A", "B") for i, hz in enumerate(b[pos])]
    assert [(r["bell"], r["accession"], r["strike_position"], r["source_list_position"], r["frequency_hz"])
            for r in csv_rows] == expected_rows
    for case in actual["plans"]:
        b = next(b for b in bells if b["id"] == case["bell"])
        expected = b["B"] if case["mode"] == "observations" else [case["a"], case["b"]]
        assert [t["hz"] for t in case["tones"]] == expected
        for t in case["tones"]:
            assert 0 <= t["start"] < t["start"] + t["duration"] <= case["duration"]
    assert max(errors) < 1e-10
    report = {"source": "Li et al. 2024, Table 1, publisher HTML, ten June 1993 bells",
              "sourceSha256": hashlib.sha256((ROOT / "public/sources/li-2024-table-1.html").read_bytes()).hexdigest(),
              "objects": len(bells), "reportedEntries": len(csv_rows),
              "dimensionsAndIdentity": "all match source table", "coverage": coverage,
              "pitchCalculation": "Python Decimal ln, 50 decimal digits, independent of JavaScript",
              "maximumCentsError": max(errors), "pitchCases": len(errors), "planCases": len(actual["plans"]),
              "csv": "all 87 rows preserve identity, source order, position and hertz",
              "limits": "Checks transcription and modern reference calculations; does not validate the original acoustic experiment."}
    target = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "docs/source-verification.json")
    target.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
