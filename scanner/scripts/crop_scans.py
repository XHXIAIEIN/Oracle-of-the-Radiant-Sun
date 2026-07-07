"""Crop wheel regions from scans for close comparison."""
from pathlib import Path
import pillow_heif
from PIL import Image
SCAN = Path("scanner/uploads/diagrams")
OUT = Path("scanner/scripts/out/verify")

def load(stem):
    h = pillow_heif.open_heif(str(SCAN/f"{stem}.heic"))
    return Image.frombytes(h.mode, h.size, h.data, "raw")

# p16: wheel occupies lower portion. Full-res crop then resize.
img = load("p16")
w,hh = img.size
print("p16 full", img.size)
# wheel roughly y from 0.42 to 0.85, full width-ish centered
crop = img.crop((int(w*0.04), int(hh*0.40), int(w*0.99), int(hh*0.84)))
crop.save(OUT/"p16_scan_wheel.png")
print("p16 wheel", crop.size)

for stem in ("p127","p131"):
    img = load(stem)
    w,hh = img.size
    print(stem, "full", img.size)
    img.save(OUT/f"{stem}_scan_full.png")
