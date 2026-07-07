"""Emit the 7 planet base templates ("card shapes") from the single card()
renderer in tmp/gen_readings.py, so they share the deck's re-measured geometry
(2026-06-20 photo). Venus is the plain base; every other planet is that base
plus its p25 suit motif.

  web/assets/shapes/<planet>.svg        one blank template each, viewBox 300x446
  data/diagrams/p25_card_shapes.svg     the labelled 7-up legend page

A shape carries only what is constant for the planet -- the frame, notch, suit
motif and planet glyph. The per-card number, zodiac glyph and name are filled in
later by gen_deck.py / gen_readings.py mapping each card onto its planet shape.

Run:  python scripts/gen_shapes.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHAPES = ROOT / "web" / "assets" / "shapes"
SHAPES.mkdir(parents=True, exist_ok=True)
DIAGRAMS = ROOT / "data" / "diagrams"

# Reuse the card() engine + palette without triggering the diagram build.
src = (ROOT / "tmp" / "gen_readings.py").read_text(encoding="utf-8")
head = src.split("# ---------- build all")[0]
ns = {"__file__": str(ROOT / "tmp" / "gen_readings.py")}
exec(compile(head, "gen_readings.py", "exec"), ns)
card = ns["card"]; BG = ns["BG"]; LABEL = ns["LABEL"]

# Venus first (the base everything else is built on), then the motif variants.
PLANETS = ["Venus", "Sun", "Moon", "Mercury", "Mars", "Jupiter", "Saturn"]

# ---- standalone shape files (one blank template per planet) ----
VW, VH = 300, 446
CW, CH = 260, 395
for planet in PLANETS:
    body = card(VW / 2, VH / 2, CW, CH, planet=planet, sign=None, name=None, faceup=True)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" '
           f'font-family="Georgia, \'Times New Roman\', serif">'
           f'<rect width="{VW}" height="{VH}" fill="{BG}"/>{body}</svg>')
    (SHAPES / f"{planet.lower()}.svg").write_text(svg, encoding="utf-8")
print(f"wrote {len(PLANETS)} shapes -> {SHAPES}")

# ---- p25 legend: the 7 shapes laid out & labelled like the book page ----
LW, LH = 764, 600
cw, ch = 150, 228
# (label x, card centre x, card centre y, planet)
top_y, bot_y = 80 + ch / 2, 346 + ch / 2
layout = [(115, 115, top_y, "Sun"),   (293, 293, top_y, "Moon"),
          (471, 471, top_y, "Mercury"), (649, 649, top_y, "Venus"),
          (204, 204, bot_y, "Mars"), (382, 382, bot_y, "Jupiter"),
          (560, 560, bot_y, "Saturn")]
s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LW} {LH}" '
     f'font-family="Georgia, \'Times New Roman\', serif">',
     f'<rect x="0" y="0" width="{LW}" height="{LH}" fill="{BG}"/>',
     f'<text x="{LW/2}" y="38" text-anchor="middle" font-size="22" font-style="italic" '
     f'letter-spacing="2" fill="{LABEL}">The Card Shapes</text>']
for lx, cx, cy, planet in layout:
    ly = cy - ch / 2 - 10
    s.append(f'<text x="{lx}" y="{ly:.0f}" text-anchor="middle" font-size="15" '
             f'fill="{LABEL}">{planet}</text>')
    s.append(card(cx, cy, cw, ch, planet=planet, sign=None, name=None, faceup=True))
s.append('</svg>')
(DIAGRAMS / "p25_card_shapes.svg").write_text("".join(s), encoding="utf-8")
print(f"wrote p25_card_shapes.svg -> {DIAGRAMS}")
