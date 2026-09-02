import { describe, expect, it, vi } from "vitest";

import "./haus-household-card";
import type { HausHouseholdCard } from "./haus-household-card";
import type { HomeAssistant } from "./types";

function makeHass(callWS?: HomeAssistant["callWS"]): HomeAssistant {
  return {
    states: {
      "sensor.haus_score": {
        entity_id: "sensor.haus_score",
        state: "71",
        attributes: {},
      },
      "sensor.haus_users": {
        entity_id: "sensor.haus_users",
        state: "66",
        attributes: {
          metrics: {
            accounts: 86.5,
            mobile_apps: 100,
            activity_7d: 50,
            activity_30d: 50,
          },
          active_accounts: 4,
          mobile_app_devices: 3,
          users_active_7d: 2,
          users_active_30d: 3,
          activity_history_days: 9,
        },
      },
    },
    ...(callWS ? { callWS } : {}),
  };
}

async function render(hass: HomeAssistant): Promise<HausHouseholdCard> {
  const card = document.createElement(
    "haus-household-card",
  ) as unknown as HausHouseholdCard;
  card.setConfig({ type: "custom:haus-household-card" });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  await Promise.resolve();
  await card.updateComplete;
  return card;
}

const text = (c: HausHouseholdCard): string => c.shadowRoot?.textContent ?? "";

describe("haus-household-card", () => {
  it("is registered", () => {
    expect(customElements.get("haus-household-card")).toBeTruthy();
  });

  it("shows the aggregate household signals", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("Accounts");
    expect(text(card)).toContain("Mobile apps");
  });

  it("asks for per-user detail over the websocket command", async () => {
    const callWS = vi.fn().mockResolvedValue({ users: [] });

    await render(makeHass(callWS as HomeAssistant["callWS"]));

    expect(callWS).toHaveBeenCalledWith({ type: "haus/user_activity" });
  });

  it("lists each account when per-user detail is switched on", async () => {
    const callWS = vi.fn().mockResolvedValue({
      users: [
        {
          user_id: "a",
          name: "Alice",
          actions_7d: 12,
          actions_30d: 40,
          last_active: "2026-09-01",
        },
      ],
    });

    const card = await render(makeHass(callWS as HomeAssistant["callWS"]));

    expect(text(card)).toContain("Alice");
    expect(text(card)).toContain("40");
    expect(text(card)).toContain("2026-09-01");
  });

  it("says per-user detail is off rather than showing an empty list", async () => {
    const callWS = vi
      .fn()
      .mockRejectedValue({ code: "not_allowed", message: "off" });

    const card = await render(makeHass(callWS as HomeAssistant["callWS"]));

    expect(text(card)).toMatch(/off by default|turned off/i);
    expect(card.shadowRoot?.querySelectorAll(".user-row")).toHaveLength(0);
  });

  it("does not claim detail is off when the user is simply not an admin", async () => {
    const callWS = vi
      .fn()
      .mockRejectedValue({ code: "unauthorized", message: "nope" });

    const card = await render(makeHass(callWS as HomeAssistant["callWS"]));

    expect(text(card)).toMatch(/administrator/i);
  });

  it("renders without a websocket at all", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("Accounts");
  });

  it("explains itself when the users sensor is missing", async () => {
    const card = await render({ states: {} });

    expect(text(card)).toContain("sensor.haus_users");
  });
});

describe("counts versus scores", () => {
  it("prints the household counts, not the metric scores", async () => {
    const card = await render(makeHass());

    const numbers = Array.from(
      card.shadowRoot?.querySelectorAll(".metric .num") ?? [],
    ).map((el) => el.textContent?.trim());

    expect(numbers).toEqual(["4", "3", "2", "3"]);
  });

  it("lets the metric score drive the bar, not the count", async () => {
    const card = await render(makeHass());

    const widths = Array.from(
      card.shadowRoot?.querySelectorAll<HTMLElement>(".metric .bar span") ?? [],
    ).map((el) => Number.parseFloat(el.style.width));

    expect(widths[0]).toBeCloseTo(86.5, 1);
    expect(widths[1]).toBeCloseTo(100, 1);
  });

  it("says how long it has been watching while the tally is young", async () => {
    const card = await render(makeHass());

    expect(text(card)).toMatch(/9 days/);
  });

  it("stops explaining itself once both windows are covered", async () => {
    const hass = makeHass();
    (
      hass.states["sensor.haus_users"]!.attributes as Record<string, unknown>
    )["activity_history_days"] = 40;

    const card = await render(hass);

    expect(text(card)).not.toMatch(/days/);
  });
});
