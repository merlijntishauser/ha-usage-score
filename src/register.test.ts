import { describe, expect, it } from "vitest";

// The entry point: importing it must bring every element and its picker entry.
import "./haus-card";

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
}

const EXPECTED = [
  "haus-card",
  "haus-breakdown-card",
  "haus-spread-card",
  "haus-household-card",
  "haus-badge",
  "haus-tile",
];

describe("the bundle entry point", () => {
  it("defines every HAUS element", () => {
    for (const tag of [...EXPECTED, "haus-card-editor"]) {
      expect(customElements.get(tag), tag).toBeTruthy();
    }
  });

  it("lists every card in the picker", () => {
    const registered = (
      (window as unknown as { customCards?: CustomCardEntry[] }).customCards ??
      []
    ).map((entry) => entry.type);

    for (const tag of EXPECTED) {
      expect(registered, tag).toContain(tag);
    }
  });

  it("registers each card exactly once", () => {
    const registered = (
      (window as unknown as { customCards?: CustomCardEntry[] }).customCards ??
      []
    ).filter((entry) => entry.type.startsWith("haus"));

    expect(new Set(registered.map((e) => e.type)).size).toBe(registered.length);
  });

  it("gives every picker entry a name and a description", () => {
    const registered = (
      (window as unknown as { customCards?: CustomCardEntry[] }).customCards ??
      []
    ).filter((entry) => entry.type.startsWith("haus"));

    for (const entry of registered) {
      expect(entry.name, entry.type).toBeTruthy();
      expect(entry.description, entry.type).toBeTruthy();
    }
  });
});
