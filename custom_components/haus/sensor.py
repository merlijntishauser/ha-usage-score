"""Sensor entities for HAUS."""

from typing import Any

from homeassistant.components.sensor import (
    SensorEntity,
    SensorStateClass,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, INTEGRATION_TITLE
from .coordinator import HausConfigEntry, HausCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: HausConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the HAUS sensors."""
    async_add_entities([HausScoreSensor(entry.runtime_data, entry)])


class HausScoreSensor(CoordinatorEntity[HausCoordinator], SensorEntity):
    """The headline HAUS score, 0-100."""

    _attr_has_entity_name = True
    _attr_name = "Score"
    _attr_icon = "mdi:home-analytics"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: HausCoordinator, entry: HausConfigEntry) -> None:
        """Initialise the score sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_score"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=INTEGRATION_TITLE,
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def native_value(self) -> int:
        """Return the current score."""
        return self.coordinator.data.score

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the breakdown behind the score."""
        result = self.coordinator.data
        return {
            "tier": result.tier,
            "haghs_available": result.haghs_available,
            "pillars": {
                "hygiene": result.pillars.hygiene,
                "usage": result.pillars.usage,
                "diversity": result.pillars.diversity,
                "users": result.pillars.users,
            },
            "effective_weights": result.effective_weights,
            "contributions": result.contributions,
        }
