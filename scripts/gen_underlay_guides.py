"""Generate neutral layout masks for image-generation control.

These are not artwork and should not be used as visual style references. They
are low-contrast control masks for broad composition, safe overlay zones, and
manual checks. The exact black card furniture is still added later by
compose_card_image.py from web/assets/shapes/*.svg.

Run:
  python scripts/gen_underlay_guides.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

from design_standards import layout_metrics


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tmp" / "imagegen_guides"

W, H = 900, 1338
S = W / 300

PAPER = "#f7f4ec"
FIELD = "#ece9df"
FIELD_ALT = "#dedacd"
FIELD_DARK = "#d1ccbc"
RESERVED = "#fffdf7"


def sc(v: float) -> float:
    return v * S


def shape_metrics(planet: str) -> dict[str, tuple[float, float, float, float] | float]:
    metrics = layout_metrics()
    _bx1, band_top, _bx2, _by2 = metrics["bottom_band"]  # type: ignore[misc]
    return {
        "inner": metrics["inner"],
        "notch": metrics["notch"],
        "band_top": band_top,
        "center_x": metrics["center_x"],
        "sun_chord_y": metrics["sun_chord_y"],
        "moon_rule_y": metrics["moon_rule_y"],
        "mars_rule_y": metrics["mars_rule_y"],
        "saturn_rule_y": metrics["saturn_rule_y"],
        "jupiter_mid_y": metrics["jupiter_mid_y"],
    }


def base() -> Image.Image:
    return Image.new("RGB", (W, H), PAPER)


def inner_area(planet: str) -> tuple[float, float, float, float]:
    metrics = shape_metrics(planet)
    return metrics["inner"]  # type: ignore[return-value]


def common_safe(draw: ImageDraw.ImageDraw, planet: str) -> None:
    metrics = shape_metrics(planet)
    ix1, _iy1, ix2, iy2 = metrics["inner"]  # type: ignore[misc]
    band_top = metrics["band_top"]
    # Future overlay zone: keep visible in guides, but do not imply a cutout.
    draw.rectangle((sc(ix1), sc(float(band_top)), sc(ix2), sc(iy2)), fill=RESERVED)


def sun(draw: ImageDraw.ImageDraw) -> None:
    ix1, iy1, ix2, _iy2 = inner_area("sun")
    metrics = shape_metrics("sun")
    chord_y = float(metrics["sun_chord_y"])
    band_top = float(metrics["band_top"])
    draw.rectangle((sc(ix1), sc(iy1), sc(ix2), sc(chord_y)), fill=FIELD)
    draw.pieslice((sc(ix1), sc(iy1), sc(ix2), sc(chord_y + (ix2 - ix1))), 180, 360, fill=FIELD_ALT)
    draw.rectangle((sc(ix1), sc(chord_y), sc(ix2), sc(band_top)), fill=FIELD_DARK)
    common_safe(draw, "sun")


def moon(draw: ImageDraw.ImageDraw) -> None:
    ix1, iy1, ix2, _iy2 = inner_area("moon")
    metrics = shape_metrics("moon")
    rule_y = float(metrics["moon_rule_y"])
    band_top = float(metrics["band_top"])
    draw.rectangle((sc(ix1), sc(iy1), sc(ix2), sc(rule_y)), fill=FIELD)
    draw.rectangle((sc(ix1), sc(rule_y), sc(ix2), sc(band_top)), fill=FIELD_ALT)
    common_safe(draw, "moon")


def mercury(draw: ImageDraw.ImageDraw) -> None:
    ix1, iy1, ix2, _iy2 = inner_area("mercury")
    band_top = float(shape_metrics("mercury")["band_top"])
    draw.polygon([(sc(ix1), sc(iy1)), (sc(ix2), sc(iy1)), (sc(ix2), sc(band_top))], fill=FIELD)
    draw.polygon([(sc(ix1), sc(iy1)), (sc(ix1), sc(band_top)), (sc(ix2), sc(band_top))], fill=FIELD_ALT)
    common_safe(draw, "mercury")


def venus(draw: ImageDraw.ImageDraw) -> None:
    ix1, iy1, ix2, _iy2 = inner_area("venus")
    band_top = float(shape_metrics("venus")["band_top"])
    draw.rectangle((sc(ix1), sc(iy1), sc(ix2), sc(band_top)), fill=FIELD)
    common_safe(draw, "venus")


def mars(draw: ImageDraw.ImageDraw) -> None:
    ix1, iy1, ix2, _iy2 = inner_area("mars")
    metrics = shape_metrics("mars")
    center_x = float(metrics["center_x"])
    rule_y = float(metrics["mars_rule_y"])
    band_top = float(metrics["band_top"])
    draw.rectangle((sc(ix1), sc(iy1), sc(center_x), sc(rule_y)), fill=FIELD)
    draw.rectangle((sc(center_x), sc(iy1), sc(ix2), sc(rule_y)), fill=FIELD_ALT)
    draw.rectangle((sc(ix1), sc(rule_y), sc(ix2), sc(band_top)), fill=FIELD_DARK)
    common_safe(draw, "mars")


def jupiter(draw: ImageDraw.ImageDraw) -> None:
    ix1, iy1, ix2, _iy2 = inner_area("jupiter")
    metrics = shape_metrics("jupiter")
    center_x = float(metrics["center_x"])
    mid_y = float(metrics["jupiter_mid_y"])
    band_top = float(metrics["band_top"])
    draw.rectangle((sc(ix1), sc(iy1), sc(ix2), sc(band_top)), fill=FIELD)
    draw.polygon([(sc(center_x), sc(iy1)), (sc(ix2), sc(mid_y)), (sc(center_x), sc(band_top)), (sc(ix1), sc(mid_y))], fill=FIELD_ALT)
    common_safe(draw, "jupiter")


def saturn(draw: ImageDraw.ImageDraw) -> None:
    ix1, iy1, ix2, _iy2 = inner_area("saturn")
    metrics = shape_metrics("saturn")
    rule_y = float(metrics["saturn_rule_y"])
    band_top = float(metrics["band_top"])
    draw.rectangle((sc(ix1), sc(iy1), sc(ix2), sc(rule_y)), fill=FIELD_ALT)
    draw.rectangle((sc(ix1), sc(rule_y), sc(ix2), sc(band_top)), fill=FIELD)
    common_safe(draw, "saturn")


DRAWERS = {
    "sun": sun,
    "moon": moon,
    "mercury": mercury,
    "venus": venus,
    "mars": mars,
    "jupiter": jupiter,
    "saturn": saturn,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in DRAWERS.items():
        img = base()
        draw = ImageDraw.Draw(img)
        fn(draw)
        out = OUT / f"{name}_underlay_guide.png"
        img.save(out)
        print(out.relative_to(ROOT))


if __name__ == "__main__":
    main()
