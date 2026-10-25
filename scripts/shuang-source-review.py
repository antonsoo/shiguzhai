"""Verify retained sources, their mapped character selections, and optionally the live originals."""

from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]
public = root / "public/shuang"
provenance = json.loads((public / "sources/provenance.json").read_text())
tables = json.loads((public / "sources/measurements.json").read_text())
raw = (public / "sources/kaogongji-fu-revision-2159477.txt").read_text()
selections = re.findall(r'chinese: "([^"]+)"', (root / "src/shuang/content.ts").read_text())
assert len(selections) == 6
without_punctuation = lambda text: re.sub(r"[\s，。、；：！？]", "", text)
mapping = []
for selection in selections:
    characters = without_punctuation(selection)
    offset = without_punctuation(raw).find(characters)
    assert offset >= 0, selection
    mapping.append({"text": selection, "characterOffsetWithoutPunctuation": offset, "characters": len(characters), "editorialTerminalFullStop": selection not in raw})
assert "舞修" in raw and "舞脩" not in raw
assert len(tables["bells"]) == 14
for bell in tables["bells"]:
    assert all(bell[key] > 0 for key in ["xianchang", "zhengchang", "xianjian", "gujian", "wuxiu", "wuguang"])
    if bell["location"] == "ROM":
        assert all(bell[key] is None for key in ["mass", "aHz", "bHz", "printedA", "printedB"])
    else:
        assert bell["mass"] > 0 and float(bell["bHz"]) > float(bell["aHz"]) > 0
photo = public / "sources/cleveland-1962.44.jpg"
assert sha256(photo.read_bytes()).hexdigest() == provenance["photograph"]["sha256"]
font_data = json.loads((public / "fonts/NotoCJK-provenance.json").read_text())
assert sha256((public / "fonts/NotoSansCJK-subset.woff2").read_bytes()).hexdigest() == font_data["sha256"]
needed = set(re.findall(r"[\u2e80-\u9fff\uff00-\uffef]", "".join(p.read_text() for p in (root / "src/shuang").glob("*.ts"))))
assert needed <= set(font_data["characters"]), needed - set(font_data["characters"])
online = "--online" in sys.argv
if online:
    request = lambda url: urlopen(Request(url, headers={"User-Agent": "Shuang educational source verification"}), timeout=30).read()
    response = json.loads(request(provenance["chinese"]["api"]))
    page = next(iter(response["query"]["pages"].values()))
    revision = page["revisions"][0]
    assert revision["timestamp"] == provenance["chinese"]["timestamp"]
    content = revision["slots"]["main"]["*"]
    start, end = content.index("鳧氏為鐘。"), content.index("栗氏為量。")
    assert content[start:end].rstrip() + "\n" == raw
    pdf = request("https://www.jstage.jst.go.jp/article/ast1980/10/5/10_5_299/_pdf")
    assert sha256(pdf).hexdigest() == provenance["paper"]["pdfSha256"]
assets = {str(p.relative_to(public)): {"bytes": p.stat().st_size, "sha256": sha256(p.read_bytes()).hexdigest()} for folder in ["fonts", "sources"] for p in sorted((public / folder).iterdir()) if p.is_file()}
print(json.dumps({"checkedAtUtc": datetime.now(timezone.utc).isoformat(), "onlineOriginalsChecked": online, "paperPdfIdentity": provenance["paper"]["pdfSha256"], "numericalTranscriptionReview": "All 14 Table 1 rows and 24 Table 2 resonances were visually checked against the printed tables; this script does not claim OCR or automatic independent table extraction.", "bells": 14, "reportedResonances": 24, "unreportedPitchPairs": 2, "chineseRevision": provenance["chinese"]["revision"], "fullFuSectionIdentity": sha256(raw.encode()).hexdigest(), "readings": mapping, "retainedChineseCharactersAndPunctuation": len(font_data["characters"]), "fontCoverage": "All CJK characters and full-width punctuation in UI source retained by subset recipe; glyph coverage checked separately with fontTools", "assets": assets}, indent=2, ensure_ascii=False))
