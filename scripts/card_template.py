"""Shared oracle-card frame geometry and SVG renderer.

The generated artwork is only the illustration underlay. This module owns the
fixed card furniture: outer frame, inner frame, top number notch, planet suit
motif, bottom information band, and deterministic glyph/title placement.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


VW, VH = 300, 446
CW, CH = 260, 395

BG = "#f4ecd8"
CARD = BG
BACK = BG
INK = "#15130f"
BORDER = "#b6973f"
LABEL = "#3c3015"
FONT_NAME = "EBGaramond"
FONT_NUMBER = "GoudyOldStyle"
FONT_SYMBOL = "Quivira"
FONT_NAME_FILE = "EBGaramond-SemiBold.ttf"
FONT_NAME_WEIGHT = 600
FONT_NUMBER_FILE = "GoudyOldStyle-Bold.ttf"
FONT_SYMBOL_FILE = "Quivira.otf"
FONT_DIR = Path(__file__).resolve().parent.parent / "web" / "assets" / "fonts"

# Measured ratios from real card photos and the page-25 Card Shapes plate.
INSET = 0.065
INSET_BOT = 0.090
BAND_H = 0.067
BOTTOM_CELL_W = 0.095
BOTTOM_GLYPH_SIZE = 0.073
BOTTOM_GLYPH_FIT_W = 0.74
BOTTOM_GLYPH_FIT_H = 0.74
BOTTOM_GLYPH_OPTICAL_SCALE = {
    "♐": 0.82,
}
NOTCH_W = 0.066
NOTCH_H = 0.073
NUMBER_SINGLE_RATIO = 0.74
NUMBER_DOUBLE_RATIO = 0.65
TITLE_FONT_MAX_H_RATIO = 0.056
TITLE_WIDTH_RATIO = 0.86
TITLE_MIN_FONT_SIZE = 3.4
MOTIF_STROKE_WIDTH = 0.65
MOTIF_STROKE_OPACITY = 0.72

SIGN_ORD = {
    "aries": 1,
    "taurus": 2,
    "gemini": 3,
    "cancer": 4,
    "leo": 5,
    "virgo": 6,
    "libra": 7,
    "scorpio": 8,
    "sagittarius": 9,
    "capricorn": 10,
    "aquarius": 11,
    "pisces": 12,
}

ZUNI = {
    "aries": "♈",
    "taurus": "♉",
    "gemini": "♊",
    "cancer": "♋",
    "leo": "♌",
    "virgo": "♍",
    "libra": "♎",
    "scorpio": "♏",
    "sagittarius": "♐",
    "capricorn": "♑",
    "aquarius": "♒",
    "pisces": "♓",
}
PUNI = {
    "Sun": "☉",
    "Moon": "☽",
    "Mercury": "☿",
    "Venus": "♀",
    "Mars": "♂",
    "Jupiter": "♃",
    "Saturn": "♄",
}

SUIT_BAND = {
    "Sun": "#f0cf48",
    "Moon": "#d7e8c4",
    "Mercury": "#bfdedc",
    "Venus": "#e7bfd0",
    "Mars": "#e59680",
    "Jupiter": "#c7dcf0",
    "Saturn": "#d9cf9a",
}


@lru_cache(maxsize=None)
def _font(filename: str) -> TTFont:
    return TTFont(str(FONT_DIR / filename))


@lru_cache(maxsize=None)
def _glyph_set(filename: str):
    return _font(filename).getGlyphSet()


@lru_cache(maxsize=None)
def _cmap(filename: str) -> dict[int, str]:
    cmap: dict[int, str] = {}
    for table in _font(filename)["cmap"].tables:
        cmap.update(table.cmap)
    return cmap


def _text_path_data(filename: str, text: str, size: float, letter_spacing: float = 0) -> tuple[str, tuple[float, float, float, float], float, int]:
    font = _font(filename)
    glyph_set = _glyph_set(filename)
    cmap = _cmap(filename)
    upem = font["head"].unitsPerEm
    spacing_units = letter_spacing * upem / size if size else 0
    svg_pen = SVGPathPen(glyph_set)
    bounds_pen = BoundsPen(glyph_set)
    x = 0.0
    for index, ch in enumerate(text):
        glyph_name = cmap.get(ord(ch))
        if glyph_name is None:
            if ch.isspace():
                x += upem * 0.28
                continue
            raise ValueError(f"{filename} is missing glyph for {ch!r}")
        transform = Transform(1, 0, 0, 1, x, 0)
        glyph = glyph_set[glyph_name]
        glyph.draw(TransformPen(svg_pen, transform))
        glyph.draw(TransformPen(bounds_pen, transform))
        x += glyph.width
        if index < len(text) - 1:
            x += spacing_units
    bounds = bounds_pen.bounds or (0.0, 0.0, x, 0.0)
    return svg_pen.getCommands(), bounds, x, upem


def outline_text(
    text: str,
    filename: str,
    size: float,
    cx: float,
    cy: float,
    fill: str = INK,
    letter_spacing: float = 0,
    width_limit: float | None = None,
    valign: str = "center",
) -> str:
    path, bounds, _advance, upem = _text_path_data(filename, text, size, letter_spacing)
    if not path:
        return ""
    minx, miny, maxx, maxy = bounds
    scale = size / upem
    sx = scale
    visual_width = (maxx - minx) * scale
    if width_limit and visual_width > width_limit:
        sx *= width_limit / visual_width
    tx = cx - sx * (minx + maxx) / 2
    if valign == "baseline":
        ty = cy
    else:
        ty = cy + scale * (miny + maxy) / 2
    return (
        f'<path d="{path}" transform="matrix({sx:.6f} 0 0 {-scale:.6f} '
        f'{tx:.2f} {ty:.2f})" fill="{fill}"/>'
    )


def text_width(filename: str, text: str, size: float, letter_spacing: float = 0) -> float:
    _path, bounds, _advance, upem = _text_path_data(filename, text, size, letter_spacing)
    minx, _miny, maxx, _maxy = bounds
    return (maxx - minx) * size / upem


def text_box_size(filename: str, text: str, size: float, letter_spacing: float = 0) -> tuple[float, float]:
    _path, bounds, _advance, upem = _text_path_data(filename, text, size, letter_spacing)
    minx, miny, maxx, maxy = bounds
    scale = size / upem
    return (maxx - minx) * scale, (maxy - miny) * scale


def fit_text_size(filename: str, text: str, size: float, max_w: float, max_h: float) -> float:
    width, height = text_box_size(filename, text, size)
    if width <= 0 or height <= 0:
        return size
    return min(size, size * max_w / width, size * max_h / height)


def svg_font_defs(font_dir: str = "../fonts", embed: bool = False) -> str:
    return ""


SVG_FONT_DEFS = svg_font_defs()


def notch_size(w: float) -> tuple[float, float]:
    return NOTCH_W * w, NOTCH_H * w


def number_font_size(w: float, number: str) -> float:
    _sqw, sqh = notch_size(w)
    ratio = NUMBER_SINGLE_RATIO if len(number) == 1 else NUMBER_DOUBLE_RATIO
    return sqh * ratio


def title_font_size(h: float, cellw: float, text: str) -> float:
    fs = TITLE_FONT_MAX_H_RATIO * h
    while fs > TITLE_MIN_FONT_SIZE and text_width(FONT_NAME_FILE, text, fs) > cellw:
        fs -= 0.2
    return max(fs, TITLE_MIN_FONT_SIZE)


def bottom_glyph_font_size(text: str, w: float, cellw: float, cellh: float) -> float:
    size = BOTTOM_GLYPH_SIZE * w * BOTTOM_GLYPH_OPTICAL_SCALE.get(text, 1.0)
    return fit_text_size(
        FONT_SYMBOL_FILE,
        text,
        size,
        cellw * BOTTOM_GLYPH_FIT_W,
        cellh * BOTTOM_GLYPH_FIT_H,
    )


def inner_box(x: float, y: float, w: float, h: float) -> tuple[float, float, float, float, float]:
    """Return left, top, right, bottom, and bottom-band top for a card frame."""
    il = x + INSET * w
    ir = x + w - INSET * w
    it = y + INSET * w
    ib = y + h - INSET_BOT * w
    return il, it, ir, ib, ib - BAND_H * h


def _uni(ch: str, cx: float, cy: float, size: float, color: str = INK) -> str:
    return outline_text(ch, FONT_SYMBOL_FILE, size, cx, cy, color)


def zglyph(sign: str, cx: float, cy: float, size: float, color: str = INK) -> str:
    return _uni(ZUNI[sign], cx, cy, size, color)


def pglyph(planet: str, cx: float, cy: float, size: float, color: str = INK) -> str:
    return _uni(PUNI[planet], cx, cy, size, color)


def suit_motif(planet: str, x: float, y: float, w: float, h: float) -> list[str]:
    def yf(fy: float) -> float:
        return y + fy * h

    il, itop, ir, _ibot, shelf = inner_box(x, y, w, h)
    midx = x + w / 2
    out: list[str] = []
    if planet == "Sun":
        r = (ir - il) / 2
        cy = itop + r
        out.append(f'<line x1="{il:.1f}" y1="{cy:.1f}" x2="{ir:.1f}" y2="{cy:.1f}"/>')
        out.append(f'<path d="M{il:.1f},{cy:.1f} A{r:.1f},{r:.1f} 0 0 1 {ir:.1f},{cy:.1f}"/>')
    elif planet == "Moon":
        cy = yf(0.648)
        out.append(f'<line x1="{il:.1f}" y1="{cy:.1f}" x2="{ir:.1f}" y2="{cy:.1f}"/>')
    elif planet == "Mercury":
        out.append(f'<line x1="{il:.1f}" y1="{itop:.1f}" x2="{ir:.1f}" y2="{shelf:.1f}"/>')
    elif planet == "Venus":
        pass
    elif planet == "Mars":
        cy = yf(0.467)
        out.append(f'<line x1="{midx:.1f}" y1="{itop:.1f}" x2="{midx:.1f}" y2="{cy:.1f}"/>')
        out.append(f'<line x1="{il:.1f}" y1="{cy:.1f}" x2="{ir:.1f}" y2="{cy:.1f}"/>')
    elif planet == "Jupiter":
        vc = (itop + shelf) / 2
        out.append(
            f'<path d="M{midx:.1f},{itop:.1f} L{ir:.1f},{vc:.1f} '
            f'L{midx:.1f},{shelf:.1f} L{il:.1f},{vc:.1f} Z"/>'
        )
    elif planet == "Saturn":
        cy = yf(0.468)
        out.append(f'<line x1="{il:.1f}" y1="{cy:.1f}" x2="{ir:.1f}" y2="{cy:.1f}"/>')
    return out


def card(
    cx: float,
    cy: float,
    w: float,
    h: float,
    planet: str | None = None,
    sign: str | None = None,
    name: str | None = None,
    faceup: bool = True,
) -> str:
    x = cx - w / 2
    y = cy - h / 2
    rx = 0.078 * w
    if not faceup:
        return (
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w}" height="{h}" rx="{rx:.1f}" '
            f'fill="{BACK}" stroke="{BORDER}" stroke-width="1.3"/>'
        )

    out: list[str] = [
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w}" height="{h}" rx="{rx:.1f}" '
        f'fill="{CARD}" stroke="{INK}" stroke-width="1.5"/>'
    ]
    ix, iy, irx, iby, by = inner_box(x, y, w, h)
    iw = irx - ix
    ih = iby - iy
    out.append(
        f'<rect x="{ix:.1f}" y="{iy:.1f}" width="{iw:.1f}" height="{ih:.1f}" '
        f'fill="none" stroke="{INK}" stroke-width="0.7"/>'
    )
    if planet:
        motif = suit_motif(planet, x, y, w, h)
        if motif:
            out.append(
                f'<g fill="none" stroke="{INK}" stroke-width="{MOTIF_STROKE_WIDTH}" '
                f'stroke-opacity="{MOTIF_STROKE_OPACITY}" '
                f'stroke-linecap="round" stroke-linejoin="round">{"".join(motif)}</g>'
            )

    band_width = BOTTOM_CELL_W * w
    d1 = ix + band_width
    d2 = irx - band_width
    band_fill = SUIT_BAND.get(planet, CARD) if planet else CARD
    out.append(
        f'<path d="M{ix:.1f},{by:.1f} H{irx:.1f} V{iby:.1f} H{ix:.1f} Z" '
        f'fill="{band_fill}"/>'
    )
    out.append(
        f'<g fill="none" stroke="{INK}" stroke-width="0.8">'
        f'<line x1="{ix:.1f}" y1="{by:.1f}" x2="{irx:.1f}" y2="{by:.1f}"/>'
        f'<line x1="{d1:.1f}" y1="{by:.1f}" x2="{d1:.1f}" y2="{iby:.1f}"/>'
        f'<line x1="{d2:.1f}" y1="{by:.1f}" x2="{d2:.1f}" y2="{iby:.1f}"/></g>'
    )

    sqw, sqh = notch_size(w)
    nx = cx - sqw / 2
    ny = iy - 0.42 * sqh
    out.append(
        f'<rect x="{nx:.1f}" y="{ny:.1f}" width="{sqw:.1f}" height="{sqh:.1f}" '
        f'fill="{band_fill}" stroke="{INK}" stroke-width="0.8"/>'
    )
    if sign:
        num = str(SIGN_ORD[sign])
        nfs = number_font_size(w, num)
        out.append(outline_text(num, FONT_NUMBER_FILE, nfs, cx, ny + sqh * 0.54))

    cellcy = (by + iby) / 2
    if planet:
        text = PUNI[planet]
        out.append(_uni(text, (ix + d1) / 2, cellcy, bottom_glyph_font_size(text, w, d1 - ix, iby - by)))
    if sign:
        text = ZUNI[sign]
        out.append(_uni(text, (d2 + irx) / 2, cellcy, bottom_glyph_font_size(text, w, irx - d2, iby - by)))
    if name:
        nm = name.upper()
        cellw = (d2 - d1) * TITLE_WIDTH_RATIO
        fs = title_font_size(h, cellw, nm)
        out.append(outline_text(nm, FONT_NAME_FILE, fs, cx, cellcy, width_limit=cellw))
    return "".join(out)


def face_svg(planet: str, sign: str, name: str) -> str:
    body = card(VW / 2, VH / 2, CW, CH, planet=planet, sign=sign.lower(), name=name, faceup=True)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}">'
        f'{SVG_FONT_DEFS}<rect width="{VW}" height="{VH}" fill="{BG}"/>{body}</svg>'
    )


def shape_svg(planet: str) -> str:
    body = card(VW / 2, VH / 2, CW, CH, planet=planet, sign=None, name=None, faceup=True)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}">'
        f'{SVG_FONT_DEFS}<rect width="{VW}" height="{VH}" fill="{BG}"/>{body}</svg>'
    )
