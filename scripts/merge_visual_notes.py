"""Merge visual-note fragments into data/visual-notes.json.

Fragments live in tmp/imagegen_refs/visual_notes_agent/*.json and are keyed by
card slug. Existing fields such as reference_images are preserved unless a
fragment explicitly replaces them.

Usage:
  python scripts/merge_visual_notes.py
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CARD_DIR = ROOT / "data" / "cards"
VISUAL_NOTES_PATH = ROOT / "data" / "visual-notes.json"
FRAGMENT_DIR = ROOT / "tmp" / "imagegen_refs" / "visual_notes_agent"


def slug_for(card: dict) -> str:
    return f"{card['planet'].lower()}_{card['sign'].lower()}"


def expected_slugs() -> list[str]:
    slugs = []
    for path in sorted(CARD_DIR.glob("*.json")):
        for card in json.loads(path.read_text(encoding="utf-8")):
            slugs.append(slug_for(card))
    return slugs


def main() -> None:
    current = {}
    if VISUAL_NOTES_PATH.exists():
        current = json.loads(VISUAL_NOTES_PATH.read_text(encoding="utf-8"))

    fragments = {}
    for path in sorted(FRAGMENT_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for slug, value in data.items():
            fragments.setdefault(slug, {}).update(value)

    merged = {}
    for slug in expected_slugs():
        entry = dict(current.get(slug, {}))
        if slug in fragments:
            entry.update(fragments[slug])
        if entry:
            merged[slug] = entry

    VISUAL_NOTES_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing = [slug for slug in expected_slugs() if slug not in fragments and slug not in current]
    lacking_notes = [slug for slug in expected_slugs() if not merged.get(slug, {}).get("visual_notes")]
    print(f"fragments={len(fragments)} merged={len(merged)}")
    if missing:
        print("missing_entries=" + ", ".join(missing))
    if lacking_notes:
        print("lacking_visual_notes=" + ", ".join(lacking_notes))


if __name__ == "__main__":
    main()
