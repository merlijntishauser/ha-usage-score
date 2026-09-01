"""Tests for the event tallies HAUS keeps itself.

There is no history for notifications sent, or for who did what, without the
recorder. So HAUS listens for the events itself. These tests cover both
listeners, including their removal on unload.
"""

from homeassistant.const import ATTR_DOMAIN, ATTR_SERVICE, EVENT_CALL_SERVICE
from homeassistant.core import Context, HomeAssistant
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


async def test_user_driven_state_changes_are_attributed_to_that_user(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Someone touching a light is someone operating the house."""
    entry = await _setup(hass)
    store = entry.runtime_data.store

    hass.states.async_set("light.kitchen", "on", context=Context(user_id="alice"))
    await hass.async_block_till_done()

    assert store.users_active_within(7, dt_util.utcnow()) == 1


async def test_changes_with_no_user_behind_them_are_not_activity(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """An automation firing is not a person operating the house."""
    entry = await _setup(hass)
    store = entry.runtime_data.store

    hass.states.async_set("light.kitchen", "on")
    await hass.async_block_till_done()

    assert store.users_active_within(7, dt_util.utcnow()) == 0


async def test_distinct_users_are_counted_once_each(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The pillar counts people, not button presses."""
    entry = await _setup(hass)
    store = entry.runtime_data.store

    for _ in range(5):
        hass.states.async_set(
            "light.kitchen", "on", context=Context(user_id="alice"), force_update=True
        )
    hass.states.async_set("light.hall", "on", context=Context(user_id="bob"))
    await hass.async_block_till_done()

    assert store.users_active_within(7, dt_util.utcnow()) == 2


async def test_the_activity_listener_is_removed_when_the_entry_unloads(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """An unloaded integration must stop watching what people do."""
    entry = await _setup(hass)
    store = entry.runtime_data.store

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    hass.states.async_set("light.kitchen", "on", context=Context(user_id="alice"))
    await hass.async_block_till_done()

    assert store.users_active_within(7, dt_util.utcnow()) == 0
