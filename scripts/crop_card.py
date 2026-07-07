from pathlib import Path
import pillow_heif, numpy as np
from PIL import Image
SCAN=Path("scanner/uploads/diagrams"); OUT=Path("scripts/out/verify")
def load(stem):
    h=pillow_heif.open_heif(str(SCAN/f"{stem}.heic"))
    return Image.frombytes(h.mode,h.size,h.data,"raw")
# p127 scan: crop the NEGOTIATION card (upper-right outer). Full 2268x4032.
a=load("p127")
# upper-right card ~ x 0.78-0.97, y 0.27-0.40
c=a.crop((int(0.77*2268),int(0.265*4032),int(0.99*2268),int(0.40*4032)))
c=c.resize((c.width*2,c.height*2),Image.LANCZOS)
c.save(OUT/"p127_card_scan.png"); print("scan card",c.size)
# SVG: render p127 at high res, crop same card (NEGOTIATION at x463-541,y115.5-234.5 of 700x724)
