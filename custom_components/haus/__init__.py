"""The HAUS integration: a score for how much Home Assistant is being used."""

from homeassistant.const import (
    ATTR_DOMAIN,
    EVENT_CALL_SERVICE,
    EVENT_STATE_CHANGED,
    Platform,
)
from homeassistant.core import (
    Event,
    EventStateChangedData,
    HomeAssistant,
    callback,
)
from homeassistant.util import dt as dt_util

from .const import NOTIFY_DOMAIN
from .coordinator import HausConfigEntry, HausCoordinator
from .store import HausStore

PLATFORMS = [Platform.SENSOR]


async def async_setup_entry(hass: HomeAssistant, entry: HausConfigEntry) -> bool:
    """Set up HAUS from a config entry."""
    store = HausStore(hass)
    await store.async_load()

    @callback
    def _tally_notification(event: Event) -> None:
        """Count notify service calls as they happen.

        The recorder is the only other source for this, and querying it on the
        event loop is not an option, so HAUS keeps the count itself.
        """
        if event.data.get(ATTR_DOMAIN) == NOTIFY_DOMAIN:
            store.record_notification(dt_util.utcnow())

    @callback
    def _tally_action(event: Event[EventStateChangedData]) -> None:
        """Attribute a state change to the person who caused it.

        Only changes carrying a user in their context count: an automation
        firing is not a person operating the house. Per-user counts stay in the
        store and never reach a state attribute.
        """
        user_id = event.context.user_id
        if user_id:
            store.record_action(user_id, dt_util.utcnow())

    entry.async_on_unload(
        hass.bus.async_listen(EVENT_CALL_SERVICE, _tally_notification)
    )
    entry.async_on_unload(hass.bus.async_listen(EVENT_STATE_CHANGED, _tally_action))

    coordinator = HausCoordinator(hass, entry, store)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: HausConfigEntry) -> bool:
    """Unload a HAUS config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
