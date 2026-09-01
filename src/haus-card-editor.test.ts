import { describe, expect, it } from "vitest";

import "./haus-card-editor";
import type { HausCardEditor } from "./haus-card-editor";

async function renderEditor(
  config: Record<string, unknown>,
): Promise<HausCardEditor> {
  const editor = document.createElement("haus-card-editor") as HausCardEditor;
  editor.setConfig(config as never);
  document.body.appendChild(editor);
  await editor.updateComplete;
  return editor;
}

describe("haus-card-editor", () => {
  it("is registered so getConfigElement resolves", () => {
    expect(customElements.get("haus-card-editor")).toBeTruthy();
  });

  it("shows the configured entity", async () => {
    const editor = await renderEditor({
      type: "custom:haus-card",
      entity: "sensor.house_score",
    });

    const input = editor.shadowRoot?.querySelector<HTMLInputElement>(
      "input[name='entity']",
    );

    expect(input?.value).toBe("sensor.house_score");
  });

  it("falls back to the default entity when none is configured", async () => {
    const editor = await renderEditor({ type: "custom:haus-card" });

    const input = editor.shadowRoot?.querySelector<HTMLInputElement>(
      "input[name='entity']",
    );

    expect(input?.value).toBe("sensor.haus_score");
  });

  it("emits config-changed when the entity is edited", async () => {
    const editor = await renderEditor({ type: "custom:haus-card" });
    const input = editor.shadowRoot?.querySelector<HTMLInputElement>(
      "input[name='entity']",
    ) as HTMLInputElement;

    let emitted: Record<string, unknown> | undefined;
    editor.addEventListener("config-changed", (event) => {
      emitted = (event as CustomEvent).detail.config;
    });

    input.value = "sensor.house_score";
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));

    expect(emitted?.entity).toBe("sensor.house_score");
  });

  it("keeps the card type on the emitted config", async () => {
    const editor = await renderEditor({ type: "custom:haus-card" });
    const input = editor.shadowRoot?.querySelector<HTMLInputElement>(
      "input[name='name']",
    ) as HTMLInputElement;

    let emitted: Record<string, unknown> | undefined;
    editor.addEventListener("config-changed", (event) => {
      emitted = (event as CustomEvent).detail.config;
    });

    input.value = "Household";
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));

    expect(emitted?.type).toBe("custom:haus-card");
    expect(emitted?.name).toBe("Household");
  });
});
