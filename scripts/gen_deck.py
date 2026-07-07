"""Build the draw-card deck: one standalone SVG card-face per card + a combined
deck.json the page consumes. Reuses the authentic card() engine from
tmp/gen_readings.py (the same renderer used for the reading-wheel diagrams), so
the drawn card matches the book's real layout exactly.

  web/assets/cards/<planet>_<sign>.svg   one face-up card, viewBox 0 0 300 446
  web/data/deck.json                     [{number,page,name,planet,sign,suit_name,
                                           sign_keyword,reading,events,img}]
Run:  python scripts/gen_deck.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
CARDS_DIR = ROOT / "data" / "cards"
OUT_SVG = WEB / "assets" / "cards"
OUT_SVG.mkdir(parents=True, exist_ok=True)

# Pull the card renderer (and palette) out of gen_readings.py without triggering
# its diagram build: exec only the source above the "# build all" marker.
src = (ROOT / "tmp" / "gen_readings.py").read_text(encoding="utf-8")
head = src.split("# ---------- build all")[0]
ns = {"__file__": str(ROOT / "tmp" / "gen_readings.py")}
exec(compile(head, "gen_readings.py", "exec"), ns)
card = ns["card"]; BG = ns["BG"]

# Card-face SVG: book-card aspect H/W 1.52 (re-measured 2026-06-20), centred with
# a small margin so the 1.5px outer stroke is never clipped.
VW, VH = 300, 446
CW, CH = 260, 395


def face_svg(planet, sign, name):
    body = card(VW / 2, VH / 2, CW, CH, planet=planet, sign=sign.lower(),
                name=name, faceup=True)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" '
            f'font-family="Georgia, \'Times New Roman\', serif">'
            f'<rect width="{VW}" height="{VH}" fill="{BG}"/>'
            f'{body}</svg>')


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
            "img": f"assets/cards/{slug}.svg",
        })

(WEB / "data" / "deck.json").write_text(
    json.dumps(deck, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"wrote {len(deck)} cards + deck.json")
