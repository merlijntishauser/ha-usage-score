"""Pure scoring functions.

This module deliberately has no Home Assistant imports: it maps plain
dataclasses to numbers so the whole of the scoring logic is unit-testable in
milliseconds without a Home Assistant fixture. Turning `hass` state into these
dataclasses is the job of `collectors.py`.
"""

import math
from dataclasses import dataclass

from .const import PILLAR_WEIGHTS, SCORE_MAX, SCORE_MIN


@dataclass(frozen=True)
class PillarScores:
    """The four pillar scores, each on a 0-100 scale."""

    hygiene: float
    usage: float
    diversity: float
    users: float


def compute_score(pillars: PillarScores) -> int:
    """Return the weighted overall score for the given pillar scores."""
    total = (
        PILLAR_WEIGHTS["hygiene"] * pillars.hygiene
        + PILLAR_WEIGHTS["usage"] * pillars.usage
        + PILLAR_WEIGHTS["diversity"] * pillars.diversity
        + PILLAR_WEIGHTS["users"] * pillars.users
    )
    return max(SCORE_MIN, min(SCORE_MAX, math.floor(total)))
