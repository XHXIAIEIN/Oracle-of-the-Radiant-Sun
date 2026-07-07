import numpy as np
from PIL import Image
a=np.asarray(Image.open("scripts/out/verify/p127_scan_wheel.png").convert("RGB"))
H,W=a.shape[:2]; print("crop",W,H)
def patch(x,y,r=10): 
    p=a[y-r:y+r,x-r:x+r].reshape(-1,3)
    return p.mean(0).round(1)
# July slice gold: lower area, just right of bottom center. crop center ~ (771,746) [wheel center]
# July wedge between 60-90deg. sample mid-radius points
import math
cx,cy=771,746
for ang in (62,70,78,86):
    for rad in (0.16,0.22,0.28):
        x=int(cx+rad*W*math.cos(math.radians(ang))); y=int(cy+rad*W*math.sin(math.radians(ang)))
        if 0<x<W and 0<y<H: print(f"ang{ang} r{rad} ({x},{y}) {patch(x,y)}")
# compare a pale slice (e.g. ang 200, left)
print("pale-left", patch(int(cx-0.25*W), cy))
print("pale-top", patch(cx, int(cy-0.25*H)))
