from pathlib import Path
import pillow_heif
from PIL import Image
SCAN = Path("scanner/uploads/diagrams")
OUT = Path("scanner/scripts/out/verify")

def load(stem):
    h = pillow_heif.open_heif(str(SCAN/f"{stem}.heic"))
    return Image.frombytes(h.mode, h.size, h.data, "raw")

# p127 scan: wheel center region. page 2268x4032. wheel approx center
img = load("p127")
w,hh = img.size
# wheel occupies roughly x 0.18-0.82, y 0.27-0.62
crop = img.crop((int(w*0.16), int(hh*0.26), int(w*0.84), int(hh*0.63)))
crop.save(OUT/"p127_scan_wheel.png")
print("p127 wheel", crop.size)

img = load("p131")
w,hh = img.size
crop = img.crop((int(w*0.16), int(hh*0.26), int(w*0.84), int(hh*0.63)))
crop.save(OUT/"p131_scan_wheel.png")
print("p131 wheel", crop.size)

# crop SVG renders central wheel
for stem in ("p127","p131"):
    s = Image.open(OUT/f"{stem}_svg_chrome.png")
    w,hh = s.size
    c = s.crop((int(w*0.22), int(hh*0.18), int(w*0.78), int(hh*0.72)))
    c.save(OUT/f"{stem}_svg_wheel.png")
    print(stem, "svg wheel", c.size)
