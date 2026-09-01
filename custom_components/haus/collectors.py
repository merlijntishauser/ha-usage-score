"""Turn Home Assistant state into the plain dataclasses that scoring consumes.

This is the only module that needs `hass`, and so the only one that needs the
heavier test harness. Registry and state reads only: no recorder queries, and
nothing that blocks the event loop.
"""

from datetime import datetime, timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_LAST_TRIGGERED,
    AUTOMATION_DOMAIN,
    HELPER_DOMAINS,
    SCENE_DOMAIN,
    SCRIPT_DOMAIN,
    USAGE_WINDOW_DAYS,
)
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


def _count_recent(
    hass: HomeAssistant,
    domain: str,
    cutoff: datetime,
    *,
    from_state: bool = False,
) -> tuple[int, int]:
    """Return (defined, used-in-window) for one entity domain.

    Automations and scripts date themselves with a `last_triggered` attribute.
    A scene has no such attribute: its state *is* the timestamp it was last
    activated, so `from_state` reads it from there instead.
    """
    entity_ids = hass.states.async_entity_ids(domain)
    used = 0
    for entity_id in entity_ids:
        state = hass.states.get(entity_id)
        if state is None:
            continue
        raw = state.state if from_state else state.attributes.get(ATTR_LAST_TRIGGERED)
        last_used = _as_datetime(raw)
        if last_used is not None and last_used >= cutoff:
            used += 1
    return len(entity_ids), used


def _count_helpers(hass: HomeAssistant) -> int:
    """Count configured helpers from the entity registry."""
    registry = er.async_get(hass)
    return sum(
        1 for entry in registry.entities.values() if entry.domain in HELPER_DOMAINS
    )


def collect_usage(hass: HomeAssistant) -> UsageSignals:
    """Collect the usage signals from the current instance state."""
    cutoff = dt_util.utcnow() - timedelta(days=USAGE_WINDOW_DAYS)
    automations_defined, automations_fired = _count_recent(
        hass, AUTOMATION_DOMAIN, cutoff
    )
    scripts_defined, scripts_run = _count_recent(hass, SCRIPT_DOMAIN, cutoff)
    scenes_defined, scenes_activated = _count_recent(
        hass, SCENE_DOMAIN, cutoff, from_state=True
    )

    return UsageSignals(
        automations_defined=automations_defined,
        automations_fired=automations_fired,
        scripts_defined=scripts_defined,
        scripts_run=scripts_run,
        scenes_defined=scenes_defined,
        scenes_activated=scenes_activated,
        helper_count=_count_helpers(hass),
    )
