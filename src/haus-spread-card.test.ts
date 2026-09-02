import { describe, expect, it } from "vitest";

import "./haus-spread-card";
import type { HausSpreadCard } from "./haus-spread-card";
import type { HomeAssistant } from "./types";

function makeHass(diversity?: Record<string, unknown>): HomeAssistant {
  const states: HomeAssistant["states"] = {
    "sensor.haus_score": {
      entity_id: "sensor.haus_score",
      state: "71",
      attributes: {},
    },
  };
  if (diversity) {
    states["sensor.haus_diversity"] = {
      entity_id: "sensor.haus_diversity",
      state: "61",
      attributes: diversity,
    };
  }
  return { states };
}

const FULL = {
  groups_covered: ["climate", "lighting", "media"],
  groups_missing: ["lock", "vacuum"],
  evenness: 0.96,
  group_counts: { lighting: 8, climate: 3, media: 1 },
};

async function render(hass: HomeAssistant): Promise<HausSpreadCard> {
  const card = document.createElement(
    "haus-spread-card",
  ) as unknown as HausSpreadCard;
  card.setConfig({ type: "custom:haus-spread-card" });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

const text = (c: HausSpreadCard): string => c.shadowRoot?.textContent ?? "";

describe("haus-spread-card", () => {
  it("is registered", () => {
    expect(customElements.get("haus-spread-card")).toBeTruthy();
  });

  it("shows how evenly the estate is spread", async () => {
    const card = await render(makeHass(FULL));

    expect(text(card)).toContain("0.96");
  });

  it("shows coverage as a share of the recognised groups", async () => {
    const card = await render(makeHass(FULL));

    expect(text(card)).toContain("3 of 5");
  });

  it("names the groups with nothing in them", async () => {
    const card = await render(makeHass(FULL));

    expect(text(card)).toContain("lock");
    expect(text(card)).toContain("vacuum");
  });

  it("draws one stacked-bar segment per covered group", async () => {
    const card = await render(makeHass(FULL));

    expect(card.shadowRoot?.querySelectorAll(".stack-segment")).toHaveLength(3);
  });

  it("sizes each segment by its share of the config entries", async () => {
    const card = await render(makeHass(FULL));

    const widths = Array.from(
      card.shadowRoot?.querySelectorAll<HTMLElement>(".stack-segment") ?? [],
    ).map((el) => Number.parseFloat(el.style.width));

    // 8, 3 and 1 of 12 entries.
    expect(widths[0]).toBeCloseTo((8 / 12) * 100, 5);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  it("orders the segments largest first", async () => {
    const card = await render(makeHass(FULL));

    const labels = Array.from(
      card.shadowRoot?.querySelectorAll(".stack-segment") ?? [],
    ).map((el) => el.getAttribute("title"));

    expect(labels[0]).toContain("lighting");
  });

  it("says so when nothing has been covered yet", async () => {
    const card = await render(
      makeHass({
        groups_covered: [],
        groups_missing: ["lock"],
        evenness: 0,
        group_counts: {},
      }),
    );

    expect(card.shadowRoot?.querySelectorAll(".stack-segment")).toHaveLength(0);
    expect(text(card)).toMatch(/no integrations/i);
  });

  it("explains itself when the diversity sensor is missing", async () => {
    const card = await render(makeHass());

    expect(text(card)).toContain("sensor.haus_diversity");
  });
});
