"""Rolling counters that HAUS maintains for itself.

There is no history for "notifications sent" without the recorder, and querying
the recorder on the event loop is not an option. So HAUS tallies the events as
they happen and keeps a rolling window on disk.
"""

from datetime import date, datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    STORAGE_KEY,
    STORAGE_VERSION,
    STORE_SAVE_DELAY_SECONDS,
    USAGE_WINDOW_DAYS,
)


class HausStore:
    """Persisted counters behind the usage and users pillars."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialise the store without touching disk."""
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._notify_by_day: dict[str, int] = {}
        self._started: date | None = None

    async def async_load(self) -> None:
        """Load the counters, starting the history clock on first use.

        History is measured from when HAUS started watching rather than from the
        first notification, so a quiet house still accrues history and leaves
        the neutral start behind.
        """
        data = await self._store.async_load()
        if data:
            self._notify_by_day = {
                day: int(count)
                for day, count in dict(data.get("notify_by_day", {})).items()
            }
            started = data.get("started")
            self._started = date.fromisoformat(started) if started else None
        if self._started is None:
            self._started = dt_util.utcnow().date()

    def _as_dict(self) -> dict[str, Any]:
        """Return the JSON-serialisable form of the counters."""
        return {
            "started": self._started.isoformat() if self._started else None,
            "notify_by_day": self._notify_by_day,
        }

    async def async_save(self) -> None:
        """Write the counters out now."""
        await self._store.async_save(self._as_dict())

    def record_notification(self, when: datetime) -> None:
        """Tally one notification service call."""
        day = when.date().isoformat()
        self._notify_by_day[day] = self._notify_by_day.get(day, 0) + 1
        self._prune(when)
        self._store.async_delay_save(self._as_dict, STORE_SAVE_DELAY_SECONDS)

    def _prune(self, now: datetime) -> None:
        """Drop days that have fallen out of the rolling window."""
        cutoff = (now - timedelta(days=USAGE_WINDOW_DAYS)).date()
        self._notify_by_day = {
            day: count
            for day, count in self._notify_by_day.items()
            if date.fromisoformat(day) > cutoff
        }

    def notifications_in_window(self, now: datetime) -> int:
        """Return notifications sent inside the rolling window."""
        cutoff = (now - timedelta(days=USAGE_WINDOW_DAYS)).date()
        return sum(
            count
            for day, count in self._notify_by_day.items()
            if date.fromisoformat(day) > cutoff
        )

    def history_days(self, now: datetime) -> int:
        """Return how many days of tally history exist."""
        if self._started is None:
            return 0
        return max(0, (now.date() - self._started).days)
