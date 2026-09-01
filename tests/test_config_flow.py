"""Tests for the HAUS config flow."""

from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.haus.const import DOMAIN


async def test_user_flow_creates_the_entry(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The happy path: a form, then an entry."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    await hass.async_block_till_done()

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "HAUS"


async def test_only_one_instance_can_be_configured(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """A second instance would double-count the same house."""
    MockConfigEntry(domain=DOMAIN, title="HAUS").add_to_hass(hass)

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"
