"""Build editable image-generation prompts for the 84 oracle cards.

This script does not call an image API. It writes structured prompt files with
separate positive prompt, negative prompt, reference rules, and engineering
notes, while keeping the shared style language in one place for review.

Examples:
  python scripts/gen_image_prompts.py sun_aries
  python scripts/gen_image_prompts.py --all
  python scripts/gen_image_prompts.py sun_aries --variants 5
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from design_standards import (
    CANVAS_RULES,
    COLOR_RULES,
    DETAIL_LEVELS,
    LINEWORK_RULES,
    NARRATIVE_RULES,
    PRINT_RULES,
    PRODUCT_ANCHOR,
    REQUIRED_FIELDS,
    SHAPE_GUIDES,
    SHAPE_PHOTOS,
    STYLE_MODES,
    UNDERLAY_HARD_RULES,
    VARIANT_GUIDES,
    VISUAL_GRAMMAR,
    engineering_geometry_note,
    negative_prompt,
    safe_zone_rules,
)


ROOT = Path(__file__).resolve().parent.parent
CARD_DIR = ROOT / "data" / "cards"
VISUAL_NOTES_PATH = ROOT / "data" / "visual-notes.json"
UPLOADS_DIR = ROOT / "scanner" / "uploads"
CONVERTED_UPLOAD_DIR = ROOT / "tmp" / "imagegen_refs" / "uploaded_cards"
OUT_DIR = ROOT / "data" / "prompts"
LOCKED_VARIANT = 5
IMAGEGEN_REF_BASE = "tmp/imagegen_refs/"
RAW_IMAGE_DIR = "artwork/generated"
FINAL_IMAGE_DIR = "web/assets/images"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def truncate_text(value: str, max_chars: int) -> str:
    value = clean_text(value)
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 1].rstrip() + "…"


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def compact_ref(path: str) -> str:
    path = path.replace("\\", "/")
    if path.startswith(IMAGEGEN_REF_BASE):
        return path[len(IMAGEGEN_REF_BASE) :]
    return path


def normalized_name(value: str) -> str:
    value = value.replace("-Oracle-of-the-Radiant-Sun", "")
    value = re.sub(r"[_-]+", " ", value)
    value = re.sub(r"[^a-z0-9 ]+", "", value.lower())
    return re.sub(r"\s+", " ", value).strip()


def converted_upload_ref(path: Path) -> str:
    """Prefer JPG inspection copies when HEIC files have been converted locally."""
    if path.suffix.lower() not in {".heic", ".heif"}:
        return rel(path)
    stem = path.stem
    if path.parent.name in {"cards", "shapes"}:
        stem = f"{path.parent.name}_{stem}"
    converted = CONVERTED_UPLOAD_DIR / f"{stem}.jpg"
    if converted.exists():
        return rel(converted)
    return rel(path)


def resolve_uploaded_image(meta_path: Path, filename: str | None) -> Path:
    """Resolve scanner metadata filenames written either as siblings or folders."""
    if not filename:
        return meta_path.with_suffix(".jpg")
    raw = filename.replace("\\", "/")
    image_path = Path(raw)
    if image_path.is_absolute():
        return image_path
    card_upload_dir = UPLOADS_DIR / "cards"
    from_upload_root = card_upload_dir / image_path
    if from_upload_root.exists():
        return from_upload_root
    return meta_path.with_name(image_path.name)


def dedupe_refs(refs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    seen = set()
    out = []
    for label, path in refs:
        key = path.replace("\\", "/")
        if key in seen:
            continue
        seen.add(key)
        out.append((label, path))
    return out


def all_cards() -> list[dict]:
    cards = []
    for path in sorted(CARD_DIR.glob("*.json")):
        cards.extend(json.loads(path.read_text(encoding="utf-8")))
    return cards


def visual_notes() -> dict:
    if not VISUAL_NOTES_PATH.exists():
        return {}
    return json.loads(VISUAL_NOTES_PATH.read_text(encoding="utf-8"))


def slug_for(card: dict) -> str:
    return f"{card['planet'].lower()}_{card['sign'].lower()}"


def validate_card(card: dict) -> list[str]:
    problems = []
    for field in REQUIRED_FIELDS:
        if field not in card or not str(card[field]).strip():
            problems.append(f"missing required field: {field}")
    return problems


def uploaded_card_refs(card: dict) -> list[tuple[str, str]]:
    live_refs = []
    full_refs = []
    name_key = normalized_name(card["name"])
    for path in sorted(UPLOADS_DIR.glob("*.webp")):
        if normalized_name(path.stem) == name_key:
            full_refs.append(("full", rel(path)))

    card_upload_dir = UPLOADS_DIR / "cards"
    for meta_path in sorted(card_upload_dir.rglob("*.json")):
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        meta_card = meta.get("card") or {}
        same_slug = (
            str(meta_card.get("planet", "")).lower() == card["planet"].lower()
            and str(meta_card.get("sign", "")).lower() == card["sign"].lower()
        )
        same_name = normalized_name(str(meta_card.get("name", ""))) == name_key
        if not same_slug and not same_name:
            continue
        image_path = resolve_uploaded_image(meta_path, meta.get("filename"))
        if image_path.exists():
            live_refs.append(("live", converted_upload_ref(image_path)))
        else:
            live_refs.append(("meta", rel(meta_path)))
    return live_refs + full_refs


def reference_list(card: dict, notes: dict) -> list[tuple[str, str]]:
    slug = slug_for(card)
    planet = card["planet"]
    refs = []
    refs.extend(uploaded_card_refs(card))
    refs.extend(("note", ref) for ref in notes.get(slug, {}).get("reference_images", []))
    refs.extend([
        ("crop", f"tmp/imagegen_refs/card_crops/{slug}.jpg"),
        ("shape", converted_upload_ref(ROOT / SHAPE_PHOTOS[planet])),
        ("color", "tmp/imagegen_refs/askastrology/sun_aries_assertion.webp"),
        ("palette", "tmp/imagegen_refs/amazon_color_reference.jpg"),
    ])
    return dedupe_refs(refs)


def reference_block(card: dict, notes: dict) -> str:
    refs = reference_list(card, notes)
    lines = ["Base=tmp/imagegen_refs/"]
    lines.extend(f"R{index}={compact_ref(path)}" for index, (_label, path) in enumerate(refs, start=1))
    return "\n".join(lines)


def reference_usage(card: dict, notes: dict) -> str:
    refs = reference_list(card, notes)
    ids_by_label: dict[str, list[str]] = {}
    for index, (label, _path) in enumerate(refs, start=1):
        ids_by_label.setdefault(label, []).append(f"R{index}")

    def ids(*labels: str) -> str:
        selected = []
        for label in labels:
            selected.extend(ids_by_label.get(label, []))
        return "/".join(selected) if selected else "the available references"

    pose_refs = ids("live", "full", "note", "crop")
    shape_refs = ids("shape")
    palette_refs = ids("color", "palette")
    return (
        f"Use {pose_refs} for pose, expression, action, objects, and environment; "
        f"{palette_refs} for palette and print texture; {shape_refs} only for suit-shape structure. "
        "Do not copy borders, labels, glyphs, type, or exact linework."
    )


def control_reference_list(card: dict) -> list[str]:
    planet = card["planet"].lower()
    return [
        f"Control-only neutral layout mask: tmp/imagegen_guides/{planet}_underlay_guide.png",
        f"Exact final overlay SVG, for engineering/control use only: artwork/shapes/{planet}.svg",
    ]


def visual_note_block(slug: str, notes: dict) -> str:
    card_notes = notes.get(slug, {}).get("visual_notes", [])
    if not card_notes:
        return "No card-specific visual notes yet; rely on the source-card crop for pose, environment, objects, and mood."
    return "\n".join(f"- {note}" for note in card_notes)


def positive_prompt(
    card: dict,
    variant: int,
    style_mode: str,
    detail_level: str,
    max_description_chars: int,
    notes: dict,
) -> str:
    planet = card["planet"]
    slug = slug_for(card)
    variant_info = VARIANT_GUIDES[(variant - 1) % len(VARIANT_GUIDES)]
    description = truncate_text(card["image_description"], max_description_chars)
    return f"""\
Underlay for {RAW_IMAGE_DIR}/{slug}.png; final composed card will be {FINAL_IMAGE_DIR}/{slug}.png

{CANVAS_RULES.strip()}
{UNDERLAY_HARD_RULES.strip()}
{safe_zone_rules().strip()}
Planet-specific layout rule:
{SHAPE_GUIDES[planet]}

Card: {card['name']} ({planet} in {card['sign']})
Image description: {description}

Card-specific visual facts:
{visual_note_block(slug, notes)}

Reference use:
{reference_usage(card, notes)}

Create fresh original linework. Preserve symbolic content, action, and color mood.

Narrative and variant:
{NARRATIVE_RULES.strip()}
Variant {variant:02d} ({variant_info['name']}): {variant_info['text']}

Style:
- Product anchor: {PRODUCT_ANCHOR.strip()}
- Historical grammar: {VISUAL_GRAMMAR.strip()}
- Linework: {LINEWORK_RULES.strip()}

Color/print:
{COLOR_RULES.strip()}
{PRINT_RULES.strip()}

Shape:
{SHAPE_GUIDES[planet]}
"""


def engineering_notes(card: dict, positive: str, max_positive_chars: int) -> str:
    planet = card["planet"]
    slug = slug_for(card)
    warning = ""
    if len(positive) > max_positive_chars:
        warning = f"\nWARNING: positive prompt is {len(positive)} chars, above target {max_positive_chars}."
    return f"""\
Raw generated underlay target: {RAW_IMAGE_DIR}/{slug}.png
Final composed card target: {FINAL_IMAGE_DIR}/{slug}.png
Final overlay source: artwork/shapes/{planet.lower()}.svg
Optional control/edge guide source: artwork/shapes/{planet.lower()}.svg
Control-only neutral layout mask: tmp/imagegen_guides/{planet.lower()}_underlay_guide.png
Compositor: scripts/compose_card_image.py {slug} {RAW_IMAGE_DIR}/{slug}.png {FINAL_IMAGE_DIR}/{slug}.png
{engineering_geometry_note(planet)}
Positive prompt length: {len(positive)} chars.{warning}
"""


def prompt_file(
    card: dict,
    variant: int,
    style_mode: str,
    detail_level: str,
    max_description_chars: int,
    max_positive_chars: int,
    notes: dict,
) -> str:
    problems = validate_card(card)
    positive = positive_prompt(card, variant, style_mode, detail_level, max_description_chars, notes)
    negative = negative_prompt()
    references = reference_block(card, notes)
    control_refs = "\n".join(f"- {item}" for item in control_reference_list(card))
    validation = "OK" if not problems else "\n".join(f"- {problem}" for problem in problems)
    return f"""\
# META
Card: {card.get('name', '<missing>')}
Planet: {card.get('planet', '<missing>')}
Sign: {card.get('sign', '<missing>')}
Variant: {variant:02d} - {VARIANT_GUIDES[(variant - 1) % len(VARIANT_GUIDES)]['name']}
Style mode: {style_mode}
Detail level: {detail_level}
Validation: {validation}

# VISUAL REFERENCES
{references}

# CONTROL / MASK REFERENCES
These are not visual style references and should not be treated as half-finished
artwork. Use only when a tool supports layout masks, edge control, or manual
engineering checks.
{control_refs}

# POSITIVE PROMPT
{positive.strip()}

# NEGATIVE PROMPT
{negative.strip()}

# ENGINEERING NOTES
{engineering_notes(card, positive, max_positive_chars).strip()}
"""


def write_prompts(
    cards: list[dict],
    variants: int,
    locked_variant: int,
    style_mode: str,
    detail_level: str,
    max_description_chars: int,
    max_positive_chars: int,
) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    notes = visual_notes()
    for card in cards:
        slug = slug_for(card)
        if variants == 1:
            out = OUT_DIR / f"{slug}.txt"
            out.write_text(
                prompt_file(card, locked_variant, style_mode, detail_level, max_description_chars, max_positive_chars, notes),
                encoding="utf-8",
            )
            print(out.relative_to(ROOT))
            continue
        for variant in range(1, variants + 1):
            out = OUT_DIR / f"{slug}_v{variant:02d}.txt"
            out.write_text(
                prompt_file(card, variant, style_mode, detail_level, max_description_chars, max_positive_chars, notes),
                encoding="utf-8",
            )
            print(out.relative_to(ROOT))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("slug", nargs="?", help="Card slug, for example sun_aries")
    parser.add_argument("--all", action="store_true", help="Write prompts for all 84 cards")
    parser.add_argument("--variants", type=int, default=1, help="Candidate prompt count per card; 1 writes locked <slug>.txt")
    parser.add_argument("--locked-variant", type=int, default=LOCKED_VARIANT, help="Variant used for locked single-prompt output")
    parser.add_argument("--style-mode", choices=sorted(STYLE_MODES), default="deck-print")
    parser.add_argument("--detail-level", choices=sorted(DETAIL_LEVELS), default="medium")
    parser.add_argument("--max-description-chars", type=int, default=700)
    parser.add_argument("--max-positive-chars", type=int, default=3800)
    args = parser.parse_args()

    cards = all_cards()
    if args.all:
        selected = cards
    elif args.slug:
        selected = [card for card in cards if slug_for(card) == args.slug]
        if not selected:
            raise SystemExit(f"Unknown card slug: {args.slug}")
    else:
        raise SystemExit("Pass a slug or --all")
    write_prompts(
        selected,
        args.variants,
        args.locked_variant,
        args.style_mode,
        args.detail_level,
        args.max_description_chars,
        args.max_positive_chars,
    )


if __name__ == "__main__":
    main()
