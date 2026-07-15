"""Inspect image-generation progress for the 84-card deck.

The actual image generation is performed one card at a time through the image
tool. This script keeps the queue resumable by reporting which cards already
have raw images, composed finals, and passing QA records.

Usage:
  python scripts/imagegen_queue.py
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CARD_DIR = ROOT / "data" / "cards"
PROMPT_DIR = ROOT / "data" / "prompts"
RAW_DIR = ROOT / "artwork" / "generated"
FINAL_DIR = ROOT / "web" / "assets" / "images"
QA_DIR = ROOT / "tmp" / "imagegen_qa"
OUT_PATH = ROOT / "tmp" / "imagegen_queue.json"


def slug_for(card: dict) -> str:
    return f"{card['planet'].lower()}_{card['sign'].lower()}"


def all_cards() -> list[dict]:
    cards = []
    for path in sorted(CARD_DIR.glob("*.json")):
        cards.extend(json.loads(path.read_text(encoding="utf-8")))
    return cards


def qa_info(slug: str) -> dict:
    path = QA_DIR / f"{slug}.json"
    if not path.exists():
        return {"final_status": "missing", "latest_attempt_status": "missing"}
    data = json.loads(path.read_text(encoding="utf-8"))
    attempts = data.get("attempts", [])
    latest = attempts[-1] if attempts else {}
    return {
        "final_status": data.get("final_status", "unknown"),
        "latest_attempt_status": latest.get("status", "missing"),
    }


def main() -> None:
    rows = []
    for card in all_cards():
        slug = slug_for(card)
        raw = RAW_DIR / f"{slug}.png"
        final = FINAL_DIR / f"{slug}.png"
        prompt = PROMPT_DIR / f"{slug}.txt"
        qa = qa_info(slug)
        status = qa["final_status"]
        latest_attempt_status = qa["latest_attempt_status"]
        if status == "pass":
            queue_state = "done"
        elif latest_attempt_status == "fail":
            queue_state = "needs_generate"
        elif latest_attempt_status == "pending_review" and raw.exists() and final.exists():
            queue_state = "needs_qa"
        elif raw.exists() and final.exists():
            queue_state = "needs_qa"
        elif raw.exists():
            queue_state = "needs_compose"
        else:
            queue_state = "needs_generate"
        rows.append(
            {
                "slug": slug,
                "number": card["number"],
                "planet": card["planet"],
                "sign": card["sign"],
                "name": card["name"],
                "prompt": prompt.as_posix(),
                "raw_image": raw.as_posix(),
                "final_image": final.as_posix(),
                "qa_status": status,
                "latest_attempt_status": latest_attempt_status,
                "queue_state": queue_state,
            }
        )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["queue_state"]] = counts.get(row["queue_state"], 0) + 1
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    print(OUT_PATH.relative_to(ROOT))
    next_rows = [row for row in rows if row["queue_state"] != "done"]
    if next_rows:
        print("next=" + next_rows[0]["slug"])


if __name__ == "__main__":
    main()
