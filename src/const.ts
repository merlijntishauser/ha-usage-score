/** Card constants. */

import type { HausCardConfig } from "./types";

/**
 * Pillar palette.
 *
 * Validated for colour-vision deficiency and for contrast against both Home
 * Assistant card surfaces. These are deliberately not theme variables: the
 * colours carry meaning - which pillar to go and fix - and a theme that
 * recoloured them would destroy that meaning. Everything else on the card uses
 * theme variables.
 */
export const PILLAR_COLORS: Readonly<Record<string, string>> = {
  hygiene: "#2f6fd0",
  usage: "#0e9384",
  diversity: "#b5750a",
  users: "#c2456e",
};

/** Canonical pillar order, matching the integration's own. */
export const PILLARS = ["hygiene", "usage", "diversity", "users"] as const;

export const PILLAR_LABELS: Readonly<Record<string, string>> = {
  hygiene: "Hygiene",
  usage: "Usage",
  diversity: "Diversity",
  users: "Users",
};

export const DEFAULT_ENTITY = "sensor.haus_score";

export const RING_SIZE = 176;
export const RING_STROKE_WIDTH = 13;
export const RING_GAP = 2;

export const CARD_TYPE = "haus-card";
export const BREAKDOWN_CARD_TYPE = "haus-breakdown-card";
export const SPREAD_CARD_TYPE = "haus-spread-card";
export const HOUSEHOLD_CARD_TYPE = "haus-household-card";
export const BADGE_TYPE = "haus-badge";
export const TILE_TYPE = "haus-tile";

/** Compact variants. The composition must stay readable this small - that
 * consistency is the reason the ring is segmented at all. */
export const BADGE_SIZE = 26;
export const BADGE_STROKE_WIDTH = 3;
export const BADGE_GAP = 1;
export const TILE_STRIP_HEIGHT = 5;

export const STUB_CONFIG: HausCardConfig = {
  type: `custom:${CARD_TYPE}`,
  entity: DEFAULT_ENTITY,
};
