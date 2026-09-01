"""Tests for the notify service-call tally.

There is no history for notifications without the recorder, so HAUS listens for
the service calls itself. These tests cover that listener, including its
removal.
"""

from homeassistant.const import ATTR_DOMAIN, ATTR_SERVICE, EVENT_CALL_SERVICE
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.haus.const import DOMAIN


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Set up a HAUS entry and wait for it to settle."""
    entry = MockConfigEntry(domain=DOMAIN, title="HAUS")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_notify_service_calls_are_tallied(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A notification sent is the signal; the service call is the evidence."""
    entry = await _setup(hass)
    store = entry.runtime_data.store

    hass.bus.async_fire(
        EVENT_CALL_SERVICE,
        {ATTR_DOMAIN: "notify", ATTR_SERVICE: "mobile_app_phone"},
    )
    await hass.async_block_till_done()

    assert store.notifications_in_window(dt_util.utcnow()) == 1


async def test_other_service_calls_are_ignored(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Turning on a light is not a notification."""
    entry = await _setup(hass)
    store = entry.runtime_data.store

    hass.bus.async_fire(
        EVENT_CALL_SERVICE, {ATTR_DOMAIN: "light", ATTR_SERVICE: "turn_on"}
    )
    await hass.async_block_till_done()

    assert store.notifications_in_window(dt_util.utcnow()) == 0


async def test_the_listener_is_removed_when_the_entry_unloads(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """An unloaded integration must stop counting."""
    entry = await _setup(hass)
    store = entry.runtime_data.store

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    hass.bus.async_fire(
        EVENT_CALL_SERVICE,
        {ATTR_DOMAIN: "notify", ATTR_SERVICE: "mobile_app_phone"},
    )
    await hass.async_block_till_done()

    assert store.notifications_in_window(dt_util.utcnow()) == 0
