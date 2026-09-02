import { describe, expect, it, vi } from "vitest";

import { PILLAR_COLORS } from "./const";
import "./haus-card";
import type { HausCard } from "./haus-card";
import type { HausScoreAttributes, HomeAssistant } from "./types";

const FULL_ATTRIBUTES: HausScoreAttributes = {
  tier: "Enthusiast",
  haghs_available: true,
  pillars: { hygiene: 84, usage: 70, diversity: 61, users: 66 },
  effective_weights: { hygiene: 0.3, usage: 0.3, diversity: 0.25, users: 0.15 },
  contributions: { hygiene: 25.2, usage: 21, diversity: 15.25, users: 9.9 },
  score_history: [
    { week: "2026-W30", score: 64 },
    { week: "2026-W31", score: 68 },
    { week: "2026-W32", score: 71 },
  ],
};

const DEGRADED_ATTRIBUTES: HausScoreAttributes = {
  tier: "Tinkerer",
  haghs_available: false,
  pillars: { hygiene: null, usage: 70, diversity: 61, users: 66 },
  effective_weights: { usage: 0.4286, diversity: 0.3571, users: 0.2143 },
  contributions: { usage: 30, diversity: 21.78, users: 14.14 },
  score_history: [{ week: "2026-W32", score: 66 }],
};

function makeHass(
  attributes: HausScoreAttributes,
  state = "71",
): HomeAssistant {
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

async function renderCard(
  hass: HomeAssistant,
  config: Record<string, unknown> = { type: "custom:haus-card" },
): Promise<HausCard> {
  const card = document.createElement("haus-card") as unknown as HausCard;
  card.setConfig(config as never);
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

function text(card: HausCard): string {
  return card.shadowRoot?.textContent ?? "";
}

/**
 * Strip lit's internal comment markers before snapshotting.
 *
 * Their hash changes whenever the template source changes at all, which
 * would make every snapshot churn on a whitespace edit and tie the tests to
 * lit's internals rather than to what the card renders.
 */
function markup(card: HausCard): string {
  return (card.shadowRoot?.innerHTML ?? "")
    .replace(/<!--\?lit\$\d+\$-->/g, "")
    .replace(/<!---->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("setConfig", () => {
  it("defaults to the standard score entity", () => {
    const card = document.createElement("haus-card") as unknown as HausCard;

    card.setConfig({ type: "custom:haus-card" });

    expect(card.getConfigEntity()).toBe("sensor.haus_score");
  });

  it("rejects a non-string entity with a message that says what to do", () => {
    const card = document.createElement("haus-card") as unknown as HausCard;

    expect(() => card.setConfig({ type: "custom:haus-card", entity: 7 } as never))
      .toThrowError(/entity/i);
  });

  it("rejects an entity that is not a sensor", () => {
    const card = document.createElement("haus-card") as unknown as HausCard;

    expect(() =>
      card.setConfig({ type: "custom:haus-card", entity: "light.kitchen" } as never),
    ).toThrowError(/sensor/i);
  });
});

describe("card mechanics", () => {
  it("reports a card size", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));

    expect(typeof card.getCardSize()).toBe("number");
  });

  it("offers a usable stub config", () => {
    expect(
      (customElements.get("haus-card") as typeof HausCard).getStubConfig().entity,
    ).toBe("sensor.haus_score");
  });

  it("points at its own editor", () => {
    expect(
      (customElements.get("haus-card") as typeof HausCard).getConfigElement,
    ).toBeTypeOf("function");
  });

  it("does not re-render when the entity it depends on has not changed", async () => {
    const hass = makeHass(FULL_ATTRIBUTES);
    const card = await renderCard(hass);
    const spy = vi.spyOn(card, "requestUpdate");

    card.hass = { states: { ...hass.states } };

    expect(spy).not.toHaveBeenCalled();
  });

  it("re-renders when the entity actually changes", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));
    const spy = vi.spyOn(card, "requestUpdate");

    card.hass = makeHass(FULL_ATTRIBUTES, "72");

    expect(spy).toHaveBeenCalled();
  });
});

describe("hero state", () => {
  it("shows the score, the scale and the tier", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));

    expect(text(card)).toContain("71");
    expect(text(card)).toContain("/ 100");
    expect(text(card)).toContain("Enthusiast");
  });

  it("draws one ring segment per contributing pillar", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));

    expect(card.shadowRoot?.querySelectorAll(".segment")).toHaveLength(4);
  });

  it("colours each pillar with the validated palette", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));
    const html = card.shadowRoot?.innerHTML ?? "";

    for (const colour of Object.values(PILLAR_COLORS)) {
      expect(html).toContain(colour);
    }
  });

  it("lists every pillar with its raw score and effective weight", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));

    expect(card.shadowRoot?.querySelectorAll(".pillar-row")).toHaveLength(4);
    expect(text(card)).toContain("Hygiene");
    expect(text(card)).toContain("30%");
  });

  it("draws a sparkline of the weekly history", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));

    expect(card.shadowRoot?.querySelector(".sparkline")).toBeTruthy();
  });

  it("offers exactly one next action", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));

    expect(card.shadowRoot?.querySelectorAll(".next-action")).toHaveLength(1);
  });

  it("matches its snapshot", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));

    expect(markup(card)).toMatchSnapshot();
  });
});

describe("degraded state", () => {
  it("keeps the hygiene row rather than silently dropping it", async () => {
    const card = await renderCard(makeHass(DEGRADED_ATTRIBUTES, "66"));

    expect(card.shadowRoot?.querySelectorAll(".pillar-row")).toHaveLength(4);
    expect(text(card)).toContain("Hygiene");
  });

  it("renders the hygiene row as a ghost track reading unavailable", async () => {
    const card = await renderCard(makeHass(DEGRADED_ATTRIBUTES, "66"));

    expect(card.shadowRoot?.querySelector(".pillar-row.ghost")).toBeTruthy();
    expect(text(card)).toContain("unavailable");
  });

  it("shows the renormalised weights", async () => {
    const card = await renderCard(makeHass(DEGRADED_ATTRIBUTES, "66"));

    expect(text(card)).toContain("43%");
  });

  it("draws no ring segment for the absent pillar", async () => {
    const card = await renderCard(makeHass(DEGRADED_ATTRIBUTES, "66"));

    expect(card.shadowRoot?.querySelectorAll(".segment")).toHaveLength(3);
  });

  it("nags exactly once", async () => {
    const card = await renderCard(makeHass(DEGRADED_ATTRIBUTES, "66"));

    expect(card.shadowRoot?.querySelectorAll(".cta")).toHaveLength(1);
  });

  it("matches its snapshot", async () => {
    const card = await renderCard(makeHass(DEGRADED_ATTRIBUTES, "66"));

    expect(markup(card)).toMatchSnapshot();
  });
});

describe("missing entity", () => {
  it("explains itself rather than throwing", async () => {
    const card = await renderCard({ states: {} });

    expect(text(card)).toContain("sensor.haus_score");
  });
});

describe("card structure", () => {
  it("keeps the footer inside the same ha-card as the ring", async () => {
    const card = await renderCard(makeHass(FULL_ATTRIBUTES));

    expect(card.shadowRoot?.querySelectorAll("ha-card")).toHaveLength(1);
    expect(card.shadowRoot?.querySelector("ha-card .footer")).toBeTruthy();
    expect(card.shadowRoot?.querySelector("ha-card .hero")).toBeTruthy();
  });
});
