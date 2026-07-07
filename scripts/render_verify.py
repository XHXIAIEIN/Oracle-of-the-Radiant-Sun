"""Render scan HEICs and SVGs to PNG for visual comparison."""
import sys, io
from pathlib import Path
import pillow_heif
from PIL import Image
import cairosvg

ROOT = Path(".")
SCAN = ROOT/"scanner/uploads/diagrams"
DATA = ROOT/"data/diagrams"
OUT  = ROOT/"scripts/out/verify"
OUT.mkdir(parents=True, exist_ok=True)

PAIRS = {
    "p16":  "p16_zodiac_wheel.svg",
    "p127": "p127_sample_reading_1.svg",
    "p131": "p131_sample_reading_2.svg",
}

def heic_png(stem):
    h = pillow_heif.open_heif(str(SCAN/f"{stem}.heic"))
    img = Image.frombytes(h.mode, h.size, h.data, "raw")
    # downscale long edge to 1600 for viewing
    w,hh = img.size
    s = 1600/max(w,hh)
    if s < 1: img = img.resize((int(w*s), int(hh*s)), Image.LANCZOS)
    p = OUT/f"{stem}_scan.png"
    img.save(p)
    print(f"{stem} scan {img.size} -> {p}")
    return img

def svg_png(stem, svg):
    p = OUT/f"{stem}_svg.png"
    cairosvg.svg2png(url=str(DATA/svg), write_to=str(p), output_width=1600)
    img = Image.open(p)
    print(f"{stem} svg  {img.size} -> {p}")
    return img

for stem, svg in PAIRS.items():
    heic_png(stem)
    svg_png(stem, svg)
