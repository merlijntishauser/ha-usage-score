"""Unit tests for the pure scoring functions."""

import math

import pytest

from custom_components.haus.const import (
    ACTIVITY_RECENT_DAYS,
    ACTIVITY_SUSTAINED_DAYS,
    DIVERSITY_GROUPS,
    DOMAIN_GROUPS,
    NEUTRAL_METRIC_SCORE,
    NOTIFY_MIN_HISTORY_DAYS,
    OTHER_GROUP,
    TARGET_GROUPS,
    USAGE_METRIC_WEIGHTS,
    USERS_METRIC_WEIGHTS,
)
from custom_components.haus.scoring import (
    DiversitySignals,
    PillarScores,
    ScoreResult,
    UsageSignals,
    UsersSignals,
    build_result,
    compute_score,
    covered_groups,
    diversity_details,
    effective_weights,
    evenness,
    group_counts,
    group_for_domain,
    missing_groups,
    pillar_contributions,
    saturate,
    score_diversity,
    score_usage,
    score_users,
    tier_for_score,
    usage_metrics,
    users_details,
    users_metrics,
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


def test_usage_pillar_is_zero_for_an_empty_established_instance() -> None:
    """Nothing defined and nothing sent, once the tally has run, is zero."""
    established = UsageSignals(automations_defined=0, notification_history_days=30)

    assert score_usage(established) == 0.0


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
    signals = UsageSignals(automations_defined=0, automations_fired=0)

    assert 0.0 <= score_usage(signals) <= 100.0


def test_having_scripts_and_scenes_at_all_beats_having_none() -> None:
    """Presence is worth something, even before they are used."""
    none = UsageSignals(automations_defined=10)
    some = UsageSignals(automations_defined=10, scripts_defined=5, scenes_defined=5)

    assert score_usage(some) > score_usage(none)


def test_scripts_and_scenes_that_run_beat_ones_that_never_do() -> None:
    """The same rule as automations: firing is the signal."""
    idle = UsageSignals(scripts_defined=10, scenes_defined=10)
    used = UsageSignals(
        scripts_defined=10, scripts_run=10, scenes_defined=10, scenes_activated=10
    )

    assert score_usage(used) > score_usage(idle)


def test_scripts_and_scenes_absent_does_not_divide_by_zero() -> None:
    """An instance with neither must collect and score cleanly."""
    assert score_usage(UsageSignals(automations_defined=5)) >= 0.0


def test_helpers_raise_the_usage_pillar() -> None:
    """Helpers are the seam between a config and a house someone shaped."""
    bare = UsageSignals(automations_defined=10)
    with_helpers = UsageSignals(automations_defined=10, helper_count=12)

    assert score_usage(with_helpers) > score_usage(bare)


def test_helper_count_saturates_rather_than_scaling_forever() -> None:
    """Hoarding helpers stops paying, the way every other count does."""
    early = score_usage(UsageSignals(helper_count=5)) - score_usage(UsageSignals())
    late = score_usage(UsageSignals(helper_count=105)) - score_usage(
        UsageSignals(helper_count=100)
    )

    assert early > late


def test_notifications_stay_neutral_until_there_is_enough_history() -> None:
    """A fresh install is not punished for a tally that has not run yet."""
    fresh = UsageSignals(automations_defined=10, notification_history_days=0)
    silent = UsageSignals(
        automations_defined=10,
        notification_history_days=NOTIFY_MIN_HISTORY_DAYS,
        notification_count=0,
    )

    assert score_usage(fresh) > score_usage(silent)


def test_notifications_count_once_the_history_is_long_enough() -> None:
    """Past the threshold the real tally drives the metric."""
    quiet = UsageSignals(
        notification_history_days=NOTIFY_MIN_HISTORY_DAYS, notification_count=0
    )
    busy = UsageSignals(
        notification_history_days=NOTIFY_MIN_HISTORY_DAYS, notification_count=60
    )

    assert score_usage(busy) > score_usage(quiet)


def test_advanced_features_raise_the_usage_pillar() -> None:
    """Template entities, zones and voice are evidence of going further."""
    plain = UsageSignals(automations_defined=10)
    advanced = UsageSignals(
        automations_defined=10,
        advanced_features=frozenset({"template_entities", "zones"}),
    )

    assert score_usage(advanced) > score_usage(plain)


def test_each_advanced_feature_adds_to_the_metric() -> None:
    """The metric is a share of the recognised features, not a flag."""
    one = UsageSignals(advanced_features=frozenset({"zones"}))
    two = UsageSignals(advanced_features=frozenset({"zones", "template_entities"}))

    assert score_usage(two) > score_usage(one)


def test_unrecognised_features_cannot_inflate_the_score() -> None:
    """A collector reporting something unknown must not distort the pillar."""
    none = UsageSignals()
    bogus = UsageSignals(advanced_features=frozenset({"a", "b", "c", "d", "e"}))

    assert score_usage(bogus) == score_usage(none)


def test_every_usage_weight_has_a_metric_behind_it() -> None:
    """A weight with no metric would silently distort the mean."""
    assert set(usage_metrics(UsageSignals())) == set(USAGE_METRIC_WEIGHTS)


def test_usage_weights_are_a_full_split() -> None:
    """The metric weights are meant to divide the pillar, not part of it."""
    assert sum(USAGE_METRIC_WEIGHTS.values()) == pytest.approx(1.0)


def test_the_usage_pillar_is_the_weighted_mean_of_its_metrics() -> None:
    """What the breakdown card shows must reconcile with the pillar score."""
    signals = UsageSignals(
        automations_defined=10,
        automations_fired=5,
        helper_count=3,
        notification_history_days=30,
        notification_count=10,
    )
    metrics = usage_metrics(signals)

    expected = sum(
        USAGE_METRIC_WEIGHTS[name] * value for name, value in metrics.items()
    ) / sum(USAGE_METRIC_WEIGHTS.values())

    assert score_usage(signals) == pytest.approx(expected)


def test_evenness_is_one_when_every_group_is_equally_represented() -> None:
    """Perfectly spread breadth is the definition of even."""
    assert evenness({"lighting": 5, "climate": 5, "media": 5, "security": 5}) == 1.0


def test_evenness_is_zero_with_only_one_group() -> None:
    """Forty Hue bulbs is one integration group, and ln(1) is zero."""
    assert evenness({"lighting": 40}) == 0.0


def test_evenness_is_zero_for_an_empty_instance() -> None:
    """Nothing to spread must not divide by zero either."""
    assert evenness({}) == 0.0


def test_a_lopsided_instance_is_less_even_than_a_balanced_one() -> None:
    """One dominant group is exactly what this metric is meant to catch."""
    lopsided = evenness({"lighting": 40, "climate": 1, "media": 1})
    balanced = evenness({"lighting": 14, "climate": 14, "media": 14})

    assert lopsided < balanced


def test_evenness_stays_within_bounds() -> None:
    """It is a normalised entropy, so it belongs in the unit interval."""
    assert 0.0 <= evenness({"a": 1, "b": 99, "c": 3, "d": 7}) <= 1.0


def test_empty_groups_do_not_count_towards_evenness() -> None:
    """A group with nothing in it is missing, not present-but-quiet."""
    assert evenness({"lighting": 5, "climate": 5, "vacuum": 0}) == evenness(
        {"lighting": 5, "climate": 5}
    )


def test_a_known_domain_maps_to_its_group() -> None:
    """The curated mapping is the whole point of the pillar."""
    assert group_for_domain("hue") == "lighting"


def test_an_unknown_domain_falls_into_other() -> None:
    """A custom integration nobody has heard of must not crash the mapping."""
    assert group_for_domain("some_bespoke_thing") == OTHER_GROUP


def test_every_mapped_group_is_a_real_group() -> None:
    """A typo in the mapping would silently invent a group."""
    assert set(DOMAIN_GROUPS.values()) <= DIVERSITY_GROUPS


def test_other_is_not_one_of_the_countable_groups() -> None:
    """Unknown domains are not breadth; they are unclassified."""
    assert OTHER_GROUP not in DIVERSITY_GROUPS


def test_group_counts_collapse_many_domains_into_their_groups() -> None:
    """Forty Hue bulbs is one integration; two lighting brands is one group."""
    counts = group_counts(["hue", "lifx", "nest"])

    assert counts["lighting"] == 2
    assert counts["climate"] == 1


def test_diversity_is_zero_for_an_instance_with_nothing_set_up() -> None:
    """No integrations is no breadth."""
    assert score_diversity(DiversitySignals()) == 0.0


def test_covering_more_groups_raises_diversity() -> None:
    """Breadth across kinds of thing is what the pillar measures."""
    narrow = DiversitySignals(group_counts={"lighting": 3, "climate": 3})
    broad = DiversitySignals(
        group_counts={"lighting": 3, "climate": 3, "media": 3, "energy": 3}
    )

    assert score_diversity(broad) > score_diversity(narrow)


def test_a_pile_of_one_kind_of_thing_scores_low() -> None:
    """Forty Hue bulbs is one integration group, and one group is not breadth."""
    hoard = DiversitySignals(group_counts={"lighting": 40})
    spread = DiversitySignals(
        group_counts={"lighting": 2, "climate": 2, "media": 2, "energy": 2}
    )

    assert score_diversity(spread) > score_diversity(hoard)


def test_diversity_is_capped_at_one_hundred() -> None:
    """Covering everything, evenly, is still only 100."""
    everything = DiversitySignals(
        group_counts=dict.fromkeys(sorted(DIVERSITY_GROUPS), 5)
    )

    assert score_diversity(everything) == 100.0


def test_unclassified_integrations_are_not_breadth() -> None:
    """A pile of unknown custom integrations is not a spread of kinds."""
    unknown = DiversitySignals(group_counts={OTHER_GROUP: 30})

    assert score_diversity(unknown) == 0.0
    assert covered_groups(unknown) == frozenset()


def test_missing_groups_are_the_ones_with_nothing_in_them() -> None:
    """The most useful thing on the card, and it costs nothing."""
    signals = DiversitySignals(group_counts={"lighting": 2, "climate": 1})

    missing = missing_groups(signals)

    assert "lighting" not in missing
    assert "vacuum" in missing
    assert missing == DIVERSITY_GROUPS - {"lighting", "climate"}


def test_covering_the_target_saturates_the_coverage_half() -> None:
    """Beyond the target, extra groups stop paying for the coverage half."""
    at_target = DiversitySignals(
        group_counts=dict.fromkeys(sorted(DIVERSITY_GROUPS)[:TARGET_GROUPS], 1)
    )
    beyond = DiversitySignals(
        group_counts=dict.fromkeys(sorted(DIVERSITY_GROUPS)[: TARGET_GROUPS + 5], 1)
    )

    assert score_diversity(beyond) == score_diversity(at_target)


def test_users_pillar_is_zero_for_an_empty_established_instance() -> None:
    """No accounts is not a household, and must not divide by zero."""
    established = UsersSignals(activity_history_days=ACTIVITY_SUSTAINED_DAYS)

    assert score_users(established) == 0.0


def test_a_household_scores_above_a_one_person_hobby() -> None:
    """A home only its builder can operate is a hobby."""
    builder_only = UsersSignals(active_accounts=1)
    household = UsersSignals(active_accounts=3)

    assert score_users(household) > score_users(builder_only)


def test_mobile_apps_raise_the_users_pillar() -> None:
    """An account nobody can reach from their phone is barely an account."""
    without = UsersSignals(active_accounts=2)
    with_apps = UsersSignals(active_accounts=2, mobile_app_devices=2)

    assert score_users(with_apps) > score_users(without)


def test_accounts_that_do_things_beat_accounts_that_exist() -> None:
    """The same rule as everywhere else: use, not presence."""
    dormant = UsersSignals(
        active_accounts=3, activity_history_days=ACTIVITY_SUSTAINED_DAYS
    )
    busy = UsersSignals(
        active_accounts=3,
        users_active_7d=3,
        users_active_30d=3,
        activity_history_days=ACTIVITY_SUSTAINED_DAYS,
    )

    assert score_users(busy) > score_users(dormant)


def test_recent_activity_counts_for_more_than_stale_activity() -> None:
    """Someone who used it this week is operating the house now."""
    this_week = UsersSignals(
        active_accounts=2,
        users_active_7d=2,
        users_active_30d=2,
        activity_history_days=ACTIVITY_SUSTAINED_DAYS,
    )
    last_month = UsersSignals(
        active_accounts=2,
        users_active_7d=0,
        users_active_30d=2,
        activity_history_days=ACTIVITY_SUSTAINED_DAYS,
    )

    assert score_users(this_week) > score_users(last_month)


def test_users_pillar_stays_within_bounds() -> None:
    """More devices than accounts must not push the pillar off scale."""
    lopsided = UsersSignals(
        active_accounts=1,
        mobile_app_devices=25,
        users_active_7d=9,
        users_active_30d=9,
        activity_history_days=ACTIVITY_SUSTAINED_DAYS,
    )

    assert 0.0 <= score_users(lopsided) <= 100.0


def test_every_users_weight_has_a_metric_behind_it() -> None:
    """A weight with no metric would silently distort the mean."""
    assert set(users_metrics(UsersSignals())) == set(USERS_METRIC_WEIGHTS)


def test_users_weights_are_a_full_split() -> None:
    """The metric weights divide the pillar, not part of it."""
    assert sum(USERS_METRIC_WEIGHTS.values()) == pytest.approx(1.0)


def test_activity_stays_neutral_until_the_tally_covers_its_window() -> None:
    """A fresh install has no activity history, and did not earn a zero.

    The tally starts when HAUS does, so on day one nobody has "done nothing" -
    there has simply been no time to watch. Scoring that as zero punishes a new
    install for a counter that has not run yet.
    """
    fresh = UsersSignals(active_accounts=3, activity_history_days=0)
    established_silent = UsersSignals(
        active_accounts=3, activity_history_days=ACTIVITY_SUSTAINED_DAYS
    )

    assert score_users(fresh) > score_users(established_silent)


def test_each_activity_window_waits_for_its_own_history() -> None:
    """Judging a thirty-day window on ten days of data would be a guess."""
    ten_days = UsersSignals(
        active_accounts=2,
        users_active_7d=2,
        users_active_30d=2,
        activity_history_days=ACTIVITY_RECENT_DAYS + 3,
    )

    metrics = users_metrics(ten_days)

    assert metrics["activity_7d"] == 100.0
    assert metrics["activity_30d"] == NEUTRAL_METRIC_SCORE


def test_activity_counts_for_real_once_the_history_is_long_enough() -> None:
    """Past the threshold the real tally drives the metric, neutral is gone."""
    busy = UsersSignals(
        active_accounts=2,
        users_active_7d=2,
        users_active_30d=2,
        activity_history_days=ACTIVITY_SUSTAINED_DAYS,
    )
    silent = UsersSignals(
        active_accounts=2, activity_history_days=ACTIVITY_SUSTAINED_DAYS
    )

    assert users_metrics(busy)["activity_30d"] == 100.0
    assert users_metrics(silent)["activity_30d"] == 0.0


def test_diversity_details_carry_the_count_per_covered_group() -> None:
    """The spread card draws a stacked bar; it needs the sizes, not just names."""
    signals = DiversitySignals(
        group_counts={"lighting": 8, "climate": 2, OTHER_GROUP: 5}
    )

    details = diversity_details(signals)

    assert details["group_counts"] == {"lighting": 8, "climate": 2}


def test_diversity_details_leave_out_unclassified_integrations() -> None:
    """`other` is not a kind of thing, so it is not a bar segment either."""
    details = diversity_details(DiversitySignals(group_counts={OTHER_GROUP: 9}))

    assert details["group_counts"] == {}


def test_users_details_carry_the_raw_counts() -> None:
    """The household card must show counts, not the 0-100 metric scores.

    Four accounts saturate to a metric of 86; labelling that "86 accounts" is
    simply untrue, so the counts are published alongside.
    """
    signals = UsersSignals(
        active_accounts=4,
        mobile_app_devices=3,
        users_active_7d=2,
        users_active_30d=3,
        activity_history_days=9,
    )

    assert users_details(signals) == {
        "active_accounts": 4,
        "mobile_app_devices": 3,
        "users_active_7d": 2,
        "users_active_30d": 3,
        "activity_history_days": 9,
    }


def test_users_details_expose_no_per_user_information() -> None:
    """Counts only: the identities stay behind the websocket command."""
    details = users_details(UsersSignals(active_accounts=4))

    assert all(isinstance(value, int) for value in details.values())
