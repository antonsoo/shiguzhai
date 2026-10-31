#!/usr/bin/env python3
"""Audit downloaded CSV/SVG and the printable reading independently of app code."""
import csv
from decimal import Decimal, ROUND_FLOOR, localcontext
import hashlib
import json
from pathlib import Path
import re
import runpy
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
folder = Path(sys.argv[1])
bells = runpy.run_path(str(ROOT / "scripts/source-oracle.py"))["published_bells"]()
entries = {f'{b["id"]}:{position}:{i + 1}': hz for b in bells
           for position in ("A", "B") for i, hz in enumerate(b[position])}
notes = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]


def midi(hz, reference):
    value = 69 + 12 * (Decimal(hz) / reference).ln() / Decimal(2).ln()
    return int((value + Decimal(".5")).to_integral_value(rounding=ROUND_FLOOR))


def key_name(key):
    return notes[key % 12] + str(key // 12 - 1)


cases = []
with localcontext() as ctx:
    ctx.prec = 60
    for configuration in json.loads((folder / "browser.json").read_text())["configurations"]:
        case_folder = folder / f'{configuration["browser"]}-{configuration["width"]}'
        raw_csv = (case_folder / "boundaries.csv").read_bytes()
        rows = list(csv.DictReader(raw_csv.decode().splitlines()))
        intervals = [row for row in rows if row["record"] == "interval"]
        boundaries = [row for row in rows if row["record"] == "boundary"]
        comparison = [row for row in rows if row["record"] == "comparison"]
        assert len(intervals) == 55 and len(comparison) == 87
        assert all(row["group"] == "burial" and row["values"] == "all" for row in rows)
        assert all(row["source_doi"] == "10.1186/s40494-024-01377-0" for row in rows)
        previous = Decimal(430)
        for row in intervals:
            lower, upper = Decimal(row["a4_hz"]), Decimal(row["upper_a4_hz"])
            assert lower == previous and lower < upper
            expected = sorted({midi(hz, (lower + upper) / 2) for hz in entries.values()})
            assert [int(key) for key in row["keys_midi"].split()] == expected
            assert int(row["current_key_count"]) == len(expected)
            assert row["upper_inclusive"] == "yes"
            assert row["lower_inclusive"] == ("yes" if lower == 430 else "no")
            previous = upper
        assert previous == 450
        for row in boundaries:
            hz, reference = entries[row["entry"]], Decimal(row["a4_hz"])
            assert int(row["reported_hz"]) == hz
            before = midi(hz, reference - Decimal(".0000001"))
            after = midi(hz, reference + Decimal(".0000001"))
            assert before == after + 1
            assert row["held_label"] == key_name(before)
            assert row["current_label"] == key_name(after)
        assert {row["entry"] for row in comparison} == set(entries)
        for row in comparison:
            hz = entries[row["entry"]]
            assert row["a4_hz"] == "439.523" and row["upper_a4_hz"] == "439.524"
            assert int(row["reported_hz"]) == hz
            assert row["held_label"] == key_name(midi(hz, Decimal("439.523")))
            assert row["current_label"] == key_name(midi(hz, Decimal("439.524")))
            assert row["held_key_count"] == "9" and row["current_key_count"] == "10"
        svg = ET.parse(case_folder / "comparison.svg").getroot()
        shape = next(node for node in svg if node.tag.endswith("path") and node.get("fill") == "#efe7ef")
        segments = re.findall(r"[ML]([\d.]+) ([\d.]+)H([\d.]+)", shape.get("d"))
        assert len(segments) == len(intervals)
        # Read the axis from the actual SVG labels, then locate every CSV interval.
        labels = {node.text: (float(node.get("x")), float(node.get("y"))) for node in svg if node.tag.endswith("text")}
        left, right = labels["430"][0], labels["450"][0]
        for (x1, y, x2), interval in zip(segments, intervals, strict=True):
            lower = 430 + 20 * (float(x1) - left) / (right - left)
            upper = 430 + 20 * (float(x2) - left) / (right - left)
            assert abs(lower - float(interval["a4_hz"])) < 1e-10
            assert abs(upper - float(interval["upper_a4_hz"])) < 1e-10
            # Tick text baselines are five SVG units below the corresponding grid.
            expected_y = labels[interval["current_key_count"]][1] - 5
            assert abs(float(y) - expected_y) < 1e-10
        cases.append({"browser": configuration["browser"], "width": configuration["width"],
                      "sourceEntries": len(comparison), "csvIntervals": len(intervals),
                      "csvBoundaryEntries": len(boundaries), "svgSegments": len(segments),
                      "csvSha256": hashlib.sha256(raw_csv).hexdigest()})

pdf = folder / "chromium-1440/reading.pdf"
text = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"], text=True)
for expected in ["The same measurements, two modern grids", "Held A4 439.523 Hz: 9 keys.",
                 "Current A4 439.524 Hz: 10 keys.", "Changed table entries: 1.",
                 "The published table", "Copyright (c) 2026 Anthony Mercer"]:
    assert expected in text, expected
bbox = ET.fromstring(subprocess.check_output(["pdftotext", "-bbox-layout", str(pdf), "-"]))
pages = [node for node in bbox.iter() if node.tag.endswith("page")]
for page in pages:
    for word in (node for node in page.iter() if node.tag.endswith("word")):
        assert 0 <= float(word.get("xMin")) < float(word.get("xMax")) <= float(page.get("width"))
        assert 0 <= float(word.get("yMin")) < float(word.get("yMax")) <= float(page.get("height"))
report = {"scope": "Actual downloaded CSV/SVG and actual printed PDF, not regenerated examples",
          "cases": cases, "pdf": {"pages": len(pages), "keyPassagesPresent": True,
          "extractedWordsInsidePages": True, "tagged": False,
          "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest()},
          "limits": "PDF is untagged; physical printing is unverified. Reported integer frequencies carry no inferred error bars."}
(folder / "artifacts.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
