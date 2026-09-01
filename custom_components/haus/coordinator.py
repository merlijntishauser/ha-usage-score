"""The HAUS update coordinator."""

import logging
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .collectors import collect_usage
from .const import DOMAIN, UPDATE_INTERVAL_MINUTES
from .scoring import PillarScores, ScoreResult, build_result, score_usage

_LOGGER = logging.getLogger(__name__)

type HausConfigEntry = ConfigEntry[HausCoordinator]


class HausCoordinator(DataUpdateCoordinator[ScoreResult]):
    """Collect the signals and hold the current score."""

    def __init__(self, hass: HomeAssistant, entry: HausConfigEntry) -> None:
        """Initialise the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=DOMAIN,
            update_interval=timedelta(minutes=UPDATE_INTERVAL_MINUTES),
        )

    async def _async_update_data(self) -> ScoreResult:
        """Collect every pillar and assemble the result.

        Hygiene stays None until M4 consumes HAGHS, which means the score is
        already exercising the renormalised path that an instance without HAGHS
        will use for good.
        """
        return build_result(
            PillarScores(
                hygiene=None,
                usage=score_usage(collect_usage(self.hass)),
                diversity=0.0,
                users=0.0,
            )
        )
