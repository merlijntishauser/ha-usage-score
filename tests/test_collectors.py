"""Tests for the collectors, the only code in HAUS that reads `hass`."""

from datetime import timedelta
from unittest.mock import patch

from homeassistant.config_entries import SOURCE_IGNORE, ConfigEntryDisabler
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, MockUser

from custom_components.haus.collectors import (
    collect_diversity,
    collect_usage,
    collect_users,
)
from custom_components.haus.const import DOMAIN, OTHER_GROUP


async def test_collect_usage_counts_only_automation_entities(
    hass: HomeAssistant,
) -> None:
    """Automations are counted; everything else on the instance is not."""
    hass.states.async_set("automation.morning_lights", "on")
    hass.states.async_set("automation.away_mode", "off")
    hass.states.async_set("light.kitchen", "on")
    await hass.async_block_till_done()

    signals = collect_usage(hass)

    assert signals.automations_defined == 2


async def test_collect_usage_on_an_empty_instance(hass: HomeAssistant) -> None:
    """A fresh instance collects cleanly rather than raising."""
    assert collect_usage(hass).automations_defined == 0


async def test_only_automations_triggered_in_the_window_count_as_fired(
    hass: HomeAssistant,
) -> None:
    """A rule that last ran in March is not evidence of use today."""
    now = dt_util.utcnow()
    hass.states.async_set(
        "automation.recent",
        "on",
        {"last_triggered": now - timedelta(days=1)},
    )
    hass.states.async_set(
        "automation.stale",
        "on",
        {"last_triggered": now - timedelta(days=90)},
    )
    hass.states.async_set("automation.never_fired", "on", {"last_triggered": None})
    hass.states.async_set("automation.no_attribute", "on")
    await hass.async_block_till_done()

    signals = collect_usage(hass)

    assert signals.automations_defined == 4
    assert signals.automations_fired == 1


async def test_last_triggered_is_accepted_as_an_iso_string(
    hass: HomeAssistant,
) -> None:
    """Restored states carry the timestamp as a string, not a datetime."""
    recent = (dt_util.utcnow() - timedelta(hours=2)).isoformat()
    hass.states.async_set("automation.restored", "on", {"last_triggered": recent})
    await hass.async_block_till_done()

    assert collect_usage(hass).automations_fired == 1


async def test_an_unparseable_last_triggered_is_treated_as_never_fired(
    hass: HomeAssistant,
) -> None:
    """A malformed attribute must not take the whole collection down."""
    hass.states.async_set("automation.broken", "on", {"last_triggered": "not a date"})
    await hass.async_block_till_done()

    assert collect_usage(hass).automations_fired == 0


async def test_scripts_are_counted_and_dated_from_last_triggered(
    hass: HomeAssistant,
) -> None:
    """Scripts carry the same attribute automations do."""
    now = dt_util.utcnow()
    hass.states.async_set(
        "script.bedtime", "off", {"last_triggered": now - timedelta(days=2)}
    )
    hass.states.async_set("script.never_used", "off", {"last_triggered": None})
    await hass.async_block_till_done()

    signals = collect_usage(hass)

    assert signals.scripts_defined == 2
    assert signals.scripts_run == 1


async def test_scenes_are_dated_from_their_state(hass: HomeAssistant) -> None:
    """A scene's state is the timestamp it was last activated, not on/off."""
    now = dt_util.utcnow()
    hass.states.async_set("scene.movie_night", (now - timedelta(days=3)).isoformat())
    hass.states.async_set("scene.stale", (now - timedelta(days=200)).isoformat())
    hass.states.async_set("scene.never_activated", "unknown")
    await hass.async_block_till_done()

    signals = collect_usage(hass)

    assert signals.scenes_defined == 3
    assert signals.scenes_activated == 1


async def test_helpers_are_counted_from_the_entity_registry(
    hass: HomeAssistant,
) -> None:
    """Registry, not states: a helper that is unavailable is still configured."""
    registry = er.async_get(hass)
    registry.async_get_or_create("input_boolean", "input_boolean", "guest_mode")
    registry.async_get_or_create("counter", "counter", "coffees")
    registry.async_get_or_create("schedule", "schedule", "heating")
    registry.async_get_or_create("light", "hue", "kitchen_ceiling")

    assert collect_usage(hass).helper_count == 3


async def test_template_entities_are_recognised(hass: HomeAssistant) -> None:
    """A template entity is someone doing more than wiring up a device."""
    er.async_get(hass).async_get_or_create("sensor", "template", "derived_comfort")

    assert "template_entities" in collect_usage(hass).advanced_features


async def test_the_stock_home_zone_is_not_evidence_of_anything(
    hass: HomeAssistant,
) -> None:
    """Every install has zone.home; it says nothing about the household."""
    hass.states.async_set("zone.home", "0")
    await hass.async_block_till_done()

    assert "zones" not in collect_usage(hass).advanced_features


async def test_zones_beyond_home_are_recognised(hass: HomeAssistant) -> None:
    """A work or school zone means presence is actually being used."""
    hass.states.async_set("zone.home", "0")
    hass.states.async_set("zone.work", "0")
    await hass.async_block_till_done()

    assert "zones" in collect_usage(hass).advanced_features


async def test_a_voice_assistant_is_recognised(hass: HomeAssistant) -> None:
    """Speech entities mean voice is configured, not merely available."""
    er.async_get(hass).async_get_or_create("stt", "wyoming", "whisper")

    assert "voice_assistant" in collect_usage(hass).advanced_features


async def test_a_plain_instance_reports_no_advanced_features(
    hass: HomeAssistant,
) -> None:
    """Absence is reported as an empty set, not a crash."""
    assert collect_usage(hass).advanced_features == frozenset()


async def test_config_entries_are_reduced_to_domain_groups(
    hass: HomeAssistant,
) -> None:
    """Two lighting brands are two entries but one kind of thing."""
    for domain in ("hue", "lifx", "nest"):
        MockConfigEntry(domain=domain).add_to_hass(hass)

    counts = collect_diversity(hass).group_counts

    assert counts["lighting"] == 2
    assert counts["climate"] == 1


async def test_haus_does_not_count_itself(hass: HomeAssistant) -> None:
    """Scoring your own presence as breadth would be absurd."""
    MockConfigEntry(domain=DOMAIN).add_to_hass(hass)

    assert collect_diversity(hass).group_counts == {}


async def test_ignored_entries_do_not_count(hass: HomeAssistant) -> None:
    """An ignored discovery is a thing the user said no to."""
    MockConfigEntry(domain="hue", source=SOURCE_IGNORE).add_to_hass(hass)

    assert collect_diversity(hass).group_counts == {}


async def test_disabled_entries_do_not_count(hass: HomeAssistant) -> None:
    """A disabled integration is not in use."""
    MockConfigEntry(domain="hue", disabled_by=ConfigEntryDisabler.USER).add_to_hass(
        hass
    )

    assert collect_diversity(hass).group_counts == {}


async def test_an_unrecognised_integration_lands_in_other(
    hass: HomeAssistant,
) -> None:
    """Custom integrations must not crash the mapping."""
    MockConfigEntry(domain="some_bespoke_thing").add_to_hass(hass)

    assert collect_diversity(hass).group_counts == {OTHER_GROUP: 1}


async def test_only_real_active_accounts_are_counted(hass: HomeAssistant) -> None:
    """System accounts and deactivated ones are not people who use the house."""
    baseline = (await collect_users(hass)).active_accounts
    MockUser(name="Alice").add_to_hass(hass)
    MockUser(name="Bob").add_to_hass(hass)
    MockUser(name="Supervisor", system_generated=True).add_to_hass(hass)
    MockUser(name="Former flatmate", is_active=False).add_to_hass(hass)

    signals = await collect_users(hass)

    assert signals.active_accounts == baseline + 2


async def test_mobile_app_registrations_are_counted(hass: HomeAssistant) -> None:
    """An account nobody can reach from their phone is barely an account."""
    MockConfigEntry(domain="mobile_app", title="Alice iPhone").add_to_hass(hass)
    MockConfigEntry(domain="mobile_app", title="Bob Pixel").add_to_hass(hass)
    MockConfigEntry(domain="hue").add_to_hass(hass)

    signals = await collect_users(hass)

    assert signals.mobile_app_devices == 2


async def test_an_entity_that_vanishes_mid_count_is_skipped(
    hass: HomeAssistant,
) -> None:
    """The id list and the state lookup are two reads, and can disagree.

    `async_entity_ids` returns a snapshot; by the time each state is fetched an
    entity may be gone. It is skipped rather than counted or crashed on, so a
    removal racing a refresh cannot take the usage pillar down with it.
    """
    hass.states.async_set("automation.rule", "on")

    with patch.object(type(hass.states), "get", return_value=None):
        signals = collect_usage(hass)

    # The id is still in the snapshot, so it is defined; it just never fired.
    assert signals.automations_defined == 1
    assert signals.automations_fired == 0
