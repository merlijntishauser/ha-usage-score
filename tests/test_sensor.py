"""Tests for the HAUS score sensor and its coordinator wiring."""

import json
from unittest.mock import AsyncMock, patch

from homeassistant.core import Context, HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry, MockUser

from custom_components.haus.const import (
    COMMUNITY_AS_OF,
    COMMUNITY_AVG_AUTOMATIONS,
    COMMUNITY_AVG_USERS,
    COMMUNITY_REPORTING_INSTALLS,
    DIVERSITY_GROUPS,
    DOMAIN,
)
from custom_components.haus.coordinator import HausCoordinator


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Set up a HAUS entry and wait for it to settle."""
    entry = MockConfigEntry(domain=DOMAIN, title="HAUS")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_score_sensor_is_created(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The headline entity exists and is on scale."""
    await _setup(hass)

    state = hass.states.get("sensor.haus_score")

    assert state is not None
    assert 0 <= int(state.state) <= 100


async def test_a_fresh_empty_instance_scores_low_but_not_zero(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Nothing is configured, but the notification tally has no history yet.

    That metric sits neutral rather than at zero, so a brand new install is not
    punished for a counter that has not had time to run.
    """
    await _setup(hass)

    assert 0 < int(hass.states.get("sensor.haus_score").state) < 20


async def test_score_rises_once_automations_exist(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The collected signal actually reaches the published score."""
    for index in range(20):
        hass.states.async_set(f"automation.rule_{index}", "on")

    await _setup(hass)

    assert int(hass.states.get("sensor.haus_score").state) > 0


async def test_score_attributes_expose_the_breakdown(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The score is never the only thing on screen."""
    await _setup(hass)

    attributes = hass.states.get("sensor.haus_score").attributes

    assert attributes["tier"] == "Starter"
    assert attributes["haghs_available"] is False
    assert "usage" in attributes["pillars"]
    assert "usage" in attributes["contributions"]
    assert "hygiene" not in attributes["effective_weights"]


async def test_entry_reloads_without_a_restart(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Reload must be clean: the DoD says no restart is needed."""
    entry = await _setup(hass)

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()

    assert hass.states.get("sensor.haus_score") is not None


async def test_usage_pillar_sensor_is_created(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The owned pillars are published separately so they can be graphed."""
    await _setup(hass)

    state = hass.states.get("sensor.haus_usage")

    assert state is not None
    assert 0.0 <= float(state.state) <= 100.0


async def test_usage_sensor_exposes_the_metrics_behind_it(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The pillar must be openable, not just readable."""
    await _setup(hass)

    metrics = hass.states.get("sensor.haus_usage").attributes["metrics"]

    assert "fire_rate" in metrics
    assert "notifications" in metrics


async def test_the_pillar_sensor_shares_the_score_sensors_device(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """All four entities live on one HAUS service device."""
    await _setup(hass)
    registry = er.async_get(hass)

    score = registry.async_get("sensor.haus_score")
    usage = registry.async_get("sensor.haus_usage")

    assert score is not None
    assert usage is not None
    assert score.device_id == usage.device_id


async def test_diversity_sensor_is_created(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The diversity pillar is graphable in its own right too."""
    await _setup(hass)

    state = hass.states.get("sensor.haus_diversity")

    assert state is not None
    assert 0.0 <= float(state.state) <= 100.0


async def test_diversity_sensor_names_the_groups_with_nothing_in_them(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The missing-groups set is the most useful thing on the card."""
    MockConfigEntry(domain="hue").add_to_hass(hass)
    MockConfigEntry(domain="nest").add_to_hass(hass)
    await _setup(hass)

    attributes = hass.states.get("sensor.haus_diversity").attributes

    assert attributes["groups_covered"] == ["climate", "lighting"]
    assert "vacuum" in attributes["groups_missing"]
    assert len(attributes["groups_missing"]) == len(DIVERSITY_GROUPS) - 2
    assert 0.0 <= attributes["evenness"] <= 1.0


async def test_diversity_collected_from_config_entries_reaches_the_sensor(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Four real integrations across four groups, counted as four groups."""
    for domain in ("hue", "nest", "sonos", "unifi"):
        MockConfigEntry(domain=domain).add_to_hass(hass)
    await _setup(hass)

    state = hass.states.get("sensor.haus_diversity")

    assert state.attributes["groups_covered"] == [
        "climate",
        "lighting",
        "media",
        "network",
    ]
    assert float(state.state) > 0.0


async def test_users_sensor_is_created(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The household pillar is published like the others."""
    await _setup(hass)

    state = hass.states.get("sensor.haus_users")

    assert state is not None
    assert 0.0 <= float(state.state) <= 100.0


async def test_the_users_sensor_exposes_no_per_user_detail(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Privacy is a hard requirement: aggregates only, never a user id."""
    entry = await _setup(hass)
    hass.states.async_set(
        "light.kitchen", "on", context=Context(user_id="alice-user-id")
    )
    await hass.async_block_till_done()
    await entry.runtime_data.async_refresh()

    attributes = hass.states.get("sensor.haus_users").attributes

    assert "alice-user-id" not in json.dumps(dict(attributes), default=str)


async def test_no_entity_leaks_a_user_id(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Not just the users sensor: no HAUS entity may carry per-user detail."""
    entry = await _setup(hass)
    hass.states.async_set(
        "light.kitchen", "on", context=Context(user_id="alice-user-id")
    )
    await hass.async_block_till_done()
    await entry.runtime_data.async_refresh()

    haus_states = [
        hass.states.get(entity_id)
        for entity_id in hass.states.async_entity_ids("sensor")
        if entity_id.startswith("sensor.haus_")
    ]

    assert haus_states
    for state in haus_states:
        assert "alice-user-id" not in json.dumps(dict(state.attributes), default=str)


async def test_a_second_account_raises_the_users_pillar(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A home more than one person can operate scores higher."""
    entry = await _setup(hass)
    before = float(hass.states.get("sensor.haus_users").state)

    MockUser(name="Flatmate").add_to_hass(hass)
    await entry.runtime_data.async_refresh()
    await hass.async_block_till_done()

    assert float(hass.states.get("sensor.haus_users").state) > before


async def test_the_score_sensor_carries_its_weekly_history(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The card's sparkline reads this; the recorder is never asked for it."""
    await _setup(hass)

    state = hass.states.get("sensor.haus_score")
    history = state.attributes["score_history"]

    assert len(history) == 1
    assert history[0]["score"] == int(state.state)
    assert "week" in history[0]


async def test_the_score_is_collected_again_once_home_assistant_has_started(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Entry setup can run before automations and scripts exist.

    Home Assistant sets integrations up while other components are still
    loading, so the very first collection can see an instance with no
    automations, no scripts and no scenes, and publish a score that is simply
    wrong until the next interval. Collect again once everything has loaded.
    """
    with patch.object(
        HausCoordinator, "async_refresh", AsyncMock()
    ) as refresh_after_start:
        await _setup(hass)

    refresh_after_start.assert_awaited()


async def test_the_users_sensor_publishes_counts_not_only_scores(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A card showing "86 accounts" when there are four is a card that lies."""
    MockUser(name="Alice").add_to_hass(hass)
    MockUser(name="Bob").add_to_hass(hass)
    await _setup(hass)

    attributes = hass.states.get("sensor.haus_users").attributes

    assert isinstance(attributes["active_accounts"], int)
    assert isinstance(attributes["mobile_app_devices"], int)
    assert isinstance(attributes["users_active_7d"], int)
    assert isinstance(attributes["activity_history_days"], int)
    assert attributes["active_accounts"] >= 2
    # The metric is a saturating curve over the count, not the count itself.
    assert attributes["metrics"]["accounts"] > attributes["active_accounts"]


async def test_score_sensor_publishes_the_community_averages(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The card compares against these, so they travel as attributes.

    Bundled rather than fetched: Home Assistant publishes no distribution, only
    means, so there is nothing to refresh weekly that a release cannot carry.
    """
    await _setup(hass)

    community = hass.states.get("sensor.haus_score").attributes["community"]

    assert community["automations"] == COMMUNITY_AVG_AUTOMATIONS
    assert community["users"] == COMMUNITY_AVG_USERS
    assert community["as_of"] == COMMUNITY_AS_OF
    assert community["reporting_installs"] == COMMUNITY_REPORTING_INSTALLS
    # Not comparable, so deliberately absent rather than quietly wrong.
    assert "integrations" not in community
