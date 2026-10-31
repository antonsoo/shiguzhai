#!/usr/bin/env python3
"""Read the actual publisher PDF columns independently of the retained HTML table."""
import hashlib
import json
from pathlib import Path
import re
import runpy
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
pdf = Path(sys.argv[1])
text = subprocess.check_output(["pdftotext", "-f", "6", "-l", "6", "-layout", str(pdf), "-"], text=True)
lines = text.splitlines()
header = next(line for line in lines if "Corresponding" in line and "CsM I" in line)
columns = [(match.group().removeprefix("CsM "), match.start()) for match in re.finditer(r"CsM I|\b(?:II|III|IV|V|VI|VII|VIII|IX|X)\b", header)]
assert len(columns) == 10
start_a = next(i for i, line in enumerate(lines) if line.startswith("A-tone"))
start_b = next(i for i, line in enumerate(lines) if line.startswith("B-tone"))
end_b = next(i for i, line in enumerate(lines) if line.startswith("Accession no"))
expected = runpy.run_path(str(ROOT / "scripts/source-oracle.py"))["published_bells"]()
actual = []
for index, (bell, start) in enumerate(columns):
    end = columns[index + 1][1] if index < 9 else len(header) + 40
    row = {"bell": bell}
    for position, lower, upper in [("A", start_a, start_b), ("B", start_b, end_b)]:
        column = " ".join(line[start:end] for line in lines[lower:upper])
        measurements = re.search(r"\(([\d,;\s]+)\)", column)
        assert measurements, (bell, position, column)
        values = [int(value) for value in re.split(r"[,;\s]+", measurements.group(1).strip())]
        assert values == expected[index][position], (bell, position, values, expected[index][position])
        row[position] = values
    actual.append(row)
assert pdf.read_bytes() == (ROOT / "public/sources/li-2024-shiguzhai.pdf").read_bytes()
result = {"method": "Supplied publisher PDF, printed p. 6, Poppler layout extraction by the ten original column positions; compared against the separately parsed retained publisher HTML", "publisherURL": "https://www.nature.com/articles/s40494-024-01377-0.pdf", "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(), "bytes": pdf.stat().st_size, "retainedPdfIdentical": True, "bells": actual, "entries": sum(len(row['A']) + len(row['B']) for row in actual), "limits": "Verifies source transcription and order. Does not repeat the physical acoustic experiment."}
output = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "docs/publisher-table-review.json"
output.write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
