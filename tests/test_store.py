"""Tests for the rolling counters HAUS maintains itself."""

from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.haus.store import HausStore


async def test_recording_a_notification_counts_it(hass: HomeAssistant) -> None:
    """The tally exists because there is no recorder to ask."""
    store = HausStore(hass)
    await store.async_load()
    now = dt_util.utcnow()

    store.record_notification(now)
    store.record_notification(now)

    assert store.notifications_in_window(now) == 2


async def test_notifications_outside_the_window_are_dropped(
    hass: HomeAssistant,
) -> None:
    """It is a rolling window, not a lifetime total."""
    store = HausStore(hass)
    await store.async_load()
    now = dt_util.utcnow()

    store.record_notification(now - timedelta(days=90))
    store.record_notification(now)

    assert store.notifications_in_window(now) == 1


async def test_history_is_measured_from_when_haus_started_watching(
    hass: HomeAssistant,
) -> None:
    """Not from the first notification: a silent house still accrues history."""
    store = HausStore(hass)
    await store.async_load()
    now = dt_util.utcnow()

    assert store.history_days(now) == 0
    assert store.history_days(now + timedelta(days=9)) == 9


async def test_counters_survive_a_restart(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """The tally is worthless if it resets whenever Home Assistant does."""
    now = dt_util.utcnow()
    store = HausStore(hass)
    await store.async_load()
    store.record_notification(now)
    await store.async_save()

    reloaded = HausStore(hass)
    await reloaded.async_load()

    assert reloaded.notifications_in_window(now) == 1


async def test_history_survives_a_restart(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A restart must not reset the clock and send the metric back to neutral."""
    store = HausStore(hass)
    await store.async_load()
    await store.async_save()
    later = dt_util.utcnow() + timedelta(days=20)

    reloaded = HausStore(hass)
    await reloaded.async_load()

    assert reloaded.history_days(later) == 20


async def test_distinct_users_active_in_the_window_are_counted(
    hass: HomeAssistant,
) -> None:
    """The score is driven by how many people operate the house, not how much."""
    store = HausStore(hass)
    await store.async_load()
    now = dt_util.utcnow()

    store.record_action("alice", now)
    store.record_action("alice", now)
    store.record_action("bob", now)

    assert store.users_active_within(7, now) == 2


async def test_the_seven_and_thirty_day_windows_differ(
    hass: HomeAssistant,
) -> None:
    """Someone who acted last month is not operating the house this week."""
    store = HausStore(hass)
    await store.async_load()
    now = dt_util.utcnow()

    store.record_action("alice", now)
    store.record_action("bob", now - timedelta(days=20))

    assert store.users_active_within(7, now) == 1
    assert store.users_active_within(30, now) == 2


async def test_activity_older_than_the_window_is_pruned(
    hass: HomeAssistant,
) -> None:
    """The counters are rolling, so they cannot grow without bound."""
    store = HausStore(hass)
    await store.async_load()
    now = dt_util.utcnow()

    store.record_action("alice", now - timedelta(days=120))
    store.record_action("bob", now)

    assert store.users_active_within(30, now) == 1


async def test_activity_survives_a_restart(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Activity history is worthless if a restart clears it."""
    now = dt_util.utcnow()
    store = HausStore(hass)
    await store.async_load()
    store.record_action("alice", now)
    await store.async_save()

    reloaded = HausStore(hass)
    await reloaded.async_load()

    assert reloaded.users_active_within(7, now) == 1
