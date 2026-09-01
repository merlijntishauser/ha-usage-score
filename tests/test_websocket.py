"""Tests for the admin-checked websocket command behind the household card.

Per-user activity is never a state attribute. An administrator can ask for it,
and only when the instance has opted in.
"""

from homeassistant.core import Context, HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.haus.const import CONF_EXPOSE_PER_USER_DETAIL, DOMAIN


async def _setup(hass: HomeAssistant, *, expose: bool) -> MockConfigEntry:
    """Set up a HAUS entry with per-user detail on or off."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="HAUS",
        options={CONF_EXPOSE_PER_USER_DETAIL: expose},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_an_admin_can_read_per_user_activity_when_opted_in(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    enable_custom_integrations: None,
) -> None:
    """The household card's data, served on request rather than published."""
    await _setup(hass, expose=True)
    hass.states.async_set("light.kitchen", "on", context=Context(user_id="alice"))
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "haus/user_activity"})
    response = await client.receive_json()

    assert response["success"]
    rows = {row["user_id"]: row for row in response["result"]["users"]}
    assert rows["alice"]["actions_7d"] == 1
    assert rows["alice"]["actions_30d"] == 1
    assert rows["alice"]["last_active"] == dt_util.utcnow().date().isoformat()


async def test_the_command_is_refused_when_the_option_is_off(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    enable_custom_integrations: None,
) -> None:
    """Opt-in means off is a refusal, not an empty list."""
    await _setup(hass, expose=False)
    hass.states.async_set("light.kitchen", "on", context=Context(user_id="alice"))
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "haus/user_activity"})
    response = await client.receive_json()

    assert not response["success"]
    assert response["error"]["code"] == "not_allowed"


async def test_a_non_admin_is_refused(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    enable_custom_integrations: None,
) -> None:
    """Admin rights are checked even when the instance has opted in."""
    await _setup(hass, expose=True)

    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json({"id": 1, "type": "haus/user_activity"})
    response = await client.receive_json()

    assert not response["success"]
    assert response["error"]["code"] == "unauthorized"


async def test_the_command_reports_when_the_entry_is_not_loaded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    enable_custom_integrations: None,
) -> None:
    """The command outlives the entry, so it must cope with none loaded.

    With no entry at all Home Assistant never loads the component and the
    command does not exist; the case worth guarding is a loaded component whose
    entry has been unloaded.
    """
    entry = await _setup(hass, expose=True)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "haus/user_activity"})
    response = await client.receive_json()

    assert not response["success"]
    assert response["error"]["code"] == "not_found"
