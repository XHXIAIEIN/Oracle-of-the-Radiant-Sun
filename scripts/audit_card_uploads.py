"""Audit scanner/uploads/cards against the 84 canonical card records.

The scanner can leave images as unknown_card_*. This helper creates a compact
machine-readable audit plus visual contact sheets so those photos can be mapped
back to their exact card slugs before prompt generation.

Usage:
  python scripts/audit_card_uploads.py
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
CARD_DIR = ROOT / "data" / "cards"
UPLOAD_DIR = ROOT / "scanner" / "uploads" / "cards"
OUT_DIR = ROOT / "tmp" / "imagegen_refs"
CONTACT_DIR = OUT_DIR / "card_upload_contacts"

PLANET_ORDER = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def slug_for(card: dict) -> str:
    return f"{card['planet'].lower()}_{card['sign'].lower()}"


def load_expected() -> dict[str, dict]:
    expected = {}
    for path in sorted(CARD_DIR.glob("*.json")):
        for card in json.loads(path.read_text(encoding="utf-8")):
            expected[slug_for(card)] = {
                "slug": slug_for(card),
                "number": card["number"],
                "name": card["name"],
                "planet": card["planet"],
                "sign": card["sign"],
            }
    return expected


def resolve_image(meta_path: Path, filename: str | None) -> Path:
    if not filename:
        return meta_path.with_suffix(".jpg")
    candidate = Path(filename.replace("\\", "/"))
    if candidate.is_absolute():
        return candidate
    from_upload_root = UPLOAD_DIR / candidate
    if from_upload_root.exists():
        return from_upload_root
    return meta_path.with_name(candidate.name)


def load_entries() -> list[dict]:
    entries = []
    for meta_path in sorted(UPLOAD_DIR.rglob("*.json")):
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            entries.append(
                {
                    "meta": rel(meta_path),
                    "slug": None,
                    "unknown": True,
                    "error": str(exc),
                }
            )
            continue

        card = meta.get("card") or {}
        slug = None
        if card.get("planet") and card.get("sign"):
            slug = f"{card['planet'].lower()}_{card['sign'].lower()}"
        image_path = resolve_image(meta_path, meta.get("filename"))
        entries.append(
            {
                "meta": rel(meta_path),
                "image": rel(image_path) if image_path.exists() else image_path.as_posix(),
                "image_exists": image_path.exists(),
                "slug": slug,
                "dir": meta_path.parent.name,
                "stem": meta_path.stem,
                "filename": meta.get("filename"),
                "unknown": "unknown" in meta_path.stem.lower() or not slug,
                "card": card,
                "recognition": meta.get("recognition") or {},
            }
        )
    return entries


def build_audit() -> dict:
    expected = load_expected()
    entries = load_entries()
    by_slug: dict[str, list[dict]] = defaultdict(list)
    for entry in entries:
        if entry.get("slug"):
            by_slug[entry["slug"]].append(entry)

    missing = [slug for slug in sorted(expected) if slug not in by_slug]
    extra = [slug for slug in sorted(by_slug) if slug not in expected]
    unknown = [entry for entry in entries if entry.get("unknown")]
    duplicates = {slug: rows for slug, rows in sorted(by_slug.items()) if len(rows) > 1}
    image_missing = [entry for entry in entries if not entry.get("image_exists")]

    missing_by_planet: dict[str, list[str]] = defaultdict(list)
    for slug in missing:
        missing_by_planet[expected[slug]["planet"].lower()].append(slug)

    for entry in unknown:
        entry["same_planet_missing_candidates"] = missing_by_planet.get(entry["dir"], [])

    return {
        "summary": {
            "expected_cards": len(expected),
            "upload_meta_json": len(entries),
            "image_files_jpg": len(list(UPLOAD_DIR.rglob("*.jpg"))),
            "recognized_slugs": len(by_slug),
            "missing_expected": len(missing),
            "extra_slugs": len(extra),
            "unknown_or_unmapped": len(unknown),
            "duplicate_slugs": len(duplicates),
            "image_missing": len(image_missing),
            "by_dir": dict(sorted(Counter(entry["dir"] for entry in entries).items())),
        },
        "missing": [{"slug": slug, **expected[slug]} for slug in missing],
        "extra": extra,
        "unknown": unknown,
        "duplicates": duplicates,
        "image_missing": image_missing,
        "entries": entries,
    }


def load_font(size: int) -> ImageFont.ImageFont:
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def fit_thumb(path: Path, size: tuple[int, int]) -> Image.Image:
    img = Image.open(path).convert("RGB")
    target_w, target_h = size
    scale = min(target_w / img.width, target_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "#f4ecd8")
    x = (target_w - resized.width) // 2
    y = (target_h - resized.height) // 2
    canvas.paste(resized, (x, y))
    return canvas


def write_contact_sheet(planet: str, entries: list[dict]) -> Path:
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    rows = sorted(entries, key=lambda e: (e.get("slug") or "zz_" + e["stem"], e["stem"]))
    cols = 4
    thumb_w, thumb_h = 160, 238
    label_h = 48
    gap = 12
    header_h = 38
    sheet_w = cols * thumb_w + (cols + 1) * gap
    sheet_h = header_h + ((len(rows) + cols - 1) // cols) * (thumb_h + label_h + gap) + gap
    sheet = Image.new("RGB", (sheet_w, sheet_h), "#f4ecd8")
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(20)
    label_font = load_font(12)
    draw.text((gap, 8), f"{planet.upper()} uploads ({len(rows)})", fill="#15130f", font=title_font)

    for idx, entry in enumerate(rows):
        col = idx % cols
        row = idx // cols
        x = gap + col * (thumb_w + gap)
        y = header_h + gap + row * (thumb_h + label_h + gap)
        image_path = ROOT / entry["image"]
        if image_path.exists():
            thumb = fit_thumb(image_path, (thumb_w, thumb_h))
            sheet.paste(thumb, (x, y))
        else:
            draw.rectangle((x, y, x + thumb_w, y + thumb_h), outline="#15130f", width=2)
            draw.text((x + 10, y + 10), "missing image", fill="#15130f", font=label_font)
        draw.rectangle((x, y, x + thumb_w, y + thumb_h), outline="#15130f", width=1)
        label = entry.get("slug") or entry["stem"]
        if entry.get("unknown"):
            label = "UNKNOWN: " + entry["stem"].replace("unknown_card_", "")
        draw.multiline_text((x, y + thumb_h + 4), label[:44], fill="#15130f", font=label_font, spacing=2)

    out = CONTACT_DIR / f"{planet}.jpg"
    sheet.save(out, quality=92)
    return out


def write_contact_sheets(audit: dict) -> list[Path]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for entry in audit["entries"]:
        grouped[entry["dir"]].append(entry)

    out = []
    for planet in PLANET_ORDER:
        if grouped.get(planet):
            out.append(write_contact_sheet(planet, grouped[planet]))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", type=Path, default=OUT_DIR / "card_upload_audit.json")
    parser.add_argument("--no-contact-sheets", action="store_true")
    args = parser.parse_args()

    audit = build_audit()
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    sheets = [] if args.no_contact_sheets else write_contact_sheets(audit)

    summary = audit["summary"]
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"audit={rel(args.json_out)}")
    if sheets:
        for sheet in sheets:
            print(f"sheet={rel(sheet)}")
    if audit["missing"]:
        print("missing=" + ", ".join(item["slug"] for item in audit["missing"]))
    if audit["unknown"]:
        print("unknown=" + ", ".join(item["meta"] for item in audit["unknown"]))


if __name__ == "__main__":
    main()
