import { describe, expect, it } from "vitest";

import { ringGeometry } from "./ring";

const OPTIONS = { size: 176, strokeWidth: 13, gap: 2 } as const;

describe("ringGeometry", () => {
  it("derives the radius from the size and stroke so the ring fits its box", () => {
    const ring = ringGeometry([], OPTIONS);

    expect(ring.radius).toBe((176 - 13) / 2);
  });

  it("uses a circumference of 2*pi*r", () => {
    const ring = ringGeometry([], OPTIONS);

    expect(ring.circumference).toBeCloseTo(2 * Math.PI * ring.radius, 10);
  });

  it("gives an empty instance no segments and a full circle of unearned points", () => {
    const ring = ringGeometry([], OPTIONS);

    expect(ring.segments).toHaveLength(0);
    expect(ring.earned).toBe(0);
    expect(ring.unearned).toBe(100);
  });

  it("scales each arc to the points that pillar actually contributed", () => {
    const ring = ringGeometry([{ key: "usage", points: 25 }], OPTIONS);

    // A quarter of the points is a quarter of the circle, less the gap.
    expect(ring.segments[0].length).toBeCloseTo(ring.circumference / 4 - 2, 10);
  });

  it("starts each segment where the previous one ended", () => {
    const ring = ringGeometry(
      [
        { key: "hygiene", points: 30 },
        { key: "usage", points: 20 },
      ],
      OPTIONS,
    );

    const firstArc = (30 / 100) * ring.circumference;

    expect(ring.segments[0].dashOffset).toBeCloseTo(0, 10);
    expect(ring.segments[1].dashOffset).toBeCloseTo(-firstArc, 10);
  });

  it("leaves a gap between neighbouring segments", () => {
    const ring = ringGeometry(
      [
        { key: "hygiene", points: 50 },
        { key: "usage", points: 50 },
      ],
      OPTIONS,
    );

    const arc = ring.circumference / 2;
    for (const segment of ring.segments) {
      expect(segment.length).toBeCloseTo(arc - 2, 10);
    }
  });

  it("never draws a negative arc for a pillar worth less than the gap", () => {
    const ring = ringGeometry([{ key: "users", points: 0.05 }], OPTIONS);

    expect(ring.segments[0].length).toBe(0);
  });

  it("reports the gap to a full circle as unearned points", () => {
    const ring = ringGeometry(
      [
        { key: "hygiene", points: 25 },
        { key: "usage", points: 21 },
      ],
      OPTIONS,
    );

    expect(ring.earned).toBeCloseTo(46, 10);
    expect(ring.unearned).toBeCloseTo(54, 10);
  });

  it("does not report negative unearned points when the ring is full", () => {
    const ring = ringGeometry([{ key: "usage", points: 120 }], OPTIONS);

    expect(ring.unearned).toBe(0);
  });

  it("keeps the dash array long enough to hide the rest of the circle", () => {
    const ring = ringGeometry([{ key: "usage", points: 10 }], OPTIONS);

    const [dash, rest] = ring.segments[0].dashArray.split(" ").map(Number);
    expect(dash).toBeCloseTo(ring.segments[0].length, 10);
    expect(rest).toBeGreaterThanOrEqual(ring.circumference);
  });
});
