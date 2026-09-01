"""Tests for the HAUS config flow."""

from homeassistant.config_entries import SOURCE_USER, ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.haus.const import CONF_EXPOSE_PER_USER_DETAIL, DOMAIN


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


async def _setup_entry(hass: HomeAssistant) -> MockConfigEntry:
    """Set up a HAUS entry and wait for it to settle."""
    entry = MockConfigEntry(domain=DOMAIN, title="HAUS")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_per_user_detail_defaults_to_off(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """Privacy is opt-in, so accepting the form as presented exposes nothing."""
    entry = await _setup_entry(hass)

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM

    result = await hass.config_entries.options.async_configure(result["flow_id"], {})
    await hass.async_block_till_done()

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options[CONF_EXPOSE_PER_USER_DETAIL] is False


async def test_per_user_detail_can_be_opted_into(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """It is a choice the user makes deliberately, not a default."""
    entry = await _setup_entry(hass)

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_EXPOSE_PER_USER_DETAIL: True}
    )
    await hass.async_block_till_done()

    assert entry.options[CONF_EXPOSE_PER_USER_DETAIL] is True


async def test_changing_options_reloads_without_a_restart(
    hass: HomeAssistant, enable_custom_integrations: None
) -> None:
    """The definition of done says reload, not restart."""
    entry = await _setup_entry(hass)

    result = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_EXPOSE_PER_USER_DETAIL: True}
    )
    await hass.async_block_till_done()

    assert entry.state is ConfigEntryState.LOADED
    assert hass.states.get("sensor.haus_score") is not None
