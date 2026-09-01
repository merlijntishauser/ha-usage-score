/**
 * Visual editor for the HAUS card.
 *
 * Deliberately plain inputs rather than `ha-form` or `ha-entity-picker`: those
 * are frontend internals whose shape moves between releases, and the card only
 * has two fields. This works on every version and can be tested.
 */

import { LitElement, css, html } from "lit";
import type { TemplateResult } from "lit";

import { CARD_TYPE, DEFAULT_ENTITY } from "./const";
import type { HausCardConfig } from "./types";

const EDITOR_TYPE = `${CARD_TYPE}-editor`;

export class HausCardEditor extends LitElement {
  private _config: HausCardConfig = { type: `custom:${CARD_TYPE}` };

  setConfig(config: HausCardConfig): void {
    this._config = config;
    this.requestUpdate();
  }

  protected override render(): TemplateResult {
    return html`
      <div class="form">
        <label>
          <span>Score entity</span>
          <input
            name="entity"
            type="text"
            .value=${this._config.entity ?? DEFAULT_ENTITY}
            @change=${this._valueChanged}
          />
        </label>
        <label>
          <span>Name</span>
          <input
            name="name"
            type="text"
            .value=${this._config.name ?? ""}
            @change=${this._valueChanged}
          />
        </label>
      </div>
    `;
  }

  private _valueChanged(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    const config: Record<string, unknown> = { ...this._config };
    if (value === "") {
      delete config[input.name];
    } else {
      config[input.name] = value;
    }
    this._config = config as unknown as HausCardConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  static override styles = css`
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px 0;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    input {
      font: inherit;
      font-size: 14px;
      padding: 8px;
      color: var(--primary-text-color);
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 4px;
    }
  `;
}

if (!customElements.get(EDITOR_TYPE)) {
  customElements.define(EDITOR_TYPE, HausCardEditor);
}
