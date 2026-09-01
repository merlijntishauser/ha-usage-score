/** The one next-action line in the card footer. */

import { PILLAR_LABELS, PILLARS } from "./const";
import type { HausPillars } from "./types";

/** Below this many unearned points there is nothing worth nagging about. */
const NOTHING_LEFT_THRESHOLD = 1;

/**
 * Return the single most useful thing to go and do.
 *
 * Ranked by unearned *points*, not by raw distance from a hundred: a pillar
 * that is far from full but lightly weighted is not the best use of anyone's
 * evening. An absent hygiene pillar is skipped - the degraded state has its
 * own call to action, and one nag is the maximum.
 */
export function nextAction(
  pillars: HausPillars,
  weights: Readonly<Record<string, number>>,
): string {
  let bestKey: string | undefined;
  let bestUnearned = 0;

  for (const key of PILLARS) {
    const score = pillars[key];
    const weight = weights[key];
    if (score === null || score === undefined || weight === undefined) {
      continue;
    }
    const unearned = (100 - score) * weight;
    if (unearned > bestUnearned) {
      bestUnearned = unearned;
      bestKey = key;
    }
  }

  if (bestKey === undefined || bestUnearned < NOTHING_LEFT_THRESHOLD) {
    return "Nothing obvious left to improve.";
  }

  return `Best next gain: ${PILLAR_LABELS[bestKey]}, worth ${bestUnearned.toFixed(0)} points.`;
}
