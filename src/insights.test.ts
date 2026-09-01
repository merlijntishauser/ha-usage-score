import { describe, expect, it } from "vitest";

import { nextAction } from "./insights";

const WEIGHTS = { hygiene: 0.3, usage: 0.3, diversity: 0.25, users: 0.15 };

describe("nextAction", () => {
  it("names the pillar with the most unearned points", () => {
    const action = nextAction(
      { hygiene: 90, usage: 80, diversity: 20, users: 80 },
      WEIGHTS,
    );

    expect(action).toContain("Diversity");
  });

  it("weighs unearned points, not raw distance from a hundred", () => {
    // Users is further from 100, but carries less weight, so diversity is the
    // better thing to go and fix.
    const action = nextAction(
      { hygiene: 100, usage: 100, diversity: 50, users: 20 },
      WEIGHTS,
    );

    expect(action).toContain("Diversity");
  });

  it("ignores an absent hygiene pillar", () => {
    const action = nextAction(
      { hygiene: null, usage: 90, diversity: 88, users: 85 },
      { usage: 0.4286, diversity: 0.3571, users: 0.2143 },
    );

    expect(action).not.toContain("Hygiene");
  });

  it("says so when there is nothing obvious left", () => {
    const action = nextAction(
      { hygiene: 100, usage: 100, diversity: 100, users: 100 },
      WEIGHTS,
    );

    expect(action).toMatch(/nothing/i);
  });
});
