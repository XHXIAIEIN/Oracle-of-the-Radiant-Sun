"""Build the draw-card deck: generated card art paths + SVG support assets.

  web/assets/images/<planet>_<sign>.webp one finished face-up card
  web/assets/cards/<planet>_<sign>.svg   fallback/template card, viewBox 0 0 300 446
  web/data/deck.json                     [{number,page,name,planet,sign,suit_name,
                                           sign_keyword,reading,events,img}]
Run:  python scripts/gen_deck.py
"""
import json
from pathlib import Path

from card_template import face_svg, shape_svg

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
CARDS_DIR = ROOT / "data" / "cards"
OUT_SVG = WEB / "assets" / "cards"
OUT_SHAPES = WEB / "assets" / "shapes"
OUT_SVG.mkdir(parents=True, exist_ok=True)
OUT_SHAPES.mkdir(parents=True, exist_ok=True)

PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]

for planet in PLANETS:
    (OUT_SHAPES / f"{planet.lower()}.svg").write_text(
        shape_svg(planet), encoding="utf-8")


# 每张牌在原书中的页码（data/card-images.json，已逐图核对）
PAGES = {(c["planet"], c["sign"]): c["page"]
         for c in json.loads((ROOT / "data" / "card-images.json")
                             .read_text(encoding="utf-8"))["cards"]}

deck = []
for f in sorted(CARDS_DIR.glob("*.json")):
    for c in json.loads(f.read_text(encoding="utf-8")):
        planet = c["planet"]; sign = c["sign"]
        slug = f'{planet.lower()}_{sign.lower()}'
        (OUT_SVG / f"{slug}.svg").write_text(
            face_svg(planet, sign, c["name"]), encoding="utf-8")
        deck.append({
            "number": c["number"],
            "page": PAGES[(planet, sign)],
            "name": c["name"],
            "planet": planet,
            "sign": sign,
            "suit_name": c.get("suit_name", ""),
            "sign_keyword": c.get("sign_keyword", ""),
            "image_description": c.get("image_description", ""),
            "personal": c.get("personal", ""),
            "reading": c.get("reading", ""),
            "events": c.get("events", ""),
            "img": f"assets/images/{slug}.webp",
        })

(WEB / "data" / "deck.json").write_text(
    json.dumps(deck, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"wrote {len(deck)} cards + {len(PLANETS)} shapes + deck.json")
