"""Draw the HAUS brand images from the same numbers the card draws its ring from.

The segmented ring is the product's mark: four arcs, one per pillar, sized to
the pillar weights. Generating it rather than hand-drawing it means the icon
cannot drift away from PILLAR_COLORS and PILLAR_WEIGHTS when either is retuned
- and both have been retuned before.

    uv run python scripts/make_brand_images.py

Writes into custom_components/haus/brand/:

    icon.png            256   square, the avatar-shaped mark
    icon@2x.png         512
    logo.png           x256   landscape, ring plus wordmark
    logo@2x.png        x512
    dark_logo.png      x256   the same with light text
    dark_logo@2x.png   x512

There is no dark_icon: the four pillar colours stay distinguishable on
near-black at every size the icon is rendered at, checked down to 24px. The
wordmark is not so lucky - it is near-black text, so the dark pair is required
rather than optional.

**The logo half needs a macOS system font** and will not regenerate elsewhere
without one. The icon half is pure geometry and runs anywhere. If this ever
needs to work off a Mac, vendor an OFL-licensed face into the repository and
point WORDMARK_FONT at it; that was the alternative considered and declined,
to avoid carrying a font and its licence for two images.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

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

# Index 1 of this collection is the Bold face. A .ttc index is a fragile thing
# to depend on; if the wordmark ever comes out in the wrong weight, look here.
WORDMARK_FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
WORDMARK_FONT_INDEX = 1
WORDMARK = "HAUS"
WORDMARK_INK = "#212121"
WORDMARK_INK_DARK = "#f5f5f5"

# Supersample for the logo. Lower than the icon's because the canvas is wider
# and the text is already rendered with antialiasing.
LOGO_SUPERSAMPLE = 4


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


def draw_logo(height: int, *, dark: bool) -> Image.Image:
    """Return the ring beside the wordmark, `height` pixels tall.

    Landscape, and trimmed on every edge: the ring sets the height and touches
    top and bottom, the ring's left edge is x=0, and the canvas ends at the
    last pixel of the S.
    """
    tall = height * LOGO_SUPERSAMPLE
    ring = draw_ring(tall)
    font = ImageFont.truetype(
        WORDMARK_FONT, int(tall * 0.62), index=WORDMARK_FONT_INDEX
    )

    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    left, top, right, bottom = probe.textbbox((0, 0), WORDMARK, font=font)
    text_width, text_height = right - left, bottom - top

    gap = int(tall * 0.22)
    canvas = Image.new("RGBA", (tall + gap + text_width, tall), (0, 0, 0, 0))
    canvas.alpha_composite(ring, (0, 0))
    ImageDraw.Draw(canvas).text(
        (tall + gap - left, (tall - text_height) // 2 - top),
        WORDMARK,
        font=font,
        fill=WORDMARK_INK_DARK if dark else WORDMARK_INK,
    )

    scaled = canvas.resize((canvas.width // LOGO_SUPERSAMPLE, height), Image.LANCZOS)

    # Dividing the supersampled width leaves a few transparent columns on the
    # right, where the S's antialiased edge falls inside the rounded canvas.
    # Cropping to the alpha box is what "trimmed" means; the height is
    # unaffected because the ring already touches top and bottom.
    box = scaled.getchannel("A").getbbox()
    trimmed = scaled.crop(box) if box else scaled
    if trimmed.height != height:
        raise RuntimeError(f"trim changed the height: {trimmed.height} != {height}")
    return trimmed


def main() -> None:
    """Write every brand image."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    master = draw_ring(SUPERSAMPLE)
    for name, size in (("icon.png", 256), ("icon@2x.png", 512)):
        path = OUT_DIR / name
        master.resize((size, size), Image.LANCZOS).save(path, optimize=True)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")

    # The shortest side must be 128-256 for the normal size and 256-512 for
    # the hDPI one. Landscape, so that side is the height.
    for name, height, dark in (
        ("logo.png", 256, False),
        ("logo@2x.png", 512, False),
        ("dark_logo.png", 256, True),
        ("dark_logo@2x.png", 512, True),
    ):
        path = OUT_DIR / name
        image = draw_logo(height, dark=dark)
        image.save(path, optimize=True)
        print(f"wrote {path.relative_to(ROOT)} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
