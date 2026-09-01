"""Tests for the hygiene pillar, which HAUS consumes rather than recomputes.

HAUS never counts zombie entities, measures the database or checks backups.
That is HAGHS's job and it is settled. What matters here is detecting HAGHS
honestly, and treating its absence as absence rather than as a zero.
"""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.haus.collectors import collect_hygiene
from custom_components.haus.const import DEFAULT_HAGHS_ENTITY_ID, HAGHS_DOMAIN


def _install_haghs(hass: HomeAssistant) -> MockConfigEntry:
    """Pretend HAGHS is installed and loaded."""
    entry = MockConfigEntry(domain=HAGHS_DOMAIN, state=ConfigEntryState.LOADED)
    entry.add_to_hass(hass)
    return entry


async def test_hygiene_is_read_when_haghs_is_installed(hass: HomeAssistant) -> None:
    """The happy path: consumed, not recomputed."""
    _install_haghs(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "84")

    assert collect_hygiene(hass, DEFAULT_HAGHS_ENTITY_ID) == 84.0


async def test_hygiene_is_absent_when_haghs_is_not_installed(
    hass: HomeAssistant,
) -> None:
    """No config entry means no dependency, whatever states happen to exist."""
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "84")

    assert collect_hygiene(hass, DEFAULT_HAGHS_ENTITY_ID) is None


async def test_an_unavailable_haghs_is_absent_and_not_zero(
    hass: HomeAssistant,
) -> None:
    """A dependency that briefly restarts must not tank the score."""
    _install_haghs(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "unavailable")

    assert collect_hygiene(hass, DEFAULT_HAGHS_ENTITY_ID) is None


async def test_an_unknown_haghs_is_absent_and_not_zero(hass: HomeAssistant) -> None:
    """Same for a sensor that has not produced a value yet."""
    _install_haghs(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "unknown")

    assert collect_hygiene(hass, DEFAULT_HAGHS_ENTITY_ID) is None


async def test_a_missing_entity_is_absent(hass: HomeAssistant) -> None:
    """Installed but not yet publishing is still nothing to read."""
    _install_haghs(hass)

    assert collect_hygiene(hass, DEFAULT_HAGHS_ENTITY_ID) is None


async def test_a_renamed_entity_is_read_from_the_configured_id(
    hass: HomeAssistant,
) -> None:
    """Users rename things, which is why the entity id is an option."""
    _install_haghs(hass)
    hass.states.async_set("sensor.house_health", "71")

    assert collect_hygiene(hass, "sensor.house_health") == 71.0


async def test_a_non_numeric_state_is_absent(hass: HomeAssistant) -> None:
    """Pointing the option at the wrong entity must not raise."""
    _install_haghs(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "excellent")

    assert collect_hygiene(hass, DEFAULT_HAGHS_ENTITY_ID) is None


async def test_an_out_of_range_score_is_clamped(hass: HomeAssistant) -> None:
    """HAUS owns its own scale even when a dependency does not."""
    _install_haghs(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "150")

    assert collect_hygiene(hass, DEFAULT_HAGHS_ENTITY_ID) == 100.0


async def test_a_disabled_haghs_entry_counts_as_absent(hass: HomeAssistant) -> None:
    """An entry that is not loaded is not a dependency in use."""
    MockConfigEntry(domain=HAGHS_DOMAIN).add_to_hass(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "84")

    assert collect_hygiene(hass, DEFAULT_HAGHS_ENTITY_ID) is None
