import { describe, expect, it, vi } from "vitest";

import "./haus-breakdown-card";
import type { HausBreakdownCard } from "./haus-breakdown-card";
import type { HomeAssistant } from "./types";

function entity(entity_id: string, state: string, attributes: object) {
  return { entity_id, state, attributes: attributes as Record<string, unknown> };
}

function makeHass(degraded = false): HomeAssistant {
  const pillars = degraded
    ? { hygiene: null, usage: 70, diversity: 61, users: 66 }
    : { hygiene: 84, usage: 70, diversity: 61, users: 66 };
  const weights = degraded
    ? { usage: 0.4286, diversity: 0.3571, users: 0.2143 }
    : { hygiene: 0.3, usage: 0.3, diversity: 0.25, users: 0.15 };
  return {
    states: {
      "sensor.haus_score": entity("sensor.haus_score", degraded ? "66" : "71", {
        tier: "Enthusiast",
        haghs_available: !degraded,
        pillars,
        effective_weights: weights,
        contributions: {},
      }),
      "sensor.haus_usage": entity("sensor.haus_usage", "70", {
        automations_defined: 61,
        automations_fired: 34,
        scripts_and_scenes_defined: 178,
        scripts_and_scenes_used: 13,
        helper_count: 40,
        notification_count: 88,
        notification_history_days: 3,
        window_days: 30,
        metrics: {
          fire_rate: 55.5,
          automation_count: 88,
          scripts_scenes: 40,
          helpers: 90,
          notifications: 50,
          advanced: 66.7,
        },
      }),
      "sensor.haus_diversity": entity("sensor.haus_diversity", "61", {
        target_groups: 20,
        groups_covered: ["lighting", "climate"],
        groups_missing: ["vacuum", "lock", "printer"],
        evenness: 0.96,
      }),
      "sensor.haus_users": entity("sensor.haus_users", "66", {
        active_accounts: 4,
        mobile_app_devices: 3,
        users_active_7d: 2,
        users_active_30d: 3,
        activity_history_days: 9,
        metrics: {
          accounts: 86.5,
          mobile_apps: 100,
          activity_7d: 50,
          activity_30d: 50,
        },
      }),
    },
  };
}

async function render(hass: HomeAssistant): Promise<HausBreakdownCard> {
  const card = document.createElement(
    "haus-breakdown-card",
  ) as unknown as HausBreakdownCard;
  card.setConfig({ type: "custom:haus-breakdown-card" });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

const text = (card: HausBreakdownCard): string =>
  card.shadowRoot?.textContent ?? "";

describe("haus-breakdown-card", () => {
  it("is registered", () => {
    expect(customElements.get("haus-breakdown-card")).toBeTruthy();
  });

  it("prints the arithmetic that produced the score", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("71 = ⌊.30·84 + .30·70 + .25·61 + .15·66⌋");
  });

  it("prints the renormalised arithmetic when hygiene is absent", async () => {
    const card = await render(makeHass(true));

    expect(text(card)).toContain("66 = ⌊.43·70 + .36·61 + .21·66⌋");
  });

  it("shows the raw signals behind the usage pillar", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("Fire rate");
    expect(text(card)).toContain("Notifications");
  });

  it("shows the raw signals behind the users pillar", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("Accounts");
    expect(text(card)).toContain("Mobile apps");
  });

  it("shows how many groups diversity covers and misses", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("2 of 5");
    expect(text(card)).toContain("0.96");
  });

  it("re-renders when a pillar entity changes, not just the score", async () => {
    const hass = makeHass();
    const card = await render(hass);
    const spy = vi.spyOn(card, "requestUpdate");

    const next = makeHass();
    next.states["sensor.haus_score"] = hass.states["sensor.haus_score"];
    card.hass = next;

    expect(spy).toHaveBeenCalled();
  });

  it("does not re-render when nothing it reads has changed", async () => {
    const hass = makeHass();
    const card = await render(hass);
    const spy = vi.spyOn(card, "requestUpdate");

    card.hass = { states: { ...hass.states } };

    expect(spy).not.toHaveBeenCalled();
  });

  it("renders without the pillar sensors rather than throwing", async () => {
    const hass = makeHass();
    delete hass.states["sensor.haus_usage"];
    delete hass.states["sensor.haus_diversity"];

    const card = await render(hass);

    expect(text(card)).toContain("71 =");
  });

  it("explains itself when the score entity is missing", async () => {
    const card = await render({ states: {} });

    expect(text(card)).toContain("sensor.haus_score");
  });

  it("reports a card size and a stub config", async () => {
    const card = await render(makeHass());
    const ctor = customElements.get(
      "haus-breakdown-card",
    ) as typeof HausBreakdownCard;

    expect(typeof card.getCardSize()).toBe("number");
    expect(ctor.getStubConfig().type).toContain("haus-breakdown-card");
  });
});

describe("reading the numbers", () => {
  it("says the signals are scored, not counted", async () => {
    const card = await render(makeHass());

    expect(text(card)).toMatch(/scored 0-100/i);
  });
});

describe("card title", () => {
  it("names itself", async () => {
    const card = await render(makeHass());

    expect(card.shadowRoot?.querySelector(".card-header")?.textContent).toContain(
      "Score breakdown",
    );
  });
});

describe("help pills", () => {
  it("offers a help pill on every signal", async () => {
    const card = await render(makeHass());

    const signals = card.shadowRoot?.querySelectorAll(".signal") ?? [];
    const pills = card.shadowRoot?.querySelectorAll(".signal .help") ?? [];

    // Every measured signal is explainable; prose rows are `.note-row`.
    expect(pills.length).toBe(signals.length);
    expect(pills.length).toBeGreaterThan(5);
  });

  it("labels each pill for a screen reader", async () => {
    const card = await render(makeHass());

    const pill = card.shadowRoot?.querySelector(".help");

    expect(pill?.getAttribute("aria-label")).toMatch(/how .* is calculated/i);
    expect(pill?.getAttribute("aria-expanded")).toBe("false");
  });

  it("reveals the explanation when the pill is pressed", async () => {
    const card = await render(makeHass());

    expect(card.shadowRoot?.querySelector(".explanation")).toBeNull();
    card.shadowRoot?.querySelector<HTMLElement>(".help")?.click();
    await card.updateComplete;

    expect(card.shadowRoot?.querySelector(".explanation")).toBeTruthy();
  });

  it("hides it again when pressed a second time", async () => {
    const card = await render(makeHass());
    const pill = card.shadowRoot?.querySelector<HTMLElement>(".help");

    pill?.click();
    await card.updateComplete;
    card.shadowRoot?.querySelector<HTMLElement>(".help")?.click();
    await card.updateComplete;

    expect(card.shadowRoot?.querySelector(".explanation")).toBeNull();
  });

  it("quotes the window the integration published", async () => {
    const card = await render(makeHass());

    card.shadowRoot
      ?.querySelector<HTMLElement>('[aria-label="How Fire rate is calculated"]')
      ?.click();
    await card.updateComplete;

    expect(card.shadowRoot?.querySelector(".explanation")?.textContent).toContain(
      "30 days",
    );
  });

  it("explains the pillars too, not only their signals", async () => {
    const card = await render(makeHass());

    expect(
      card.shadowRoot?.querySelectorAll(".pillar header .help").length,
    ).toBe(4);
  });
});

describe("counts alongside scores", () => {
  it("shows how many automations there are, not just their score", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("34 of 61 fired");
  });

  it("shows the household counts too", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("4 accounts");
  });
});
