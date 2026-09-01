"""Unit tests for the pure scoring functions."""

from custom_components.haus.scoring import PillarScores, compute_score


def test_score_is_floor_of_weighted_pillar_sum() -> None:
    """The documented arithmetic: 71 = floor(.30*84 + .30*70 + .25*61 + .15*66)."""
    pillars = PillarScores(hygiene=84.0, usage=70.0, diversity=61.0, users=66.0)

    # 25.2 + 21.0 + 15.25 + 9.9 = 71.35
    assert compute_score(pillars) == 71


def test_score_is_clamped_to_the_zero_hundred_range() -> None:
    """Pillar values outside 0-100 must never push the score off scale."""
    assert compute_score(PillarScores(200.0, 200.0, 200.0, 200.0)) == 100
    assert compute_score(PillarScores(-50.0, -50.0, -50.0, -50.0)) == 0
