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

from .const import (
    COMMUNITY_AS_OF,
    COMMUNITY_AVG_AUTOMATIONS,
    COMMUNITY_AVG_USERS,
    COMMUNITY_REPORTING_INSTALLS,
    COMMUNITY_SOURCE_URL,
    DOMAIN,
    INTEGRATION_TITLE,
    SCORE_HISTORY_WEEKS,
)
from .coordinator import HausConfigEntry, HausCoordinator
from .scoring import pillar_values

# Every sensor here reads a value the coordinator has already fetched; there is
# no device to overwhelm and nothing to serialise, so no limit is needed. The
# quality scale asks for this to be stated rather than left to the default.
PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant,
    entry: HausConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the HAUS sensors."""
    coordinator = entry.runtime_data
    async_add_entities(
        [
            HausScoreSensor(coordinator, entry),
            HausPillarSensor(coordinator, entry, pillar="usage", name="Usage"),
            HausPillarSensor(coordinator, entry, pillar="diversity", name="Diversity"),
            HausPillarSensor(coordinator, entry, pillar="users", name="Users"),
        ]
    )


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
            "score_history": self.coordinator.store.score_history(SCORE_HISTORY_WEEKS),
            # Published so the breakdown card can quote them rather than
            # hard-code them: these move when a release refreshes them.
            "community": {
                "automations": COMMUNITY_AVG_AUTOMATIONS,
                "users": COMMUNITY_AVG_USERS,
                "as_of": COMMUNITY_AS_OF,
                "reporting_installs": COMMUNITY_REPORTING_INSTALLS,
                "source": COMMUNITY_SOURCE_URL,
            },
        }


class HausPillarSensor(CoordinatorEntity[HausCoordinator], SensorEntity):
    """One owned pillar, published so it can be graphed in its own right."""

    _attr_has_entity_name = True
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 1

    def __init__(
        self,
        coordinator: HausCoordinator,
        entry: HausConfigEntry,
        *,
        pillar: str,
        name: str,
    ) -> None:
        """Initialise a pillar sensor."""
        super().__init__(coordinator)
        self._pillar = pillar
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{pillar}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=INTEGRATION_TITLE,
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def native_value(self) -> float | None:
        """Return this pillar's score."""
        return pillar_values(self.coordinator.data.pillars).get(self._pillar)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the metrics and facts that make up this pillar."""
        result = self.coordinator.data
        attributes: dict[str, Any] = dict(result.details.get(self._pillar, {}))
        metrics = result.metrics.get(self._pillar)
        if metrics:
            attributes["metrics"] = metrics
        return attributes
