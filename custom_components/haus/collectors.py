"""Turn Home Assistant state into the plain dataclasses that scoring consumes.

This is the only module that needs `hass`, and so the only one that needs the
heavier test harness. Registry and state reads only: no recorder queries, and
nothing that blocks the event loop.
"""

from homeassistant.core import HomeAssistant

from .const import AUTOMATION_DOMAIN
from .scoring import UsageSignals


def collect_usage(hass: HomeAssistant) -> UsageSignals:
    """Collect the usage signals from the current instance state."""
    return UsageSignals(
        automations_defined=len(hass.states.async_entity_ids(AUTOMATION_DOMAIN)),
    )
