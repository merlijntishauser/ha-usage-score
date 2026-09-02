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

/**
 * Print the arithmetic that produced the score.
 *
 * This exists to answer the "magic score" objection: a number nobody can take
 * apart is a number nobody should trust. The line reconciles exactly with what
 * the integration computed, renormalised weights and all.
 */
export function scoreArithmetic(
  score: number,
  pillars: HausPillars,
  weights: Readonly<Record<string, number>>,
): string {
  const terms: string[] = [];
  for (const key of PILLARS) {
    const value = pillars[key];
    const weight = weights[key];
    if (value === null || value === undefined || weight === undefined) {
      continue;
    }
    // Leading zero stripped: ".30" reads as a weight, "0.30" as a measurement.
    const printedWeight = weight.toFixed(2).replace(/^0/, "");
    terms.push(`${printedWeight}·${Math.round(value)}`);
  }
  return `${score} = ⌊${terms.join(" + ")}⌋`;
}
