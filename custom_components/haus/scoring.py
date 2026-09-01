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
    """The four pillar scores, each on a 0-100 scale.

    `hygiene` is None when HAGHS is not installed, or is reporting unknown or
    unavailable. That is an absent pillar, not a zero one.
    """

    hygiene: float | None
    usage: float
    diversity: float
    users: float


def effective_weights(*, hygiene_available: bool) -> dict[str, float]:
    """Return the pillar weights actually in force.

    With HAGHS absent the hygiene pillar is dropped and the remaining three are
    renormalised over their own weight sum, so the score stays on a 0-100 scale
    and stays comparable to itself over time.
    """
    if hygiene_available:
        return dict(PILLAR_WEIGHTS)
    owned = {name: w for name, w in PILLAR_WEIGHTS.items() if name != "hygiene"}
    owned_total = sum(owned.values())
    return {name: w / owned_total for name, w in owned.items()}


def compute_score(pillars: PillarScores) -> int:
    """Return the weighted overall score for the given pillar scores."""
    weights = effective_weights(hygiene_available=pillars.hygiene is not None)
    total = (
        weights["usage"] * pillars.usage
        + weights["diversity"] * pillars.diversity
        + weights["users"] * pillars.users
    )
    if pillars.hygiene is not None:
        total += weights["hygiene"] * pillars.hygiene
    return max(SCORE_MIN, min(SCORE_MAX, math.floor(total)))
