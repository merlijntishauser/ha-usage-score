/**
 * Segmented-ring geometry.
 *
 * Each arc's length is the points that pillar actually contributed, not its
 * raw score, so the gap to a full circle is the unearned points - colour-coded
 * by which pillar to go and fix. Getting dash-array and dash-offset arithmetic
 * wrong is the single most likely bug in this card, which is why it lives here
 * on its own with tests.
 */

/** The full scale of the ring: one hundred points is one whole circle. */
const TOTAL_POINTS = 100;

export interface RingContribution {
  /** Pillar key, used to colour the arc. */
  readonly key: string;
  /** Points this pillar contributed to the score. */
  readonly points: number;
}

export interface RingOptions {
  /** Outer box of the ring, in pixels. */
  readonly size: number;
  /** Stroke width of the ring, in pixels. */
  readonly strokeWidth: number;
  /** Gap between neighbouring segments, in pixels of arc. */
  readonly gap: number;
}

export interface RingSegment {
  readonly key: string;
  /** Rendered arc length in pixels, never negative. */
  readonly length: number;
  /** `stroke-dasharray` value: the visible arc, then enough to hide the rest. */
  readonly dashArray: string;
  /** `stroke-dashoffset` value, negative to advance around the circle. */
  readonly dashOffset: number;
}

export interface RingGeometry {
  readonly radius: number;
  readonly circumference: number;
  readonly segments: readonly RingSegment[];
  /** Points earned: the sum of the contributions, uncapped. */
  readonly earned: number;
  /** Points not earned: the visible gap to a full circle. */
  readonly unearned: number;
}

/** Build the geometry for a segmented ring from per-pillar contributions. */
export function ringGeometry(
  contributions: readonly RingContribution[],
  options: RingOptions,
): RingGeometry {
  const radius = (options.size - options.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let start = 0;
  const segments: RingSegment[] = [];
  for (const contribution of contributions) {
    const arc = (contribution.points / TOTAL_POINTS) * circumference;
    // The gap is taken out of the drawn arc, not out of the position, so a
    // segment still starts exactly where its predecessor's share ended.
    const length = Math.max(0, arc - options.gap);
    segments.push({
      key: contribution.key,
      length,
      dashArray: `${length} ${circumference}`,
      dashOffset: -start,
    });
    start += arc;
  }

  const earned = contributions.reduce(
    (total, contribution) => total + contribution.points,
    0,
  );

  return {
    radius,
    circumference,
    segments,
    earned,
    unearned: Math.max(0, TOTAL_POINTS - earned),
  };
}
