"""Tests for the diagnostics dump.

A diagnostics dump is a file people paste into GitHub issues. HAUS's whole
privacy position is that per-user activity never leaves the instance - counts
live in the Store, only aggregates reach the sensors, and a test walks every
entity to assert it. That guarantee is worth exactly nothing if the dump
carries what the entities refuse to.
"""

import json

from homeassistant.core import Context, HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry, MockUser
from pytest_homeassistant_custom_component.components.diagnostics import (
    get_diagnostics_for_config_entry,
)
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from custom_components.haus.const import DOMAIN

USER_ID = "alice-user-id-that-must-not-escape"


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Set up a HAUS entry alongside the diagnostics component."""
    assert await async_setup_component(hass, "diagnostics", {})
    entry = MockConfigEntry(domain=DOMAIN, title="HAUS")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _with_user_activity(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    """Give the store a per-user tally, which is the thing that must not leak."""
    hass.states.async_set("light.kitchen", "on", context=Context(user_id=USER_ID))
    await hass.async_block_till_done()
    await entry.runtime_data.async_refresh()


async def test_the_dump_carries_the_score_and_its_arithmetic(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    enable_custom_integrations: None,
) -> None:
    """Triage starts with the number and how it was reached."""
    entry = await _setup(hass)

    dump = await get_diagnostics_for_config_entry(hass, hass_client, entry)

    assert dump["score"]["score"] == entry.runtime_data.data.score
    assert dump["score"]["tier"] == entry.runtime_data.data.tier
    assert "pillars" in dump["score"]
    assert "effective_weights" in dump["score"]
    assert "contributions" in dump["score"]


async def test_the_dump_says_what_it_looked_for_and_whether_it_found_it(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    enable_custom_integrations: None,
) -> None:
    """The single most common misconfiguration, answerable at a glance.

    A wrong HAGHS entity id is indistinguishable from an absent HAGHS on the
    card, which is how a broken default went unnoticed for four milestones.
    The dump should not make anyone guess.
    """
    entry = await _setup(hass)

    dump = await get_diagnostics_for_config_entry(hass, hass_client, entry)

    assert dump["haghs"]["entity_id"] == "sensor.system_ha_global_health_score"
    assert dump["haghs"]["available"] is False
    assert dump["haghs"]["state"] is None


async def test_the_dump_reports_history_depth_as_counts(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    enable_custom_integrations: None,
) -> None:
    """How much history exists explains a neutral metric without exposing it."""
    entry = await _setup(hass)
    await _with_user_activity(hass, entry)

    dump = await get_diagnostics_for_config_entry(hass, hass_client, entry)

    store = dump["store"]
    assert isinstance(store["history_days"], int)
    assert isinstance(store["score_snapshots"], int)
    assert store["users_tallied"] == 1


async def test_the_dump_never_carries_a_user_id(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    enable_custom_integrations: None,
) -> None:
    """The guarantee the entities already make, made again where it is easiest to break.

    Asserted over the whole serialised dump rather than over the keys anyone
    remembered to check, so a future field cannot quietly reintroduce it.
    """
    entry = await _setup(hass)
    await _with_user_activity(hass, entry)

    dump = await get_diagnostics_for_config_entry(hass, hass_client, entry)

    assert USER_ID not in json.dumps(dump, default=str)


async def test_the_dump_carries_no_user_id_even_with_the_detail_option_on(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    enable_custom_integrations: None,
) -> None:
    """The opt-in unlocks an admin websocket command, not a file on disk.

    Someone reading the option name could reasonably conclude it loosens the
    dump too. It does not, and this pins that.
    """
    assert await async_setup_component(hass, "diagnostics", {})
    entry = MockConfigEntry(
        domain=DOMAIN, title="HAUS", options={"expose_per_user_detail": True}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await _with_user_activity(hass, entry)

    dump = await get_diagnostics_for_config_entry(hass, hass_client, entry)

    assert USER_ID not in json.dumps(dump, default=str)


async def test_the_dump_carries_the_bundled_community_figures(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    enable_custom_integrations: None,
    hass_admin_user: MockUser,
) -> None:
    """Stale bundled averages are invisible without their date."""
    entry = await _setup(hass)

    dump = await get_diagnostics_for_config_entry(hass, hass_client, entry)

    assert dump["community"]["as_of"]
    assert dump["community"]["automations"]
