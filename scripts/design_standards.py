"""Shared visual standards for oracle-card generation scripts.

This module is the single place for deck-wide image-generation language,
reference rules, layout safe zones, and broad planet-shape guidance. The exact
frame geometry still lives in card_template.py, so visual prompts, neutral
guides, and the compositor stay aligned with the generated SVG assets.
"""

from __future__ import annotations

from card_template import (
    BAND_H,
    BOTTOM_CELL_W,
    CH,
    CW,
    INSET,
    INSET_BOT,
    VH,
    VW,
    inner_box,
    notch_size,
)


REQUIRED_FIELDS = [
    "number",
    "name",
    "planet",
    "sign",
    "image_description",
]

STYLE_MODES = {
    "deck-print": {
        "label": "Deck-print balanced",
        "text": "Product anchor first; history only supports flat printed language.",
    },
    "woodcut": {
        "label": "Woodcut simpler",
        "text": "More woodcut: bolder silhouettes, fewer details, simpler hatching.",
    },
    "manuscript": {
        "label": "Manuscript narrative",
        "text": "More manuscript: symbolic gesture and flat decorative color.",
    },
}

DETAIL_LEVELS = {
    "low": "Low detail: simple forms, large color blocks, few background elements.",
    "medium": "Medium detail: readable story props and hatching, no micro-detail.",
    "high": "High printable detail: richer symbols, still flat and legible.",
}

VARIANT_GUIDES = [
    {
        "name": "source-action",
        "text": "Closest to source pose, scale, and action; strengthen tension.",
    },
    {
        "name": "emblem-tableau",
        "text": "Clear emblem-tableau, calm center, strong object placement.",
    },
    {
        "name": "narrative-peak",
        "text": "Strongest story beat: gaze, gesture, diagonal motion, pre-impact instant.",
    },
    {
        "name": "shape-led",
        "text": "Planet shape dominates color fields; scene stays simple/readable.",
    },
    {
        "name": "simple-woodcut",
        "text": "Few details, bold silhouettes, simple hatching, naive print charm.",
    },
]

SHAPE_GUIDES = {
    "Sun": "Sun underlay: upper pale-yellow semicircle/rising-sun color field with pale-aqua corners; lower story scene below. Do not draw final arc, chord, or label lines.",
    "Moon": "Moon underlay: clear upper/lower staging around the lower horizontal threshold. Do not draw final horizontal rule or label lines.",
    "Mercury": "Mercury underlay hard rule: build the main two-color field split on one exact straight diagonal from the inner picture area's top-left corner (about x 12%, y 10%) to the top-right corner of the bottom information band (about x 88%, y 83%). The color boundary must meet those two endpoints, not a parallel offset, not the outer card corners, not the bottom-right card corner. Keep motion, figures, and objects staged around this same descending diagonal. Use a soft color boundary or light hatching only; do not draw the final black diagonal stroke or label lines.",
    "Venus": "Venus underlay: open central field, graceful balance, light ornament. Do not draw final frame or label lines.",
    "Mars": "Mars underlay: top-center vertical tension meeting a crossbar idea for conflict or decision. Do not draw final mast/crossbar or label lines.",
    "Jupiter": "Jupiter underlay: central diamond/rhombus color field for main symbol/action. Keep diamond/circle as flat color fields with soft or minimal boundaries; do not draw final black diamond, circle outline, or label lines.",
    "Saturn": "Saturn underlay: severe upper-middle threshold for weight or constraint. Do not draw final horizontal rule or label lines.",
}

SHAPE_PHOTOS = {
    "Sun": "scanner/uploads/shapes/1_sun.heic",
    "Moon": "scanner/uploads/shapes/2_moon.heic",
    "Mercury": "scanner/uploads/shapes/3_mercury.heic",
    "Mars": "scanner/uploads/shapes/4_mars.heic",
    "Jupiter": "scanner/uploads/shapes/5_jupiter.heic",
    "Saturn": "scanner/uploads/shapes/6_saturn.heic",
    "Venus": "scanner/uploads/shapes/page_25_2.heic",
}

CANVAS_RULES = """\
Vertical portrait oracle-card underlay, 300:446 aspect ratio. Keep figures
legible inside a tall narrow card after overlay.
"""

UNDERLAY_HARD_RULES = """\
UNDERLAY ONLY. Code adds all fixed furniture later. Do not draw: outer/inner
border, top number square, bottom band/dividers/cells, title, glyphs, or final
planet-shape linework. Generate complete art behind overlays; no cutouts. When
a planet shape suggests a diamond, circle, diagonal, arc, crossbar, or panel,
use it as flat color-field organization only; do not outline it with strong
black geometry that will double with the SVG overlay.
"""

REFERENCE_RULES = """\
Use refs for environment, posture, objects, action, color, and print texture.
Do not copy exact linework, borders, type, labels, glyphs, or layout.
"""

PRODUCT_ANCHOR = """\
1980s-1990s mass-market occult oracle deck: cream stock, black ink, flat color.
"""

VISUAL_GRAMMAR = """\
Woodcut, manuscript miniature, Florentine line, Byzantine flat color, emblem
tableau. Use for pose, flatness, and staging.
"""

LINEWORK_RULES = """\
Black outlines, folk hatching, readable silhouettes, stiff printed figures,
simplified anatomy, low detail.
"""

COLOR_RULES = """\
Palette: cream card stock, pale aqua, buttery yellow, pink-lavender, spring
green, muted blue-gray, brick red, red-orange, antique gold, and black linework.
Low-saturation flat fields, few gradients, subtle paper grain.
"""

PRINT_RULES = """\
Print-safe: avoid extreme saturation, micro-detail, noisy texture, and soft tiny
lines. Prefer solid blocks, clear black lines, simple hatching.
"""

NARRATIVE_RULES = """\
Show one pressured story moment through pose, gaze, diagonal gesture, reaction,
and spatial conflict. Faces need intent; force comes from braced weight,
strain, recoil, compression, and object pressure. No cinematic lighting.
"""

NEGATIVE_CONTENT = """\
No readable text, no gibberish text, no fake letters, no text-like marks, no
title, no watermark, no logo. Do not invent fixed card-furniture numbers,
zodiac glyphs, or planet glyphs. Small symbolic diagram marks are allowed only
when the card's actual illustration requires them, and only inside the picture
scene or object, never as label-band furniture.
"""

NEGATIVE_FURNITURE = """\
No outer border, no inner border, no top number square, no bottom label-band
outline, no bottom dividers, no planet/zodiac cells, no final suit-motif stroke
lines, no finished card frame.
"""

NEGATIVE_STYLE = """\
Avoid modern fantasy, Dungeons-and-Dragons style, heroic game concept art,
photorealism, 3D, anime, glossy metal, digital-painting polish, cinematic
lighting, smoke, fire, magic glow, dense scenic realism, elaborate armor, and
excessive texture.
"""


def pct(value: float, total: float) -> float:
    return 100 * value / total


def frame_origin() -> tuple[float, float]:
    return (VW - CW) / 2, (VH - CH) / 2


def layout_metrics() -> dict[str, float | tuple[float, float, float, float]]:
    """Return canonical template metrics in the 300x446 SVG viewBox."""
    x, y = frame_origin()
    ix, iy, ir, ib, band_top = inner_box(x, y, CW, CH)
    sqw, sqh = notch_size(CW)
    nx = VW / 2 - sqw / 2
    ny = iy - 0.42 * sqh
    left_divider = ix + BOTTOM_CELL_W * CW
    right_divider = ir - BOTTOM_CELL_W * CW
    return {
        "frame": (x, y, x + CW, y + CH),
        "inner": (ix, iy, ir, ib),
        "illustration": (ix, iy, ir, band_top),
        "bottom_band": (ix, band_top, ir, ib),
        "notch": (nx, ny, nx + sqw, ny + sqh),
        "bottom_left_cell": (ix, band_top, left_divider, ib),
        "bottom_title_cell": (left_divider, band_top, right_divider, ib),
        "bottom_right_cell": (right_divider, band_top, ir, ib),
        "center_x": VW / 2,
        "sun_chord_y": iy + (ir - ix) / 2,
        "moon_rule_y": y + 0.648 * CH,
        "mars_rule_y": y + 0.467 * CH,
        "saturn_rule_y": y + 0.468 * CH,
        "jupiter_mid_y": (iy + band_top) / 2,
        "bottom_band_ratio": BAND_H,
        "outer_margin_ratio": INSET,
        "bottom_margin_ratio": INSET_BOT,
    }


def safe_zone_rules() -> str:
    m = layout_metrics()
    nx1, ny1, nx2, ny2 = m["notch"]  # type: ignore[misc]
    bx1, by1, bx2, by2 = m["bottom_band"]  # type: ignore[misc]
    ix1, iy1, ix2, _iy2 = m["inner"]  # type: ignore[misc]
    return (
        f"Draw uninterrupted art across the card, including top center and bottom. "
        f"Fill the future bottom band area with continuous background, ground, ornament, texture, or color field; "
        f"do not leave it blank or reserve it as empty paper. "
        f"Code later covers top square x {pct(nx1, VW):.0f}-{pct(nx2, VW):.0f}%, "
        f"y {pct(ny1, VH):.0f}-{pct(ny2, VH):.0f}% and bottom band y {pct(by1, VH):.0f}-{pct(by2, VH):.0f}%. "
        f"Keep key faces, hands, tools, symbols mostly in x {pct(ix1, VW):.0f}-{pct(ix2, VW):.0f}%, "
        f"y {pct(iy1, VH):.0f}-83%, away from outer 8%."
    )


def negative_prompt() -> str:
    return "\n".join(
        [
            NEGATIVE_CONTENT.strip(),
            NEGATIVE_FURNITURE.strip(),
            NEGATIVE_STYLE.strip(),
        ]
    )


def engineering_geometry_note(planet: str) -> str:
    m = layout_metrics()
    frame = m["frame"]  # type: ignore[assignment]
    inner = m["inner"]  # type: ignore[assignment]
    notch = m["notch"]  # type: ignore[assignment]
    band = m["bottom_band"]  # type: ignore[assignment]
    return (
        f"Canonical template source: scripts/card_template.py and "
        f"artwork/shapes/{planet.lower()}.svg. ViewBox {VW}x{VH}; "
        f"frame x1={frame[0]:.1f} y1={frame[1]:.1f} x2={frame[2]:.1f} y2={frame[3]:.1f}; "
        f"inner x1={inner[0]:.1f} y1={inner[1]:.1f} x2={inner[2]:.1f} y2={inner[3]:.1f}; "
        f"notch x1={notch[0]:.1f} y1={notch[1]:.1f} x2={notch[2]:.1f} y2={notch[3]:.1f}; "
        f"bottom band x1={band[0]:.1f} y1={band[1]:.1f} x2={band[2]:.1f} y2={band[3]:.1f}."
    )


def style_baseline_text() -> str:
    return "\n".join(
        [
            "Oracle card image-generation style baseline:",
            f"- {CANVAS_RULES.strip()}",
            f"- {UNDERLAY_HARD_RULES.strip()}",
            f"- {safe_zone_rules().strip()}",
            f"- Product anchor: {PRODUCT_ANCHOR.strip()}",
            f"- Historical grammar: {VISUAL_GRAMMAR.strip()}",
            f"- Linework: {LINEWORK_RULES.strip()}",
            f"- Color: {COLOR_RULES.strip()}",
            f"- Print: {PRINT_RULES.strip()}",
            f"- Narrative: {NARRATIVE_RULES.strip()}",
            f"- Negative: {negative_prompt()}",
        ]
    )
