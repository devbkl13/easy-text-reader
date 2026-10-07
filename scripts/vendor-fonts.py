"""Download official Google Fonts sources once and losslessly package them as WOFF2.

Development only: requires fonttools and brotli. Neither the app nor the normal
build needs Python, the internet, or this script.
"""
import hashlib
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "assets" / "fonts"
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
FAMILIES = [
    {
        "key": "beVietnam",
        "family": "Be Vietnam Pro",
        "directory": "bevietnampro",
        "files": [
            ("BeVietnamPro-Regular.ttf", "400", "normal"),
            ("BeVietnamPro-Italic.ttf", "400", "italic"),
            ("BeVietnamPro-SemiBold.ttf", "600", "normal"),
            ("BeVietnamPro-Bold.ttf", "700", "normal"),
        ],
    },
    {
        "key": "manrope",
        "family": "Manrope",
        "directory": "manrope",
        "files": [("Manrope%5Bwght%5D.ttf", "200 800", "normal")],
    },
]


def download(url):
    request = Request(url, headers={"User-Agent": "KhoangDoc-font-vendor/1.0"})
    with urlopen(request, timeout=25) as response:
        return response.read()


def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    families = []
    for config in FAMILIES:
        base = BASE + config["directory"] + "/"
        license_name = config["directory"] + "-OFL.txt"
        (TARGET / license_name).write_bytes(download(base + "OFL.txt"))
        files = []
        for filename, weight, style in config["files"]:
            url = base + filename
            source = download(url)
            font = TTFont(io.BytesIO(source))
            # Check real Vietnamese coverage, not only the advertised family name.
            cmap = font.getBestCmap()
            missing = sorted(set("Tiếng Việt Đọc dễ hơn Ắ Ặ Ễ Ự Ỷ đ ơ ư") - {chr(code) for code in cmap})
            if missing:
                raise ValueError(f"{filename}: missing Vietnamese glyphs: {missing}")
            font.flavor = "woff2"
            name = filename.replace("%5B", "[").replace("%5D", "]").replace(".ttf", ".woff2")
            font.save(TARGET / name)
            result = (TARGET / name).read_bytes()
            files.append({"file": name, "weight": weight, "style": style, "source": url, "sourceSha256": hashlib.sha256(source).hexdigest(), "sha256": hashlib.sha256(result).hexdigest()})
            print(f"{name}: {len(result):,} bytes; Vietnamese glyphs verified")
        families.append({"key": config["key"], "family": config["family"], "license": license_name, "files": files})
    (TARGET / "manifest.json").write_text(json.dumps(families, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
