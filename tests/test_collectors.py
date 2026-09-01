"""Tests for the collectors, the only code in HAUS that reads `hass`."""

from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.haus.collectors import collect_usage


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
