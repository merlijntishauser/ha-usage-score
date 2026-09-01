"""Pure scoring functions.

This module deliberately has no Home Assistant imports: it maps plain
dataclasses to numbers so the whole of the scoring logic is unit-testable in
milliseconds without a Home Assistant fixture. Turning `hass` state into these
dataclasses is the job of `collectors.py`.
"""

import math
from dataclasses import dataclass

from .const import (
    K_AUTOMATION_COUNT,
    K_HELPER_COUNT,
    K_NOTIFICATION_COUNT,
    K_SCRIPT_SCENE_COUNT,
    NEUTRAL_METRIC_SCORE,
    NOTIFY_MIN_HISTORY_DAYS,
    PILLAR_WEIGHTS,
    SCORE_MAX,
    SCORE_MIN,
    SCORE_TIERS,
    USAGE_METRIC_WEIGHTS,
)


def saturate(count: int, k: float) -> float:
    """Return a 0-100 score that rises steeply then flattens.

    `100 * (1 - exp(-n / k))`. A linear ratio against a target would punish a
    small home forever; a saturating curve gives early additions real weight and
    stops rewarding hoarding. `k` is the knee, and lives in `const.py` per
    metric.
    """
    return 100.0 * (1.0 - math.exp(-count / k))


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


@dataclass(frozen=True)
class UsageSignals:
    """Raw usage signals collected from the instance.

    Every field defaults, so a collector that cannot see a signal yet reports
    nothing rather than a misleading zero.
    """

    automations_defined: int = 0
    automations_fired: int = 0
    scripts_defined: int = 0
    scripts_run: int = 0
    scenes_defined: int = 0
    scenes_activated: int = 0
    helper_count: int = 0
    notification_count: int = 0
    notification_history_days: int = 0


def _fire_rate(signals: UsageSignals) -> float:
    """Return the share of defined automations that fired in the window.

    An instance with no automations has no rate to speak of; it scores zero
    here rather than dividing by zero.
    """
    if signals.automations_defined == 0:
        return 0.0
    fired = min(signals.automations_fired, signals.automations_defined)
    return 100.0 * fired / signals.automations_defined


def _script_scene_score(signals: UsageSignals) -> float:
    """Score scripts and scenes on both presence and use.

    Half the metric is having any one-touch routines at all, half is whether
    they get run. An instance with neither scores zero rather than dividing by
    zero.
    """
    defined = signals.scripts_defined + signals.scenes_defined
    if defined == 0:
        return 0.0
    used = min(signals.scripts_run + signals.scenes_activated, defined)
    presence = saturate(defined, k=K_SCRIPT_SCENE_COUNT)
    rate = 100.0 * used / defined
    return 0.5 * presence + 0.5 * rate


def _notification_score(signals: UsageSignals) -> float:
    """Score notifications sent, or stay neutral while the tally is young."""
    if signals.notification_history_days < NOTIFY_MIN_HISTORY_DAYS:
        return NEUTRAL_METRIC_SCORE
    return saturate(signals.notification_count, k=K_NOTIFICATION_COUNT)


def score_usage(signals: UsageSignals) -> float:
    """Return the usage pillar score, 0-100.

    A weighted mean over the implemented metrics, normalised by the weights
    actually in play, so adding a metric does not require retuning the others.
    """
    metrics = {
        "fire_rate": _fire_rate(signals),
        "automation_count": saturate(signals.automations_defined, k=K_AUTOMATION_COUNT),
        "scripts_scenes": _script_scene_score(signals),
        "helpers": saturate(signals.helper_count, k=K_HELPER_COUNT),
        "notifications": _notification_score(signals),
    }
    weight_total = sum(USAGE_METRIC_WEIGHTS[name] for name in metrics)
    weighted = sum(
        USAGE_METRIC_WEIGHTS[name] * value for name, value in metrics.items()
    )
    return weighted / weight_total


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


def pillar_contributions(pillars: PillarScores) -> dict[str, float]:
    """Return the points each pillar actually contributed to the score.

    These are what the card draws its ring arcs from: the gap to a full circle
    is the unearned points, colour-coded by which pillar to go and fix. Keyed in
    canonical pillar order; an absent hygiene pillar is simply not present.
    """
    weights = effective_weights(hygiene_available=pillars.hygiene is not None)
    values: dict[str, float] = {
        "usage": pillars.usage,
        "diversity": pillars.diversity,
        "users": pillars.users,
    }
    if pillars.hygiene is not None:
        values["hygiene"] = pillars.hygiene
    return {
        name: weights[name] * values[name] for name in PILLAR_WEIGHTS if name in values
    }


def compute_score(pillars: PillarScores) -> int:
    """Return the weighted overall score for the given pillar scores."""
    total = sum(pillar_contributions(pillars).values())
    return max(SCORE_MIN, min(SCORE_MAX, math.floor(total)))


def tier_for_score(score: int) -> str:
    """Return the tier label for a score."""
    label = SCORE_TIERS[0][1]
    for threshold, tier in SCORE_TIERS:
        if score >= threshold:
            label = tier
    return label


@dataclass(frozen=True)
class ScoreResult:
    """Everything the score sensor publishes, assembled in one pure call."""

    score: int
    tier: str
    pillars: PillarScores
    contributions: dict[str, float]
    effective_weights: dict[str, float]
    haghs_available: bool


def build_result(pillars: PillarScores) -> ScoreResult:
    """Assemble the full published result for a set of pillar scores."""
    score = compute_score(pillars)
    hygiene_available = pillars.hygiene is not None
    return ScoreResult(
        score=score,
        tier=tier_for_score(score),
        pillars=pillars,
        contributions=pillar_contributions(pillars),
        effective_weights=effective_weights(hygiene_available=hygiene_available),
        haghs_available=hygiene_available,
    )
