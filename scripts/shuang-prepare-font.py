"""Subset a checksum-pinned Noto CJK font; use uv with fonttools and brotli."""

from hashlib import sha256
import json
from pathlib import Path
import re
import sys

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
original = Path(sys.argv[1])
expected = "2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b"
assert sha256(original.read_bytes()).hexdigest() == expected, "Unexpected source font"
text = "".join(p.read_text() for p in (root / "src/shuang").glob("*.ts"))
text += "周禮冬官考工記鳧氏為鐘甬衡脩聲"
characters = "".join(sorted(set(re.findall(r"[\u2e80-\u9fff\uff00-\uffef]", text))))
font = TTFont(original, recalcTimestamp=False)
copyright_text = "\n".join(sorted({n.toUnicode() for n in font["name"].names if n.nameID == 0}))
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=characters)
subsetter.subset(font)
font.flavor = "woff2"
destination = root / "public/shuang/fonts/NotoSansCJK-subset.woff2"
font.save(destination)
notice_path = root / "public/shuang/fonts/NotoCJK-OFL.txt"
notice = notice_path.read_text()
if copyright_text not in notice:
    notice_path.write_text(copyright_text + "\n\n" + notice)
metadata = {
    "source": "https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
    "sourceSha256": expected,
    "copyright": copyright_text,
    "characters": characters,
    "derivation": "fontTools subset, WOFF2; original glyph shapes unchanged",
    "fontToolsVersion": fontTools.__version__,
    "recipe": "scripts/shuang-prepare-font.py",
    "sha256": sha256(destination.read_bytes()).hexdigest(),
}
(root / "public/shuang/fonts/NotoCJK-provenance.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
print(f"{len(characters)} retained Chinese characters and punctuation; {destination.stat().st_size} bytes")
