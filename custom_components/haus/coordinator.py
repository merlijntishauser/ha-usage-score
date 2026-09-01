"""The HAUS update coordinator."""

import logging
from dataclasses import replace
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .collectors import collect_usage
from .const import DOMAIN, UPDATE_INTERVAL_MINUTES
from .scoring import PillarScores, ScoreResult, build_result, score_usage
from .store import HausStore

_LOGGER = logging.getLogger(__name__)

type HausConfigEntry = ConfigEntry[HausCoordinator]


class HausCoordinator(DataUpdateCoordinator[ScoreResult]):
    """Collect the signals and hold the current score."""

    def __init__(
        self, hass: HomeAssistant, entry: HausConfigEntry, store: HausStore
    ) -> None:
        """Initialise the coordinator."""
        self.store = store
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
        now = dt_util.utcnow()
        usage_signals = replace(
            collect_usage(self.hass),
            notification_count=self.store.notifications_in_window(now),
            notification_history_days=self.store.history_days(now),
        )
        return build_result(
            PillarScores(
                hygiene=None,
                usage=score_usage(usage_signals),
                diversity=0.0,
                users=0.0,
            )
        )
