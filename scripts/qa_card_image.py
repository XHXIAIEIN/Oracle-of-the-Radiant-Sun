"""Create and update QA records for generated oracle card images.

This helper does not judge images by itself. It stores the review results from
the two-agent fidelity checks so batch generation can be paused and resumed.

Usage:
  python scripts/qa_card_image.py init sun_aries
  python scripts/qa_card_image.py record sun_aries --agent facts --status pass --notes "..."
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime
import json
import os
from pathlib import Path
import time


ROOT = Path(__file__).resolve().parent.parent
QA_DIR = ROOT / "tmp" / "imagegen_qa"


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def qa_path(slug: str) -> Path:
    return QA_DIR / f"{slug}.json"


@contextmanager
def record_lock(slug: str):
    QA_DIR.mkdir(parents=True, exist_ok=True)
    lock_path = qa_path(slug).with_suffix(".lock")
    deadline = time.monotonic() + 10
    while True:
        try:
            fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise SystemExit(f"Timed out waiting for QA lock: {lock_path}")
            time.sleep(0.05)
    try:
        yield
    finally:
        lock_path.unlink(missing_ok=True)


def read_record(slug: str) -> dict:
    path = qa_path(slug)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "slug": slug,
        "attempts": [],
        "current_attempt": 0,
        "final_status": "pending",
        "created_at": now(),
        "updated_at": now(),
    }


def write_record(record: dict) -> None:
    QA_DIR.mkdir(parents=True, exist_ok=True)
    record["updated_at"] = now()
    qa_path(record["slug"]).write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def init_record(args: argparse.Namespace) -> None:
    with record_lock(args.slug):
        record = read_record(args.slug)
        if not record["attempts"] or args.new_attempt:
            record["current_attempt"] = len(record["attempts"]) + 1
            record["attempts"].append(
                {
                    "attempt": record["current_attempt"],
                    "raw_image": args.raw_image or f"artwork/generated/{args.slug}.png",
                    "final_image": args.final_image or f"web/assets/images/{args.slug}.png",
                    "started_at": now(),
                    "reviews": {},
                    "status": "pending_review",
                }
            )
        write_record(record)
    print(qa_path(args.slug).relative_to(ROOT))


def record_review(args: argparse.Namespace) -> None:
    with record_lock(args.slug):
        record = read_record(args.slug)
        if not record["attempts"]:
            raise SystemExit(f"No attempt exists for {args.slug}; run init first")
        attempt = record["attempts"][-1]
        attempt["reviews"][args.agent] = {
            "status": args.status,
            "notes": args.notes,
            "reviewed_at": now(),
        }
        statuses = [review["status"] for review in attempt["reviews"].values()]
        if statuses and all(status == "pass" for status in statuses) and {"facts", "production"} <= set(attempt["reviews"]):
            attempt["status"] = "pass"
            record["final_status"] = "pass"
        elif any(status == "fail" for status in statuses):
            attempt["status"] = "fail"
            record["final_status"] = "retry_needed"
        write_record(record)
    print(qa_path(args.slug).relative_to(ROOT))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    init = sub.add_parser("init")
    init.add_argument("slug")
    init.add_argument("--raw-image")
    init.add_argument("--final-image")
    init.add_argument("--new-attempt", action="store_true")
    init.set_defaults(func=init_record)

    record = sub.add_parser("record")
    record.add_argument("slug")
    record.add_argument("--agent", choices=["facts", "production"], required=True)
    record.add_argument("--status", choices=["pass", "fail"], required=True)
    record.add_argument("--notes", required=True)
    record.set_defaults(func=record_review)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
