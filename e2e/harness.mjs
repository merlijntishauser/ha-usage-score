/**
 * Puts one card in one column of a given width, from the BUILT bundle.
 *
 * Deliberately the built artifact rather than the sources: the thing shipped
 * to a dashboard is what should be measured, and the bundle is also what the
 * Lovelace resource serves.
 *
 * Query parameters: card, width, variant.
 */

import "../custom_components/haus/www/haus-card.js";

// Home Assistant supplies ha-card; the harness supplies just enough of it.
if (!customElements.get("ha-card")) {
  customElements.define(
    "ha-card",
    class extends HTMLElement {
      connectedCallback() {
        if (this.shadowRoot) return;
        this.attachShadow({ mode: "open" }).innerHTML = `<style>
          :host {
            display: block;
            background: var(--card-background-color, #fff);
            border-radius: var(--ha-card-border-radius, 12px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
          }
        </style><slot></slot>`;
      }
    },
  );
}

const entity = (entity_id, state, attributes) => ({ entity_id, state, attributes });

const COMMUNITY = {
  automations: 14,
  users: 2,
  as_of: "2026-09-02",
  reporting_installs: 526665,
  source: "https://analytics.home-assistant.io/data.json",
};

const HISTORY = [
  { week: "2026-W30", score: 64 },
  { week: "2026-W31", score: 68 },
  { week: "2026-W32", score: 71 },
];

/** Full: HAGHS present and history to draw. Degraded: neither. */
function statesFor(variant) {
  const degraded = variant === "degraded";
  return {
    "sensor.haus_score": entity("sensor.haus_score", degraded ? "66" : "76", {
      tier: degraded ? "Tinkerer" : "Enthusiast",
      haghs_available: !degraded,
      pillars: degraded
        ? { hygiene: null, usage: 70, diversity: 90, users: 66 }
        : { hygiene: 84, usage: 70, diversity: 90, users: 66 },
      effective_weights: degraded
        ? { usage: 0.4286, diversity: 0.3571, users: 0.2143 }
        : { hygiene: 0.3, usage: 0.3, diversity: 0.25, users: 0.15 },
      contributions: degraded
        ? { usage: 30, diversity: 32.1, users: 14.1 }
        : { hygiene: 25.2, usage: 21, diversity: 22.5, users: 9.9 },
      score_history: degraded ? [{ week: "2026-W32", score: 66 }] : HISTORY,
      community: COMMUNITY,
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
      curve_knees: {
        automation_count: 12,
        scripts_scenes: 10,
        helpers: 12,
        notifications: 30,
      },
      metrics: {
        fire_rate: 55.5,
        automation_count: 99,
        scripts_scenes: 40,
        helpers: 90,
        notifications: 50,
        advanced: 66.7,
      },
    }),
    "sensor.haus_diversity": entity("sensor.haus_diversity", "90", {
      target_groups: 20,
      groups_covered: ["climate", "lighting", "media", "sensors"],
      groups_missing: ["lock", "printer", "vacuum"],
      evenness: 0.96,
      group_counts: { climate: 4, lighting: 9, media: 6, sensors: 12 },
    }),
    "sensor.haus_users": entity("sensor.haus_users", "66", {
      active_accounts: 4,
      mobile_app_devices: 3,
      users_active_7d: 2,
      users_active_30d: 3,
      activity_history_days: 9,
      curve_knees: { accounts: 2 },
      metrics: {
        accounts: 86.5,
        mobile_apps: 100,
        activity_7d: 50,
        activity_30d: 75,
      },
    }),
  };
}

const params = new URLSearchParams(location.search);
const cardName = params.get("card") ?? "haus-card";
const width = params.get("width") ?? "500";
const variant = params.get("variant") ?? "full";

const column = document.getElementById("column");
column.style.width = `${width}px`;

const card = document.createElement(cardName);
card.setConfig({ type: `custom:${cardName}` });
card.hass = { states: statesFor(variant) };
column.appendChild(card);

await card.updateComplete;
// The spec waits on this rather than on a timeout.
document.body.dataset.ready = "true";
