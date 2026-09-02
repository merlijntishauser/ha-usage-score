/**
 * Picker registration for every HAUS card.
 *
 * Home Assistant builds its "add card" list from `window.customCards`. A card
 * that is defined but not listed here is invisible in the picker even though
 * it works when added by hand - which is exactly how the first release looked
 * broken.
 */

import {
  BADGE_TYPE,
  BREAKDOWN_CARD_TYPE,
  CARD_TYPE,
  HOUSEHOLD_CARD_TYPE,
  SPREAD_CARD_TYPE,
  TILE_TYPE,
} from "./const";

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview: boolean;
}

const ENTRIES: CustomCardEntry[] = [
  {
    type: CARD_TYPE,
    name: "HAUS",
    description: "How much of Home Assistant this instance actually uses.",
    preview: true,
  },
  {
    type: BREAKDOWN_CARD_TYPE,
    name: "HAUS breakdown",
    description: "The arithmetic behind the score, and every signal under it.",
    preview: true,
  },
  {
    type: SPREAD_CARD_TYPE,
    name: "HAUS integration spread",
    description: "How broad the estate is, and which groups have nothing in them.",
    preview: true,
  },
  {
    type: HOUSEHOLD_CARD_TYPE,
    name: "HAUS household",
    description: "Who can operate this house, and whether they do.",
    preview: true,
  },
  {
    type: BADGE_TYPE,
    name: "HAUS badge",
    description: "The score as a compact badge.",
    preview: true,
  },
  {
    type: TILE_TYPE,
    name: "HAUS tile",
    description: "Score, tier and a contribution strip.",
    preview: true,
  },
];

const registry = window as unknown as { customCards?: CustomCardEntry[] };
const existing = (registry.customCards ??= []);
for (const entry of ENTRIES) {
  // Guarded: the bundle can be imported more than once in a page's lifetime,
  // and a duplicated entry shows as a duplicated card in the picker.
  if (!existing.some((registered) => registered.type === entry.type)) {
    existing.push(entry);
  }
}
