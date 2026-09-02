"""Draw the HAUS brand icon from the same numbers the card draws its ring from.

The segmented ring is the product's mark: four arcs, one per pillar, sized to
the pillar weights. Generating it rather than hand-drawing it means the icon
cannot drift away from PILLAR_COLORS and PILLAR_WEIGHTS when either is retuned
- and both have been retuned before.

    uv run python scripts/make_brand_icon.py

Writes custom_components/haus/brand/icon.png (256) and icon@2x.png (512).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from custom_components.haus.const import PILLAR_WEIGHTS  # noqa: E402

OUT_DIR = ROOT / "custom_components" / "haus" / "brand"

# Kept in step with src/const.ts by hand - it is four hex values, and a build
# step that parses TypeScript from Python would be worse than the problem.
PILLAR_COLORS = {
    "hygiene": "#2f6fd0",
    "usage": "#0e9384",
    "diversity": "#b5750a",
    "users": "#c2456e",
}
PILLARS = ["hygiene", "usage", "diversity", "users"]

# Proportions come from the BADGE, not the hero card. M6 already had to solve
# "this ring, but small": the hero is 176 across with a 13 stroke (7.4%) while
# the 26px badge uses 3 (11.5%), and the badge's gap works out near 5 degrees
# against the hero's 1.4. An icon is rendered at badge sizes and smaller in a
# HACS list, so it inherits the badge's answer. At the hero's ratio the 15%
# users arc is almost gone by 32px.
STROKE_RATIO = 3 / 26
GAP_DEGREES = 5.0

# Drawn large and scaled down: Pillow's arc has no antialiasing of its own.
SUPERSAMPLE = 2048


def draw_ring(size: int) -> Image.Image:
    """Return the segmented ring on a transparent square of `size` pixels."""
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    stroke = round(size * STROKE_RATIO)
    # Pillow draws an arc's width INWARD from the bounding box rather than
    # centred on it, so the box is the whole canvas. Insetting by half the
    # stroke, as an SVG radius would need, leaves a transparent margin - and
    # the brand guidance asks for the minimum empty space at the edges.
    box = (0, 0, size - 1, size - 1)

    # Twelve o'clock, matching the card's rotate(-90) on the ring group.
    angle = -90.0
    for pillar in PILLARS:
        span = PILLAR_WEIGHTS[pillar] * 360.0
        draw.arc(
            box,
            start=angle + GAP_DEGREES / 2,
            end=angle + span - GAP_DEGREES / 2,
            fill=PILLAR_COLORS[pillar],
            width=stroke,
        )
        angle += span
    return image


def main() -> None:
    """Write both icon sizes."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    master = draw_ring(SUPERSAMPLE)

    for name, size in (("icon.png", 256), ("icon@2x.png", 512)):
        path = OUT_DIR / name
        master.resize((size, size), Image.LANCZOS).save(path, optimize=True)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
