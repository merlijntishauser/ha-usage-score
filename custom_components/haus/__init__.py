"""The HAUS integration: a score for how much Home Assistant is being used."""

from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .coordinator import HausConfigEntry, HausCoordinator

PLATFORMS = [Platform.SENSOR]


async def async_setup_entry(hass: HomeAssistant, entry: HausConfigEntry) -> bool:
    """Set up HAUS from a config entry."""
    coordinator = HausCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: HausConfigEntry) -> bool:
    """Unload a HAUS config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
