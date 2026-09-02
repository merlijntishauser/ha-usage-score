"""Tests for the hygiene pillar, which HAUS consumes rather than recomputes.

HAUS never counts zombie entities, measures the database or checks backups.
That is HAGHS's job and it is settled. What matters here is detecting HAGHS
honestly, and treating its absence as absence rather than as a zero.
"""

import pytest
from homeassistant.config_entries import (
    SIGNAL_CONFIG_ENTRY_CHANGED,
    ConfigEntryChange,
    ConfigEntryState,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.util import slugify
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.haus.collectors import collect_hygiene
from custom_components.haus.const import (
    CONF_HAGHS_ENTITY_ID,
    DEFAULT_HAGHS_ENTITY_ID,
    DOMAIN,
    HAGHS_DOMAIN,
)


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


async def _setup_haus(hass: HomeAssistant) -> MockConfigEntry:
    """Set up HAUS itself and wait for it to settle."""
    entry = MockConfigEntry(domain=DOMAIN, title="HAUS")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_the_score_carries_hygiene_when_haghs_is_present(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """All four pillars, with hygiene consumed from its owner."""
    _install_haghs(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "84")
    await _setup_haus(hass)

    attributes = hass.states.get("sensor.haus_score").attributes

    assert attributes["haghs_available"] is True
    assert attributes["pillars"]["hygiene"] == 84.0
    assert "hygiene" in attributes["effective_weights"]


async def test_the_weights_renormalise_when_haghs_is_absent(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Three pillars carrying the whole scale, not 70% of it."""
    await _setup_haus(hass)

    attributes = hass.states.get("sensor.haus_score").attributes

    assert attributes["haghs_available"] is False
    assert attributes["pillars"]["hygiene"] is None
    assert "hygiene" not in attributes["effective_weights"]
    assert sum(attributes["effective_weights"].values()) == pytest.approx(1.0)


async def test_an_unavailable_dependency_scores_better_than_a_zero_one(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Absent is not zero. A restarting HAGHS must not tank the score."""
    _install_haghs(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "0")
    entry = await _setup_haus(hass)
    scored_zero = int(hass.states.get("sensor.haus_score").state)

    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "unavailable")
    await entry.runtime_data.async_refresh()
    await hass.async_block_till_done()

    assert int(hass.states.get("sensor.haus_score").state) > scored_zero


async def test_installing_haghs_later_makes_the_pillar_appear(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Without touching HAUS's own configuration."""
    await _setup_haus(hass)
    assert hass.states.get("sensor.haus_score").attributes["haghs_available"] is False

    haghs = _install_haghs(hass)
    hass.states.async_set(DEFAULT_HAGHS_ENTITY_ID, "84")
    async_dispatcher_send(
        hass, SIGNAL_CONFIG_ENTRY_CHANGED, ConfigEntryChange.ADDED, haghs
    )
    await hass.async_block_till_done()

    assert hass.states.get("sensor.haus_score").attributes["haghs_available"] is True


async def test_a_renamed_haghs_entity_is_honoured_end_to_end(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The option is the whole reason it is an option."""
    _install_haghs(hass)
    hass.states.async_set("sensor.house_health", "66")
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="HAUS",
        options={CONF_HAGHS_ENTITY_ID: "sensor.house_health"},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    attributes = hass.states.get("sensor.haus_score").attributes

    assert attributes["haghs_available"] is True
    assert attributes["pillars"]["hygiene"] == 66.0


def test_the_default_entity_id_matches_a_stock_haghs_install() -> None:
    """The default has to be the entity id HAGHS actually creates.

    HAGHS has no `has_entity_name`; it sets `_attr_name` to its own
    DEFAULT_NAME, "System: HA - Global Health Score", and Home Assistant
    slugifies that into the entity id. Deriving it here rather than pasting
    the answer means the reasoning survives.

    This was wrong for every release up to 0.4.1 - the default read
    `sensor.haghs_global_score`, which HAGHS has never created. Nothing
    failed: a default pointing at a missing entity is indistinguishable from
    HAGHS not being installed, so the pillar was dropped and the remaining
    three renormalised, exactly as designed. Absent-is-never-zero made the
    bug invisible rather than loud.
    """
    haghs_default_name = "System: HA - Global Health Score"

    assert f"sensor.{slugify(haghs_default_name)}" == DEFAULT_HAGHS_ENTITY_ID
