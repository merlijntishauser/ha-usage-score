"""Unit tests for the pure scoring functions."""

import pytest

from custom_components.haus.scoring import (
    PillarScores,
    compute_score,
    effective_weights,
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
