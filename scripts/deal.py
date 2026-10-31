"""Blind dealer for the Radiant Sun oracle.

`deal` shuffles the 84 cards with the system random source and writes the
positions to a JSON file without printing a card name, so the process that
deals never learns what it dealt. `reveal` prints the book text for chosen
positions, so a reader turns only the houses the question needs.

    python scripts/deal.py deal                 # 13 positions: 12 houses + centre
    python scripts/deal.py deal --count 4       # four cards, e.g. the weeks of a month
    python scripts/deal.py reveal FILE 1 7 4    # turn houses 1, 7 and 4
"""

import argparse
import glob
import json
import os
import random
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS_DIR = os.path.join(ROOT, "data", "cards")
DEALS_DIR = os.path.join(ROOT, "tmp", "deals")


def load_cards():
    cards = {}
    for path in sorted(glob.glob(os.path.join(CARDS_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            for card in json.load(f):
                cards[f"{card['planet'].lower()}_{card['sign'].lower()}"] = card
    if len(cards) != 84:
        sys.exit(f"expected 84 cards, found {len(cards)} in {CARDS_DIR}")
    return cards


def deal(args):
    ids = list(load_cards())
    rng = random.SystemRandom()
    rng.shuffle(ids)
    if not 1 <= args.count <= len(ids):
        sys.exit(f"--count must be between 1 and {len(ids)}")
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out = args.out or os.path.join(DEALS_DIR, f"deal-{stamp}.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    record = {
        "dealt_at": datetime.now().isoformat(timespec="seconds"),
        "count": args.count,
        "positions": {str(i + 1): ids[i] for i in range(args.count)},
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=1)
    print(f"{args.count} cards dealt face down -> {out}")


def reveal(args):
    cards = load_cards()
    with open(args.file, encoding="utf-8") as f:
        record = json.load(f)
    positions = record["positions"]
    for pos in args.positions:
        if pos not in positions:
            sys.exit(f"position {pos} is not in this deal (1-{record['count']})")
        card = cards[positions[pos]]
        print(f"=== position {pos}: {card['name']} ({card['planet']} in {card['sign']}) · suit {card['suit_name']}")
        print(f"image:   {card['image_description']}")
        print(f"reading: {card['reading']}")
        print(f"events:  {card.get('events', '')}")
        if args.personal:
            print(f"personal: {card['personal']}")
        print()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_deal = sub.add_parser("deal", help="shuffle and lay cards face down")
    p_deal.add_argument("--count", type=int, default=13, help="cards to lay (default 13: twelve houses and the centre)")
    p_deal.add_argument("--out", help="JSON file to write (default tmp/deals/deal-<timestamp>.json)")
    p_deal.set_defaults(func=deal)

    p_reveal = sub.add_parser("reveal", help="turn chosen positions of a deal")
    p_reveal.add_argument("file", help="deal JSON written by `deal`")
    p_reveal.add_argument("positions", nargs="+", help="positions to turn, e.g. 1 7 4")
    p_reveal.add_argument("--personal", action="store_true", help="also print the card's Personal section")
    p_reveal.set_defaults(func=reveal)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
