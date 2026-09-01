"""Serve the bundled card and register it as a Lovelace resource.

HACS treats a repository as a single category, so the card ships inside the
integration and the integration registers it. Users install one thing.
"""

import logging
from typing import Any

from homeassistant.components.http.server import StaticPathConfig
from homeassistant.components.lovelace import LovelaceData
from homeassistant.components.lovelace.const import DOMAIN as LOVELACE_DOMAIN
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import CARD_FILENAME, DOMAIN, URL_BASE

_LOGGER = logging.getLogger(__name__)


def card_resource_url(hass: HomeAssistant) -> str:
    """Return the versioned resource url for the bundled card.

    The version query busts the browser cache when the card changes, and is
    what makes an existing resource identifiable as out of date rather than as
    a duplicate to be created again.
    """
    version = hass.data.get(f"{DOMAIN}_version", "0")
    return f"{URL_BASE}/{CARD_FILENAME}?v={version}"


async def async_register(hass: HomeAssistant) -> None:
    """Serve the card and make sure Lovelace knows about it.

    Called once when Home Assistant has started, not once per config entry:
    static paths and Lovelace resources are global.
    """
    integration = await async_get_integration(hass, DOMAIN)
    hass.data[f"{DOMAIN}_version"] = integration.version or "0"

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                URL_BASE,
                str(integration.file_path / "www" / CARD_FILENAME),
                False,
            )
        ]
    )

    await async_register_resource(hass)


async def async_register_resource(hass: HomeAssistant) -> None:
    """Create or update the Lovelace resource pointing at the card.

    Separate from serving the file: the static path can only be registered
    once per run, while the resource is safe to reconcile at any time.
    """
    lovelace: LovelaceData | None = hass.data.get(LOVELACE_DOMAIN)
    if lovelace is None:
        _LOGGER.debug("Lovelace is not set up; skipping resource registration")
        return

    url = card_resource_url(hass)
    resources = lovelace.resources

    # YAML-mode Lovelace hands back a read-only collection. Say what to paste
    # rather than failing setup over it.
    if not isinstance(resources, ResourceStorageCollection):
        _LOGGER.warning(
            "Lovelace is in YAML mode, so HAUS cannot register its card for you. "
            "Add this to the resources section of your dashboard configuration: "
            "{url: %s, type: module}",
            url,
        )
        return

    if not resources.loaded:
        await resources.async_load()
        resources.loaded = True

    existing: dict[str, Any] | None = None
    for item in resources.async_items():
        item_url = str(item.get("url", ""))
        if item_url.split("?")[0] == f"{URL_BASE}/{CARD_FILENAME}":
            existing = item
            break

    if existing is None:
        await resources.async_create_item({"res_type": "module", "url": url})
        _LOGGER.debug("Registered the HAUS card as a Lovelace resource")
        return

    if existing.get("url") != url:
        # Update rather than create, or every version would leave another
        # resource behind pointing at the same card.
        await resources.async_update_item(existing["id"], {"url": url})
        _LOGGER.debug("Updated the HAUS card Lovelace resource to %s", url)
