#!/usr/bin/env python3
"""Fetch the site's fonts from their pinned releases, each checked against its
SHA-256:

- Departure Mono, the page's font, as released.
- Fusion Pixel Font, split: its Simplified Chinese build becomes small woff2
  files for the CJK characters Departure Mono lacks. The CSS gives each file
  the characters it holds (unicode-range), so a browser downloads only the
  files for text it shows.

Output in build/fonts/: the fonts, which the page imports so Vite fingerprints
them; fusion-pixel.css, imported by web/src/base.css; and licenses/, served at
/fonts/ (FONT_LICENSES_URL in web/src/site.ts). Run by make.
Needs fontTools and brotli: run it with `uv run`, which provides them.

usage: uv run tools/build-fonts.py
"""
import hashlib
import io
import shutil
import urllib.request
import zipfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

DEPARTURE_VERSION = "1.500"
DEPARTURE_URL = (
    "https://github.com/rektdeckard/departure-mono/releases/download/"
    f"v{DEPARTURE_VERSION}/DepartureMono-{DEPARTURE_VERSION}.zip"
)
DEPARTURE_SHA256 = "bf3e48059aeef4617ec585bdea81dcc3491c576b3e7a472f52faf40e09ee5c3a"
# index.html and 404.html preload it by this name, and base.css declares it.
DEPARTURE_FONT = "DepartureMono-Regular.woff2"

FUSION_VERSION = "2026.10.25"
FUSION_URL = (
    "https://github.com/TakWolf/fusion-pixel-font/releases/download/"
    f"{FUSION_VERSION}/fusion-pixel-font-12px-monospaced-otf.woff2-v{FUSION_VERSION}.zip"
)
FUSION_SHA256 = "010223860f2dc625d672377917a3d585da698ce67e947418b603f6410591556c"
# Every language build has the same characters; they differ only in the
# regional shapes of some Han characters.
FUSION_FONT = "fusion-pixel-12px-monospaced-zh_hans.otf.woff2"
FUSION_FAMILY = "Fusion Pixel"
# Output files are fusion-pixel-<n>.woff2; licences go in licenses/fusion-pixel/.
FUSION_NAME = "fusion-pixel"

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build/fonts"
LICENSES = OUT / "licenses"
# Written last: the Makefile treats it as "build complete".
CSS = OUT / "fusion-pixel.css"

# The CJK blocks, from radicals to Hangul, plus CJK compatibility and full-width forms.
CJK = [(0x2E80, 0x9FFF), (0xAC00, 0xD7AF), (0xF900, 0xFAFF), (0xFE30, 0xFE4F), (0xFF00, 0xFFEF)]
# Kana, CJK punctuation and full-width forms get the first file to themselves:
# small, and all the plain page needs.
FIRST = [(0x3000, 0x30FF), (0x31F0, 0x31FF), (0xFF00, 0xFFEF)]
# Characters per file after the first, about 40 KB each.
CHUNK = 1500


def within(ranges, cp):
    return any(lo <= cp <= hi for lo, hi in ranges)


def fetch(url, sha256):
    with urllib.request.urlopen(url) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != sha256:
        raise SystemExit(f"{url} does not match its SHA-256")
    return zipfile.ZipFile(io.BytesIO(data))


def unicode_range(chars, owner):
    """Runs of `chars` with no other file's character in between, as CSS."""
    runs = []
    for cp in chars:
        if runs and all(owner.get(c, owner[cp]) == owner[cp] for c in range(runs[-1][1] + 1, cp)):
            runs[-1][1] = cp
        else:
            runs.append([cp, cp])
    return ", ".join(f"U+{lo:X}" if lo == hi else f"U+{lo:X}-{hi:X}" for lo, hi in runs)


def departure_mono():
    archive = fetch(DEPARTURE_URL, DEPARTURE_SHA256)
    folder = f"DepartureMono-{DEPARTURE_VERSION}/"
    (OUT / DEPARTURE_FONT).write_bytes(archive.read(folder + DEPARTURE_FONT))
    (LICENSES / "DepartureMono-LICENSE.txt").write_bytes(archive.read(folder + "LICENSE"))
    print(f"Departure Mono v{DEPARTURE_VERSION}")


def fusion_pixel():
    archive = fetch(FUSION_URL, FUSION_SHA256)
    font_data = archive.read(FUSION_FONT)
    chars = sorted(cp for cp in TTFont(io.BytesIO(font_data)).getBestCmap() if within(CJK, cp))
    rest = [cp for cp in chars if not within(FIRST, cp)]
    files = [[cp for cp in chars if within(FIRST, cp)]]
    files += [rest[i : i + CHUNK] for i in range(0, len(rest), CHUNK)]
    owner = {cp: n for n, file in enumerate(files) for cp in file}

    # The font's licence, and those of the fonts it merges.
    for name in archive.namelist():
        if name == "OFL.txt" or name.startswith("LICENSES/") and not name.endswith("/"):
            path = LICENSES / FUSION_NAME / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(archive.read(name))

    options = subset.Options(flavor="woff2", layout_features=["*"], name_IDs=["*"], name_languages=["*"])
    rules = []
    for n, file in enumerate(files):
        # Keep the source's modified time, so a rerun writes identical files.
        font = TTFont(io.BytesIO(font_data), recalcTimestamp=False)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=file)
        subsetter.subset(font)
        subset.save_font(font, OUT / f"{FUSION_NAME}-{n}.woff2", options)
        rules.append(
            "@font-face {\n"
            f'    font-family: "{FUSION_FAMILY}";\n'
            f'    src: url("{FUSION_NAME}-{n}.woff2") format("woff2");\n'
            f"    unicode-range: {unicode_range(file, owner)};\n"
            "    size-adjust: 109.0909%;\n"
            "    font-display: block;\n"
            "}\n"
        )

    CSS.write_text(
        "/* Generated by tools/build-fonts.py; change that, not this.\n"
        f"   {FUSION_FAMILY} 12px Monospaced v{FUSION_VERSION}, Simplified Chinese build: CJK\n"
        "   characters, which Departure Mono lacks, in files the browser fetches as\n"
        "   text needs them. It is drawn on a 12px grid; scaling it by 12/11 puts its\n"
        "   pixels on Departure Mono's 11px grid. */\n\n" + "\n".join(rules)
    )
    size = sum(f.stat().st_size for f in OUT.glob(f"{FUSION_NAME}-*.woff2"))
    print(f"{FUSION_FAMILY} v{FUSION_VERSION}: {len(chars)} characters in {len(files)} files, {size // 1024} KiB")


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    LICENSES.mkdir(parents=True)
    departure_mono()
    fusion_pixel()


if __name__ == "__main__":
    main()
