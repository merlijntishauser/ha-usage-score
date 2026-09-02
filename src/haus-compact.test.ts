import { describe, expect, it } from "vitest";

import { BADGE_SIZE, PILLAR_COLORS } from "./const";
import "./haus-compact";
import type { HausBadge, HausTile } from "./haus-compact";
import type { HausScoreAttributes, HomeAssistant } from "./types";

const FULL: HausScoreAttributes = {
  tier: "Enthusiast",
  haghs_available: true,
  pillars: { hygiene: 84, usage: 70, diversity: 61, users: 66 },
  effective_weights: { hygiene: 0.3, usage: 0.3, diversity: 0.25, users: 0.15 },
  contributions: { hygiene: 25.2, usage: 21, diversity: 15.25, users: 9.9 },
};

const DEGRADED: HausScoreAttributes = {
  ...FULL,
  haghs_available: false,
  pillars: { hygiene: null, usage: 70, diversity: 61, users: 66 },
  contributions: { usage: 30, diversity: 21.78, users: 14.14 },
};

function makeHass(attributes: HausScoreAttributes, state = "71"): HomeAssistant {
  return {
    states: {
      "sensor.haus_score": {
        entity_id: "sensor.haus_score",
        state,
        attributes: attributes as unknown as Record<string, unknown>,
      },
    },
  };
}

async function render<T extends HausBadge | HausTile>(
  tag: string,
  hass: HomeAssistant,
): Promise<T> {
  const el = document.createElement(tag) as unknown as T;
  el.setConfig({ type: `custom:${tag}` });
  el.hass = hass;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (el: HausBadge | HausTile): string =>
  el.shadowRoot?.textContent ?? "";

describe("haus-badge", () => {
  it("is registered", () => {
    expect(customElements.get("haus-badge")).toBeTruthy();
  });

  it("names itself and shows the score", async () => {
    const badge = await render<HausBadge>("haus-badge", makeHass(FULL));

    expect(text(badge)).toContain("HAUS");
    expect(text(badge)).toContain("71");
  });

  it("keeps the four-colour composition at badge size", async () => {
    const badge = await render<HausBadge>("haus-badge", makeHass(FULL));
    const markup = badge.shadowRoot?.innerHTML ?? "";

    expect(badge.shadowRoot?.querySelectorAll(".segment")).toHaveLength(4);
    for (const colour of Object.values(PILLAR_COLORS)) {
      expect(markup).toContain(colour);
    }
  });

  it("draws the ring at the compact size", async () => {
    const badge = await render<HausBadge>("haus-badge", makeHass(FULL));

    expect(badge.shadowRoot?.querySelector(".ring")?.getAttribute("width")).toBe(
      String(BADGE_SIZE),
    );
  });

  it("drops the hygiene arc when HAGHS is absent", async () => {
    const badge = await render<HausBadge>("haus-badge", makeHass(DEGRADED, "66"));

    expect(badge.shadowRoot?.querySelectorAll(".segment")).toHaveLength(3);
  });
});

describe("haus-tile", () => {
  it("is registered", () => {
    expect(customElements.get("haus-tile")).toBeTruthy();
  });

  it("shows the score and the tier", async () => {
    const tile = await render<HausTile>("haus-tile", makeHass(FULL));

    expect(text(tile)).toContain("71");
    expect(text(tile)).toContain("Enthusiast");
  });

  it("draws a contribution strip, one segment per pillar", async () => {
    const tile = await render<HausTile>("haus-tile", makeHass(FULL));

    expect(tile.shadowRoot?.querySelectorAll(".strip-segment")).toHaveLength(4);
  });

  it("sizes strip segments by the points each pillar contributed", async () => {
    const tile = await render<HausTile>("haus-tile", makeHass(FULL));

    const widths = Array.from(
      tile.shadowRoot?.querySelectorAll<HTMLElement>(".strip-segment") ?? [],
    ).map((el) => Number.parseFloat(el.style.width));

    expect(widths[0]).toBeCloseTo(25.2, 5);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(71.35, 5);
  });

  it("leaves the unearned points as visible track", async () => {
    const tile = await render<HausTile>("haus-tile", makeHass(FULL));

    expect(tile.shadowRoot?.querySelector(".strip")).toBeTruthy();
  });

  it("explains itself when the entity is missing", async () => {
    const tile = await render<HausTile>("haus-tile", { states: {} });

    expect(text(tile)).toContain("sensor.haus_score");
  });

  it("reports a card size and a stub config", async () => {
    const tile = await render<HausTile>("haus-tile", makeHass(FULL));
    const ctor = customElements.get("haus-tile") as typeof HausTile;

    expect(typeof tile.getCardSize()).toBe("number");
    expect(ctor.getStubConfig().type).toContain("haus-tile");
  });
});
