"""Emit the 7 planet base templates ("card shapes").

  web/assets/shapes/<planet>.svg        one blank template each, viewBox 300x446
  data/diagrams/p25_card_shapes.svg     the labelled 7-up legend page

A shape carries only what is constant for the planet -- the frame, notch, suit
motif and planet glyph. The per-card number, zodiac glyph and name are filled in
later by gen_deck.py / gen_readings.py mapping each card onto its planet shape.

Run:  python scanner/scripts/gen_shapes.py
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from card_template import BG, FONT_NAME_FILE, LABEL, card, outline_text, shape_svg

SHAPES = ROOT / "web" / "assets" / "shapes"
SHAPES.mkdir(parents=True, exist_ok=True)
DIAGRAMS = ROOT / "data" / "diagrams"

# Venus first (the base everything else is built on), then the motif variants.
PLANETS = ["Venus", "Sun", "Moon", "Mercury", "Mars", "Jupiter", "Saturn"]

# ---- standalone shape files (one blank template per planet) ----
for planet in PLANETS:
    (SHAPES / f"{planet.lower()}.svg").write_text(shape_svg(planet), encoding="utf-8")
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
s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LW} {LH}">',
     f'<rect x="0" y="0" width="{LW}" height="{LH}" fill="{BG}"/>',
     outline_text("The Card Shapes", FONT_NAME_FILE, 22, LW / 2, 38, LABEL, letter_spacing=2, valign="baseline")]
for lx, cx, cy, planet in layout:
    ly = cy - ch / 2 - 10
    s.append(outline_text(planet, FONT_NAME_FILE, 15, lx, ly, LABEL, valign="baseline"))
    s.append(card(cx, cy, cw, ch, planet=planet, sign=None, name=None, faceup=True))
s.append('</svg>')
(DIAGRAMS / "p25_card_shapes.svg").write_text("".join(s), encoding="utf-8")
print(f"wrote p25_card_shapes.svg -> {DIAGRAMS}")
