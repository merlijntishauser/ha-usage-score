"""Tests for serving the card and registering it as a Lovelace resource.

The card ships inside the integration rather than as a separate HACS plugin, so
users install one thing. That means HAUS serves the file and registers the
resource itself.
"""

import logging
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.components.lovelace import LovelaceData
from homeassistant.components.lovelace.const import DOMAIN as LOVELACE_DOMAIN
from homeassistant.components.lovelace.const import MODE_STORAGE, MODE_YAML
from homeassistant.components.lovelace.resources import (
    ResourceStorageCollection,
    ResourceYAMLCollection,
)
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from custom_components.haus.const import CARD_FILENAME, DOMAIN, URL_BASE
from custom_components.haus.frontend import card_resource_url


def _lovelace(hass: HomeAssistant, mode: str) -> MagicMock:
    """Install a fake Lovelace with a resource collection.

    Specced to the real collection classes: storage mode hands back a writable
    collection, YAML mode a read-only one, and HAUS tells them apart by type
    rather than by trusting the mode string.
    """
    storage = mode == MODE_STORAGE
    resources = MagicMock(
        spec=ResourceStorageCollection if storage else ResourceYAMLCollection
    )
    resources.async_items = MagicMock(return_value=[])
    resources.loaded = True
    if storage:
        resources.async_create_item = AsyncMock()
        resources.async_update_item = AsyncMock()
        resources.async_load = AsyncMock()
    hass.data[LOVELACE_DOMAIN] = LovelaceData(
        resource_mode=mode,
        dashboards={},
        resources=resources,
        yaml_dashboards={},
    )
    return resources


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    """Set up HAUS and wait for it to settle."""
    entry = MockConfigEntry(domain=DOMAIN, title="HAUS")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_the_card_is_served_from_a_directory(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Home Assistant only mounts a static path that points at a directory.

    `_make_static_resources` checks `os.path.isdir` and registers nothing at
    all - silently - when the path is a file. Pointing this at the card file
    itself is why the card 404'd.
    """
    assert await async_setup_component(hass, "http", {})
    _lovelace(hass, MODE_STORAGE)

    with patch.object(
        hass.http, "async_register_static_paths", AsyncMock()
    ) as register:
        await _setup(hass)

    registered = register.call_args[0][0]
    assert [config.url_path for config in registered] == [URL_BASE]
    mounted = Path(registered[0].path)
    assert mounted.is_dir(), "a static path that is not a directory mounts nothing"
    assert (mounted / CARD_FILENAME).is_file()


async def test_the_resource_url_resolves_to_a_file_under_the_mounted_path(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The url handed to Lovelace must be reachable at the path that is served.

    Registering a resource and serving a directory are two halves of the same
    promise; testing them separately is how they came apart.
    """
    assert await async_setup_component(hass, "http", {})
    _lovelace(hass, MODE_STORAGE)

    with patch.object(
        hass.http, "async_register_static_paths", AsyncMock()
    ) as register:
        await _setup(hass)

    mounted = Path(register.call_args[0][0][0].path)
    served_path = card_resource_url(hass).split("?")[0]

    assert served_path.startswith(f"{URL_BASE}/")
    assert (mounted / served_path.removeprefix(f"{URL_BASE}/")).is_file()


async def test_the_resource_is_registered_once(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A versioned module resource, created when none exists yet."""
    resources = _lovelace(hass, MODE_STORAGE)

    await _setup(hass)

    resources.async_create_item.assert_awaited_once()
    created: dict[str, Any] = resources.async_create_item.await_args[0][0]
    assert created["res_type"] == "module"
    assert created["url"].startswith(f"{URL_BASE}/{CARD_FILENAME}?v=")


async def test_an_existing_resource_is_updated_rather_than_duplicated(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A new version must not leave two resources pointing at the same card."""
    resources = _lovelace(hass, MODE_STORAGE)
    resources.async_items.return_value = [
        {"id": "abc", "type": "module", "url": f"{URL_BASE}/{CARD_FILENAME}?v=0.0.1"}
    ]

    await _setup(hass)

    resources.async_create_item.assert_not_awaited()
    resources.async_update_item.assert_awaited_once()
    assert resources.async_update_item.await_args[0][0] == "abc"


async def test_an_up_to_date_resource_is_left_alone(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Rewriting an identical resource on every restart is pointless churn."""
    from custom_components.haus.frontend import async_register_resource

    resources = _lovelace(hass, MODE_STORAGE)
    await _setup(hass)
    created: dict[str, Any] = resources.async_create_item.await_args[0][0]

    resources.async_items.return_value = [{"id": "abc", **created}]
    resources.async_create_item.reset_mock()
    resources.async_update_item.reset_mock()
    await async_register_resource(hass)

    resources.async_create_item.assert_not_awaited()
    resources.async_update_item.assert_not_awaited()


async def test_yaml_mode_logs_the_line_to_add_instead_of_failing(
    hass: HomeAssistant,
    enable_custom_integrations: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """YAML-mode Lovelace cannot be written to, so say what to paste."""
    _lovelace(hass, MODE_YAML)

    with caplog.at_level(logging.WARNING):
        await _setup(hass)

    assert f"{URL_BASE}/{CARD_FILENAME}" in caplog.text
    assert "module" in caplog.text


async def test_setup_survives_lovelace_being_absent(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A stripped-down instance must still get its sensors."""
    hass.data.pop(LOVELACE_DOMAIN, None)

    await _setup(hass)

    assert hass.states.get("sensor.haus_score") is not None


async def test_the_card_is_actually_reachable_over_http(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    enable_custom_integrations: None,
) -> None:
    """The proof: fetch the url Lovelace was handed and get the card back.

    Every other test here checks how the route was *configured*. This one is
    the only thing that would have caught a static path that configures
    cleanly and serves nothing.
    """
    assert await async_setup_component(hass, "http", {})
    _lovelace(hass, MODE_STORAGE)
    await _setup(hass)

    client = await hass_client()
    response = await client.get(card_resource_url(hass))

    assert response.status == 200
    assert "customElements.define" in await response.text()


async def test_a_missing_card_file_is_reported_loudly(
    hass: HomeAssistant,
    enable_custom_integrations: None,
    caplog: pytest.LogCaptureFixture,
    tmp_path: Path,
) -> None:
    """A silent 404 is what made the last card bug hard to find.

    If the built artifact did not make it onto disk - a partial HACS download,
    a manual copy that missed www/ - say so, with the path, rather than
    registering a route that serves nothing.
    """
    assert await async_setup_component(hass, "http", {})
    _lovelace(hass, MODE_STORAGE)
    integration = MagicMock()
    integration.file_path = tmp_path
    integration.version = "0.1.0"

    with (
        patch(
            "custom_components.haus.frontend.async_get_integration",
            AsyncMock(return_value=integration),
        ),
        caplog.at_level(logging.ERROR),
    ):
        await _setup(hass)

    assert CARD_FILENAME in caplog.text
    assert str(tmp_path) in caplog.text


async def test_setup_still_succeeds_when_the_card_file_is_missing(
    hass: HomeAssistant, enable_custom_integrations: None, tmp_path: Path
) -> None:
    """The sensors are the point; a missing card must not take them down."""
    assert await async_setup_component(hass, "http", {})
    _lovelace(hass, MODE_STORAGE)
    integration = MagicMock()
    integration.file_path = tmp_path
    integration.version = "0.1.0"

    with patch(
        "custom_components.haus.frontend.async_get_integration",
        AsyncMock(return_value=integration),
    ):
        await _setup(hass)

    assert hass.states.get("sensor.haus_score") is not None


async def test_an_unloaded_resource_collection_is_loaded_before_it_is_read(
    hass: HomeAssistant,
) -> None:
    """Lovelace's resource collection is lazy, and reading it cold returns nothing.

    Without this, a first-ever setup on an instance whose resources have not
    been touched would see an empty collection, conclude no HAUS resource
    exists, and create a second one alongside the first on the next run.
    """
    from custom_components.haus.frontend import async_register_resource

    resources = _lovelace(hass, MODE_STORAGE)
    resources.loaded = False

    await async_register_resource(hass)

    resources.async_load.assert_awaited_once()
    assert resources.loaded is True
    resources.async_create_item.assert_awaited_once()
