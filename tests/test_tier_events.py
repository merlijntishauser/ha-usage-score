"""Tests for the haus_tier_changed event.

The event is specified in the brief but was left until the score meant
something. What makes it awkward is not the comparison - it is knowing which
readings are trustworthy enough to compare.
"""

from homeassistant.core import CoreState, Event, HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.haus.const import DOMAIN, DOMAIN_GROUPS, EVENT_TIER_CHANGED


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Set up a HAUS entry and wait for it to settle."""
    entry = MockConfigEntry(domain=DOMAIN, title="HAUS")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _capture(hass: HomeAssistant) -> list[Event]:
    """Record every tier-changed event fired from now on."""
    events: list[Event] = []
    hass.bus.async_listen(EVENT_TIER_CHANGED, events.append)
    return events


# Enough of a house to cross two tier boundaries. Automations alone do not:
# sixty of them move the score from 8 to 27, because usage is 30% of it and
# diversity, at 25%, is still empty. Furnishing all three owned pillars gets
# a fresh instance from Starter to Enthusiast.
AUTOMATIONS = 60
ROUTINES = 30


def _furnish(hass: HomeAssistant) -> None:
    """Give the instance enough of everything to climb two tiers."""
    now = dt_util.utcnow().isoformat()
    for index in range(AUTOMATIONS):
        hass.states.async_set(f"automation.rule_{index}", "on", {"last_triggered": now})
    for index in range(ROUTINES):
        hass.states.async_set(f"script.s_{index}", "off", {"last_triggered": now})
        hass.states.async_set(f"scene.sc_{index}", now)

    seen: set[str] = set()
    for domain, group in DOMAIN_GROUPS.items():
        if group in seen:
            continue
        seen.add(group)
        MockConfigEntry(domain=domain, title=domain).add_to_hass(hass)


def _strip(hass: HomeAssistant) -> None:
    """Take it all away again."""
    for index in range(AUTOMATIONS):
        hass.states.async_remove(f"automation.rule_{index}")
    for index in range(ROUTINES):
        hass.states.async_remove(f"script.s_{index}")
        hass.states.async_remove(f"scene.sc_{index}")


async def test_no_event_on_the_first_reading(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A tier has not changed just because HAUS has started looking at it."""
    events = _capture(hass)

    await _setup(hass)

    assert events == []


async def test_no_event_while_home_assistant_is_still_starting(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Pre-start readings are wrong, and wrong readings must not be published.

    Entry setup runs before automation, script and scene have loaded, so the
    first collection sees an empty house. That is the same trap that made the
    first score after every restart badly wrong; here it would fire a tier
    drop followed by a tier climb, on every single restart.
    """
    hass.set_state(CoreState.starting)
    entry = await _setup(hass)
    events = _capture(hass)

    _furnish(hass)
    await entry.runtime_data.async_refresh()
    await hass.async_block_till_done()

    assert events == []


async def test_event_fires_once_the_tier_actually_moves(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The point of the whole thing."""
    entry = await _setup(hass)
    before = entry.runtime_data.data.tier
    events = _capture(hass)

    _furnish(hass)
    await entry.runtime_data.async_refresh()
    await hass.async_block_till_done()

    assert len(events) == 1
    data = events[0].data
    assert data["previous_tier"] == before
    assert data["tier"] == entry.runtime_data.data.tier
    assert data["tier"] != before
    assert data["score"] == entry.runtime_data.data.score
    assert data["direction"] == "up"


async def test_no_event_when_the_score_moves_but_the_tier_does_not(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A tier event that fires on every refresh is a notification nobody keeps."""
    entry = await _setup(hass)
    _furnish(hass)
    await entry.runtime_data.async_refresh()
    await hass.async_block_till_done()

    events = _capture(hass)
    hass.states.async_set("automation.one_more", "on")
    await entry.runtime_data.async_refresh()
    await hass.async_block_till_done()

    assert events == []


async def test_the_direction_says_which_way(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """ "You dropped a tier" and "you gained one" are different notifications."""
    entry = await _setup(hass)
    _furnish(hass)
    await entry.runtime_data.async_refresh()
    await hass.async_block_till_done()
    climbed = entry.runtime_data.data.tier

    events = _capture(hass)
    _strip(hass)
    await entry.runtime_data.async_refresh()
    await hass.async_block_till_done()

    assert len(events) == 1
    assert events[0].data["previous_tier"] == climbed
    assert events[0].data["direction"] == "down"
