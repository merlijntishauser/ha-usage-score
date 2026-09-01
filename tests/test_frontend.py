"""Tests for serving the card and registering it as a Lovelace resource.

The card ships inside the integration rather than as a separate HACS plugin, so
users install one thing. That means HAUS serves the file and registers the
resource itself.
"""

import logging
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

from custom_components.haus.const import CARD_FILENAME, DOMAIN, URL_BASE


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


async def test_the_card_is_served_from_the_integration(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """One install: HACS installs the integration, the integration serves it."""
    assert await async_setup_component(hass, "http", {})
    _lovelace(hass, MODE_STORAGE)

    with patch.object(
        hass.http, "async_register_static_paths", AsyncMock()
    ) as register:
        await _setup(hass)

    registered = register.call_args[0][0]
    assert [config.url_path for config in registered] == [URL_BASE]
    assert registered[0].path.endswith(f"www/{CARD_FILENAME}")


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
