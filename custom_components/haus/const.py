"""Constants for the HAUS integration.

Every tunable lives here with the reasoning behind its value, so retuning is a
one-line change that does not cascade into the tests. Tests assert on behaviour
(bounds, monotonicity, saturation), never on the specific numbers below.
"""

DOMAIN = "haus"

# Pillar weights. Hygiene is consumed from HAGHS rather than recomputed; the
# three owned pillars carry 70% between them so that HAUS remains meaningful,
# and comparable to itself, on an instance where HAGHS is not installed.
PILLAR_WEIGHTS: dict[str, float] = {
    "hygiene": 0.30,
    "usage": 0.30,
    "diversity": 0.25,
    "users": 0.15,
}

# The published score is always on a 0-100 scale, whatever the pillars do. A
# pillar that misbehaves must not be able to push the headline number off scale.
SCORE_MIN = 0
SCORE_MAX = 100
