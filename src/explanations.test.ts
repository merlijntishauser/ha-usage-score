import { describe, expect, it } from "vitest";

import { EXPLAINED_KEYS, explain } from "./explanations";

describe("explain", () => {
  it("explains every metric the cards can show", () => {
    for (const key of EXPLAINED_KEYS) {
      expect(explain(key, {}), key).toBeTruthy();
    }
  });

  it("says nothing about a metric it does not know", () => {
    expect(explain("something_invented", {})).toBeUndefined();
  });

  it("quotes the window the integration actually uses", () => {
    expect(explain("fire_rate", { windowDays: 30 })).toContain("30 days");
    expect(explain("fire_rate", { windowDays: 14 })).toContain("14 days");
  });

  it("quotes the coverage target rather than assuming one", () => {
    expect(explain("groups_covered", { targetGroups: 20 })).toContain("20");
  });

  it("says outright that the comparison is not a percentile", () => {
    const text = explain("community", {}) ?? "";

    // The disclaimer is the point: means are all Home Assistant publishes,
    // so a rank is not available and the copy must not imply one.
    expect(text).toContain("average");
    expect(text).toContain("not a percentile");
    expect(text.toLowerCase()).not.toContain("top ");
    expect(text).not.toMatch(/\d+%/);
  });

  it("quotes the date and the reporting base rather than assuming them", () => {
    const text = explain("community", {
      communityAsOf: "2026-09-02",
      communityReportingInstalls: 526665,
    });

    expect(text).toContain("2026-09-02");
    expect(text).toContain("526,665");
  });

  it("still reads as a sentence when no context is available", () => {
    const text = explain("fire_rate", {});

    expect(text).not.toContain("undefined");
    expect(text?.endsWith(".")).toBe(true);
  });

  it("says hygiene is consumed, not computed here", () => {
    expect(explain("hygiene", {})).toMatch(/HAGHS/);
  });

  it("explains why a young tally sits at a neutral value", () => {
    expect(explain("notifications", {})).toMatch(/neutral/i);
    expect(explain("activity_30d", {})).toMatch(/neutral/i);
  });
});
