"""Tests for the HAUS score sensor and its coordinator wiring."""

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.haus.const import DOMAIN


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


async def test_score_is_zero_on_an_empty_instance(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Nothing configured scores nothing, rather than erroring."""
    await _setup(hass)

    assert hass.states.get("sensor.haus_score").state == "0"


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
