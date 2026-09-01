"""Tests for the collectors, the only code in HAUS that reads `hass`."""

from homeassistant.core import HomeAssistant

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
