"""Turn Home Assistant state into the plain dataclasses that scoring consumes.

This is the only module that needs `hass`, and so the only one that needs the
heavier test harness. Registry and state reads only: no recorder queries, and
nothing that blocks the event loop.
"""

from datetime import datetime, timedelta

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import ATTR_LAST_TRIGGERED, AUTOMATION_DOMAIN, USAGE_WINDOW_DAYS
from .scoring import UsageSignals


def _as_datetime(value: object) -> datetime | None:
    """Coerce a `last_triggered` attribute to an aware datetime, or None.

    Live states carry a datetime; states restored from the database carry an
    ISO string. Anything else - missing, null, malformed - means "never fired",
    which must not take the whole collection down.
    """
    if isinstance(value, datetime):
        return dt_util.as_utc(value)
    if isinstance(value, str):
        parsed = dt_util.parse_datetime(value)
        return dt_util.as_utc(parsed) if parsed else None
    return None


def collect_usage(hass: HomeAssistant) -> UsageSignals:
    """Collect the usage signals from the current instance state."""
    cutoff = dt_util.utcnow() - timedelta(days=USAGE_WINDOW_DAYS)
    entity_ids = hass.states.async_entity_ids(AUTOMATION_DOMAIN)

    fired = 0
    for entity_id in entity_ids:
        state = hass.states.get(entity_id)
        if state is None:
            continue
        last_triggered = _as_datetime(state.attributes.get(ATTR_LAST_TRIGGERED))
        if last_triggered is not None and last_triggered >= cutoff:
            fired += 1

    return UsageSignals(
        automations_defined=len(entity_ids),
        automations_fired=fired,
    )
