from pathlib import Path
import pillow_heif, numpy as np
from PIL import Image
SCAN = Path("scanner/uploads/diagrams")
def load(stem):
    h = pillow_heif.open_heif(str(SCAN/f"{stem}.heic"))
    return np.asarray(Image.frombytes(h.mode, h.size, h.data, "raw").convert("RGB"))

def patch(a, cx, cy, r=12):
    return a[cy-r:cy+r, cx-r:cx+r].reshape(-1,3).mean(0)

# p127: full 2268x4032. Need pixel coords. Use fractions from earlier crop.
a = load("p127")
H,W = a.shape[:2]
print("p127", W, H)
# July slice highlight is bottom-center-right of wheel. wheel center approx:
# from crop (0.16-0.84 x, 0.26-0.63 y) wheel center ~ (0.5W, 0.445H)
cx, cy = int(0.5*W), int(0.445*H)
print("center px", cx, cy, "color", patch(a,cx,cy))
# July slice ~ below center slightly right: angle 74 deg, radius mid
import math
for name,ang,rad in [("July",74,0.11),("June",105,0.11),("May",135,0.11),("Aug",45,0.11)]:
    x=int(cx+rad*W*math.cos(math.radians(ang)))
    y=int(cy+rad*W*math.sin(math.radians(ang)))
    print(f"{name:5} ({x},{y}) {patch(a,x,y).round(1)}")
