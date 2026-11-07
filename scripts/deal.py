"""Blind dealer for the Radiant Sun oracle.

`deal` shuffles the 84 cards with the system random source and writes the
positions to a JSON file without printing a card name, so the process that
deals never learns what it dealt. `reveal` prints the book text for chosen
positions together with what each position governs, and records the turned
positions in the deal file, so a reader turns only the houses the question
needs. `summary` counts the cards turned across the deals of one session, so
a card that keeps returning stands out.

    python scripts/deal.py deal --mode horary --session love   # 12 houses face down; prints the deal file's path
    python scripts/deal.py reveal <deal file> 1 7 4            # turn houses 1, 7 and 4
    python scripts/deal.py deal --mode trine --session love
    python scripts/deal.py reveal <deal file>                  # no positions: the mode's own (1 5 9)
    python scripts/deal.py summary love                        # cards turned in the session, repeats first
    python scripts/deal.py show <deal file>                    # HTML of the turned cards' images
    python scripts/deal.py --lang en reveal <deal file> 1 --desc

`deal --help` lists the modes. Card text comes from web/data/lang/<lang>.json;
a field missing there falls back to data/cards/*.json.
"""

import argparse
import glob
import json
import os
import random
import sys
from collections import defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS_DIR = os.path.join(ROOT, "data", "cards")
DECK_FILE = os.path.join(ROOT, "web", "data", "deck.json")
CATALOG_FILE = os.path.join(ROOT, "web", "data", "catalog.json")
LANG_DIR = os.path.join(ROOT, "web", "data", "lang")
DEALS_DIR = os.path.join(ROOT, "tmp", "deals")
# the chat's inline visuals load images only from a few CDNs, so `show` points at main through jsdelivr
IMAGE_BASE = "https://cdn.jsdelivr.net/gh/XHXIAIEIN/Oracle-of-the-Radiant-Sun@main/web/assets/images"

MODE_COUNT = {"single": 1, "trine": 12, "cross": 12, "horary": 12, "sunyear": 13, "weeks": 4, "days": 7}
# positions `reveal` turns when none are given; horary needs the question's houses
MODE_DEFAULT_REVEAL = {
    "single": [1],
    "trine": [1, 5, 9],
    "cross": [1, 4, 7, 10],
    "sunyear": list(range(1, 14)),
    "weeks": [1, 2, 3, 4],
    "days": list(range(1, 8)),
}
HOUSE_MODES = ("horary", "trine", "cross")
TEXT_FIELDS = ("name", "sign_keyword", "image_description", "personal", "reading", "events")

REPEAT_MARK = "★"
# labels the script prints that the web app has no key for
LABELS = {
    "zh": {"card": "牌", "page": "原书 p.{page}", "seen": "出现 {n} 次", "deals": "{n} 局", "turned": "翻开 {n} 张", "paren": "（{x}）"},
    "en": {"card": "Card", "page": "book p.{page}", "seen": "seen {n}×", "deals": "{n} deals", "turned": "{n} cards turned", "paren": " ({x})"},
}


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_cards(pack):
    """Card records keyed by planet_sign, with text from the language pack, the book page and `name_en`."""
    cards = {}
    for path in sorted(glob.glob(os.path.join(CARDS_DIR, "*.json"))):
        for card in load_json(path):
            cards[f"{card['planet'].lower()}_{card['sign'].lower()}"] = dict(card)
    if len(cards) != 84:
        sys.exit(f"expected 84 cards, found {len(cards)} in {CARDS_DIR}")
    for card in load_json(DECK_FILE):
        cards[f"{card['planet'].lower()}_{card['sign'].lower()}"]["page"] = card["page"]
    localized = pack["cards"]
    for key, card in cards.items():
        card["name_en"] = card["name"]
        for field in TEXT_FIELDS:
            value = localized.get(key, {}).get(field)
            if value:
                card[field] = value
    return cards


def load_lang(code):
    path = os.path.join(LANG_DIR, f"{code}.json")
    if not os.path.exists(path):
        sys.exit(f"no language pack {code} in {LANG_DIR}")
    return load_json(path)


def catalog_months():
    """Wheel order of the months: position 1 is April/Aries, as on the Sun wheel."""
    return [m["key"] for m in load_json(CATALOG_FILE)["months"]]


class Labels:
    """What each position governs, in the chosen language."""

    def __init__(self, pack, code):
        self.pack = pack
        self.code = code
        self.months = catalog_months()
        self.text = LABELS[code]

    def fill(self, key, **vars):
        node = self.pack
        for part in key.split("."):
            node = node[part]
        return str(node).format(**vars)

    def house(self, n):
        return self.fill("common.houseLabel", n=self.pack["common"]["cnNums"][n])

    def house_title(self, n):
        return self.pack["catalog"]["houses"][str(n)]["title"]

    def house_desc(self, n):
        return self.pack["catalog"]["houses"][str(n)]["desc"]

    def role(self, mode, n):
        return self.pack["modes"].get(mode, {}).get("roles", {}).get(str(n))

    def position(self, mode, pos):
        """One line naming the position: house, month, theme, week or day."""
        if mode in HOUSE_MODES:
            line = f"{self.house(pos)} · {self.house_title(pos)}"
            role = self.role(mode, pos)
            return f"{line} ｜ {role}" if role else line
        if mode == "sunyear":
            if pos == 13:
                return self.pack["modes"]["sunyear"]["themeWhere"]
            key = self.months[pos - 1]
            return f"{self.pack['catalog']['months'][key]} · {self.house(pos)}"
        if mode == "weeks":
            return self.fill("modes.sunyear.amplify.weekTag", n=self.pack["common"]["cnNums"][pos])
        if mode == "days":
            day = self.pack["modes"]["sunyear"]["amplify"]["days"][pos - 1]
            return self.fill("modes.sunyear.amplify.dayTag", d=day)
        return self.fill("modes.single.where", n=pos)

    def section(self, name):
        return self.pack["dialog"]["sections"][name]

    def paren(self, inner):
        return self.text["paren"].format(x=inner)

    def card_name(self, card):
        return card["name"] if card["name"] == card["name_en"] else f"{card['name']} {card['name_en']}"


def deal_dir(session):
    return os.path.join(DEALS_DIR, session) if session else DEALS_DIR


def deal(args):
    ids = list(load_cards(load_lang(args.lang)))
    rng = random.SystemRandom()
    rng.shuffle(ids)
    count = MODE_COUNT[args.mode]
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    folder = deal_dir(args.session)
    os.makedirs(folder, exist_ok=True)
    out = os.path.join(folder, f"deal-{stamp}.json")
    serial = 1
    while os.path.exists(out):  # two deals within one second must not overwrite each other
        serial += 1
        out = os.path.join(folder, f"deal-{stamp}-{serial}.json")
    record = {
        "dealt_at": datetime.now().isoformat(timespec="seconds"),
        "mode": args.mode,
        "count": count,
        "positions": {str(i + 1): ids[i] for i in range(count)},
        "revealed": [],
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=1)
    print(f"{args.mode}: {count} cards dealt face down -> {out}")


def positions_to_turn(args, record):
    if args.positions:
        return args.positions
    mode = record.get("mode")
    if mode not in MODE_DEFAULT_REVEAL:
        sys.exit(f"{mode or 'this deal'} has no default positions: name the houses to turn, e.g. 1 7 4")
    return [str(p) for p in MODE_DEFAULT_REVEAL[mode]]


def print_card(card, labels, args):
    planet_sign = f"{card['planet']} in {card['sign']}"
    print(f"{labels.text['card']}: {labels.card_name(card)}{labels.paren(planet_sign)} · {labels.text['page'].format(page=card['page'])}")
    print(f"{labels.section('image')}: {card['image_description']}")
    print(f"{labels.section('reading')}: {card['reading']}")
    print(f"{labels.section('events')}: {card.get('events', '')}")
    if args.personal:
        print(f"{labels.section('personality')}: {card['personal']}")


def reveal(args):
    lang = load_lang(args.lang)
    cards = load_cards(lang)
    labels = Labels(lang, args.lang)
    record = load_json(args.file)
    positions = record["positions"]
    mode = record.get("mode", "horary")
    for pos in positions_to_turn(args, record):
        if pos not in positions:
            sys.exit(f"position {pos} is not in this deal (1-{record['count']})")
        print(f"=== {labels.position(mode, int(pos))}")
        if args.desc and mode in HOUSE_MODES:
            print(labels.house_desc(int(pos)))
        print_card(cards[positions[pos]], labels, args)
        print()
        revealed = record.setdefault("revealed", [])
        if pos not in revealed:
            revealed.append(pos)
    with open(args.file, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=1)


def summary(args):
    lang = load_lang(args.lang)
    cards = load_cards(lang)
    labels = Labels(lang, args.lang)
    folder = deal_dir(args.session)
    files = sorted(glob.glob(os.path.join(folder, "*.json")))
    if not files:
        sys.exit(f"no deals in {folder}")
    sightings = defaultdict(list)  # planet_sign -> [(file, position line)]
    turned = 0
    for path in files:
        record = load_json(path)
        mode = record.get("mode", "horary")
        for pos in record.get("revealed", []):
            sightings[record["positions"][pos]].append((os.path.basename(path), labels.position(mode, int(pos))))
            turned += 1
    print(f"{args.session} · {labels.text['deals'].format(n=len(files))} · {labels.text['turned'].format(n=turned)}")
    print()
    by_count = sorted(sightings.items(), key=lambda item: (-len(item[1]), cards[item[0]]["page"]))
    for key, seen in by_count:
        card = cards[key]
        mark = REPEAT_MARK if len(seen) >= 2 else " "
        inner = f"{card['planet']} in {card['sign']}, {labels.text['page'].format(page=card['page'])}"
        print(f"{mark} {labels.card_name(card)}{labels.paren(inner)} · {labels.text['seen'].format(n=len(seen))}")
        for filename, where in seen:
            print(f"    {filename} · {where}")


# each figure spans three rows of the outer grid through subgrid, so labels, images and captions
# line up across a row even when one position label wraps to two lines
CARD_GRID_STYLE = (
    "<style>"
    ".deal{{display:grid;grid-template-columns:repeat({columns},minmax(0,1fr));column-gap:16px;row-gap:8px;padding:0.5rem 0;text-align:center;line-height:1.4}}"
    ".deal figure{{display:grid;grid-row:span 3;grid-template-rows:subgrid;margin:0 0 16px}}"
    ".deal .where{{align-self:end;font-size:14px;color:var(--text-muted);text-wrap:balance}}"
    ".deal img{{display:block;width:100%;aspect-ratio:820/1226;object-fit:cover;border-radius:8px}}"
    ".deal .name{{font-size:16px;font-weight:500;color:var(--text-primary)}}"
    ".deal .sub{{font-size:13px;color:var(--text-secondary);margin-top:2px}}"
    "</style>"
)
CARD_FIGURE = (
    '<figure><div class="where">{where}</div><img src="{src}" alt="{name}">'
    '<figcaption><div class="name">{name}</div><div class="sub">{sub}</div></figcaption></figure>'
)


def show(args):
    """Print an HTML fragment with the cards of chosen positions, for the chat's inline visual."""
    lang = load_lang(args.lang)
    cards = load_cards(lang)
    labels = Labels(lang, args.lang)
    record = load_json(args.file)
    mode = record.get("mode", "horary")
    meanings = record.get("position_meanings", {})
    positions = args.positions or record.get("revealed") or sys.exit("no position turned yet: name the positions to show")
    planets, signs = lang["catalog"]["planets"], lang["catalog"]["signs"]
    figures = []
    for pos in positions:
        card = cards[record["positions"][pos]]
        # a custom position's label is the part of its meaning before the colon
        where = meanings[pos].split("：")[0].split(":")[0] if pos in meanings else labels.position(mode, int(pos))
        star = f"{planets[card['planet']]}{signs[card['sign']]}"
        sub = f"{card['name_en']} · {star}" if card["name"] != card["name_en"] else star
        figures.append(CARD_FIGURE.format(where=where, src=f"{IMAGE_BASE}/{record['positions'][pos]}.webp", name=card["name"], sub=sub))
    columns = min(len(figures), args.columns)
    print(CARD_GRID_STYLE.format(columns=columns)
          + f'<h2 class="sr-only">{"、".join(cards[record["positions"][p]]["name"] for p in positions)}</h2>'
          + '<div class="deal">' + "".join(figures) + "</div>")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--lang", choices=("zh", "en"), default="zh", help="language of the printed text (default zh); place it before the command: deal.py --lang en reveal ...")
    sub = parser.add_subparsers(dest="command", required=True)

    p_deal = sub.add_parser("deal", help="shuffle and lay the cards of one mode face down")
    p_deal.add_argument("--mode", choices=sorted(MODE_COUNT), default="horary", help="reading to lay: horary 12 houses (default); trine and cross 12 houses, read through 1 5 9 or 1 4 7 10; sunyear 12 months and a theme; weeks 4; days 7; single 1")
    p_deal.add_argument("--session", help="session name, any word such as love: the deal goes under tmp/deals/<session>/ and `summary <session>` counts it")
    p_deal.set_defaults(func=deal)

    p_reveal = sub.add_parser("reveal", help="turn positions of a deal and print the book text")
    p_reveal.add_argument("file", help="deal JSON written by `deal`")
    p_reveal.add_argument("positions", nargs="*", help="positions to turn, e.g. 1 7 4; omit them for every mode except horary, which needs the question's houses")
    p_reveal.add_argument("--desc", action="store_true", help="also print the house description (horary, trine, cross)")
    p_reveal.add_argument("--personal", action="store_true", help="also print the card's Personality section")
    p_reveal.set_defaults(func=reveal)

    p_summary = sub.add_parser("summary", help="count the cards turned across the deals of a session")
    p_summary.add_argument("session", help="session name given to `deal --session`")
    p_summary.set_defaults(func=summary)

    p_show = sub.add_parser("show", help="print an HTML fragment showing the card images of a deal")
    p_show.add_argument("file", help="deal JSON written by `deal`")
    p_show.add_argument("positions", nargs="*", help="positions to show; omit them to show every turned position")
    p_show.add_argument("--columns", type=int, default=4, help="cards per row at most (default 4)")
    p_show.set_defaults(func=show)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
