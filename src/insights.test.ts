import { describe, expect, it } from "vitest";

import { nextAction, scoreArithmetic } from "./insights";

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

describe("scoreArithmetic", () => {
  it("prints the sum that produced the score", () => {
    const line = scoreArithmetic(
      71,
      { hygiene: 84, usage: 70, diversity: 61, users: 66 },
      WEIGHTS,
    );

    expect(line).toBe("71 = ⌊.30·84 + .30·70 + .25·61 + .15·66⌋");
  });

  it("drops the hygiene term and uses the renormalised weights", () => {
    const line = scoreArithmetic(
      66,
      { hygiene: null, usage: 70, diversity: 61, users: 66 },
      { usage: 0.4286, diversity: 0.3571, users: 0.2143 },
    );

    expect(line).toBe("66 = ⌊.43·70 + .36·61 + .21·66⌋");
  });

  it("rounds pillar scores so the line stays readable", () => {
    const line = scoreArithmetic(
      62,
      { hygiene: null, usage: 27.38891, diversity: 97.99867, users: 72.76326 },
      { usage: 0.4286, diversity: 0.3571, users: 0.2143 },
    );

    expect(line).toContain("·27");
    expect(line).toContain("·98");
    expect(line).toContain("·73");
  });
});
