"""Unit tests for the pure scoring functions."""

import math

import pytest

from custom_components.haus.scoring import (
    PillarScores,
    ScoreResult,
    UsageSignals,
    build_result,
    compute_score,
    effective_weights,
    pillar_contributions,
    saturate,
    score_usage,
    tier_for_score,
)


def test_score_is_floor_of_weighted_pillar_sum() -> None:
    """The documented arithmetic: 71 = floor(.30*84 + .30*70 + .25*61 + .15*66)."""
    pillars = PillarScores(hygiene=84.0, usage=70.0, diversity=61.0, users=66.0)

    # 25.2 + 21.0 + 15.25 + 9.9 = 71.35
    assert compute_score(pillars) == 71


def test_score_is_clamped_to_the_zero_hundred_range() -> None:
    """Pillar values outside 0-100 must never push the score off scale."""
    assert compute_score(PillarScores(200.0, 200.0, 200.0, 200.0)) == 100
    assert compute_score(PillarScores(-50.0, -50.0, -50.0, -50.0)) == 0


def test_hygiene_absent_renormalises_over_the_owned_pillars() -> None:
    """A missing HAGHS must not cap the score at 70: the rest carry the scale."""
    perfect_without_hygiene = PillarScores(
        hygiene=None, usage=100.0, diversity=100.0, users=100.0
    )

    assert compute_score(perfect_without_hygiene) == 100


def test_effective_weights_sum_to_one_with_or_without_hygiene() -> None:
    """Renormalisation keeps the score on the same 0-100 scale either way."""
    with_hygiene = sum(effective_weights(hygiene_available=True).values())
    without_hygiene = sum(effective_weights(hygiene_available=False).values())

    assert with_hygiene == pytest.approx(1.0)
    assert without_hygiene == pytest.approx(1.0)


def test_effective_weights_drop_hygiene_when_it_is_unavailable() -> None:
    """The pillar is dropped, not zeroed - zeroing would tank the score."""
    assert "hygiene" not in effective_weights(hygiene_available=False)


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (0, "Starter"),
        (39, "Starter"),
        (40, "Tinkerer"),
        (59, "Tinkerer"),
        (60, "Enthusiast"),
        (79, "Enthusiast"),
        (80, "Power user"),
        (92, "Power user"),
        (93, "Overengineered"),
        (100, "Overengineered"),
    ],
)
def test_tier_boundaries(score: int, expected: str) -> None:
    """Every tier edge, from both sides."""
    assert tier_for_score(score) == expected


def test_saturate_is_zero_for_an_empty_instance() -> None:
    """No signal is no points; the curve starts at the origin."""
    assert saturate(0, k=10.0) == 0.0


def test_saturate_is_bounded_by_one_hundred() -> None:
    """A pillar cannot run away, however absurd the count."""
    assert saturate(10_000, k=10.0) <= 100.0


def test_saturate_stays_below_one_hundred_across_realistic_counts() -> None:
    """The curve is asymptotic in the range any real instance occupies.

    Past roughly 36*k the exponential underflows and the result is exactly
    100.0; no plausible home is anywhere near that, but the bound above is what
    the code actually guarantees.
    """
    assert saturate(350, k=10.0) < 100.0


def test_saturate_is_monotonic_in_the_count() -> None:
    """More of a good thing never lowers a pillar score."""
    scores = [saturate(n, k=10.0) for n in range(0, 60)]

    assert scores == sorted(scores)
    assert scores[0] < scores[-1]


def test_saturate_yields_the_curve_constant_at_k() -> None:
    """At n == k the curve is at 1 - 1/e, which is what makes k the knee."""
    assert saturate(10, k=10.0) == pytest.approx(100.0 * (1.0 - math.exp(-1.0)))


def test_saturate_rewards_small_homes_faster_than_a_linear_ratio() -> None:
    """Half of k must already be worth more than half the points a linear
    ratio against a large target would give: small homes are not punished."""
    assert saturate(5, k=10.0) > 50.0 * (5 / 10)


def test_contributions_sum_to_the_overall_score() -> None:
    """The ring is drawn from these, so they must reconcile with the number."""
    pillars = PillarScores(hygiene=84.0, usage=70.0, diversity=61.0, users=66.0)

    total = sum(pillar_contributions(pillars).values())

    assert math.floor(total) == compute_score(pillars)


def test_contributions_reconcile_without_hygiene_too() -> None:
    """The renormalised weights must be the ones used for the arcs."""
    pillars = PillarScores(hygiene=None, usage=70.0, diversity=61.0, users=66.0)

    total = sum(pillar_contributions(pillars).values())

    assert math.floor(total) == compute_score(pillars)
    assert "hygiene" not in pillar_contributions(pillars)


def test_a_contribution_is_the_pillar_score_times_its_effective_weight() -> None:
    """Arc length is points earned, not raw score."""
    pillars = PillarScores(hygiene=84.0, usage=70.0, diversity=61.0, users=66.0)
    weight = effective_weights(hygiene_available=True)["usage"]

    assert pillar_contributions(pillars)["usage"] == pytest.approx(weight * 70.0)


def test_usage_pillar_is_zero_for_an_instance_with_no_automations() -> None:
    """Nothing defined is nothing used."""
    assert score_usage(UsageSignals(automations_defined=0)) == 0.0


def test_usage_pillar_rises_with_the_number_of_automations() -> None:
    """More automations never lowers the usage pillar."""
    scores = [score_usage(UsageSignals(automations_defined=n)) for n in range(0, 40)]

    assert scores == sorted(scores)
    assert scores[0] < scores[-1]


def test_usage_pillar_stays_within_bounds() -> None:
    """A pillar is always on the same 0-100 scale as every other pillar."""
    assert 0.0 <= score_usage(UsageSignals(automations_defined=5_000)) <= 100.0


def test_build_result_assembles_everything_the_sensor_publishes() -> None:
    """One pure call produces the score and every attribute hung off it."""
    pillars = PillarScores(hygiene=84.0, usage=70.0, diversity=61.0, users=66.0)

    result = build_result(pillars)

    assert isinstance(result, ScoreResult)
    assert result.score == compute_score(pillars)
    assert result.tier == tier_for_score(result.score)
    assert result.haghs_available is True
    assert result.contributions == pillar_contributions(pillars)
    assert result.effective_weights == effective_weights(hygiene_available=True)


def test_build_result_reports_hygiene_as_unavailable_when_absent() -> None:
    """The card needs to know to draw the ghost row, not silently drop it."""
    result = build_result(PillarScores(None, usage=70.0, diversity=61.0, users=66.0))

    assert result.haghs_available is False
    assert "hygiene" not in result.effective_weights


def test_usage_rewards_automations_that_actually_fire() -> None:
    """Firing is the thing being measured, not defining."""
    idle = UsageSignals(automations_defined=20, automations_fired=0)
    active = UsageSignals(automations_defined=20, automations_fired=20)

    assert score_usage(active) > score_usage(idle)


def test_a_small_active_instance_beats_a_large_idle_one() -> None:
    """62 automations that never trigger is not usage."""
    many_idle = UsageSignals(automations_defined=60, automations_fired=0)
    few_active = UsageSignals(automations_defined=6, automations_fired=6)

    assert score_usage(few_active) > score_usage(many_idle)


def test_fire_rate_is_undefined_rather_than_zero_without_automations() -> None:
    """No automations means nothing to divide by; that must not crash."""
    assert score_usage(UsageSignals(automations_defined=0, automations_fired=0)) == 0.0
