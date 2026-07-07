from pathlib import Path
import pillow_heif, numpy as np, math
from PIL import Image
SCAN = Path("scanner/uploads/diagrams")
def load(stem):
    h = pillow_heif.open_heif(str(SCAN/f"{stem}.heic"))
    return np.asarray(Image.frombytes(h.mode, h.size, h.data, "raw").convert("RGB"))
def patch(a,x,y,r=15): return a[y-r:y+r,x-r:x+r].reshape(-1,3).mean(0)

# locate wheel center precisely for p127 by scanning. Use known: center text "Theme" below center.
# Use earlier estimate refine via brightest-ring not needed. Use cx,cy from full.
a=load("p127"); H,W=a.shape[:2]
paper = patch(a, int(0.5*W), int(0.04*H))  # top margin white
print("paper white", paper.round(1))
cx,cy=1134,1794
# sample each slice center at radius 0.09W, angles centered 15,45,...,345 (slice mid). number->month mapping:
# slice angle for label: July=74 measured. Let's sample 12 mids and print saturation
res=[]
for ang in range(15,360,30):
    x=int(cx+0.09*W*math.cos(math.radians(ang)))
    y=int(cy+0.09*W*math.sin(math.radians(ang)))
    c=patch(a,x,y)
    # warmth = R - B (gold has high R-B), and darkness
    res.append((ang, c.round(1).tolist(), round(float(c[0]-c[2]),1)))
for r in sorted(res, key=lambda t:-t[2]):
    print(f"ang {r[0]:3}  rgb {r[1]}  R-B {r[2]}")
