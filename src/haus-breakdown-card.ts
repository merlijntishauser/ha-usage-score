/**
 * The HAUS breakdown card.
 *
 * This card exists to answer one objection: that the score is a magic number.
 * It prints the arithmetic that produced it, and the raw signals behind every
 * pillar, so the score is never the only thing on screen.
 */

import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { HausCardBase, pillarEntityId } from "./base";
import { BREAKDOWN_CARD_TYPE, PILLARS, PILLAR_COLORS, PILLAR_LABELS } from "./const";
import { scoreArithmetic } from "./insights";
import type { HausCardConfig, HomeAssistant } from "./types";

/** Human labels for the sub-metrics each pillar publishes. */
const METRIC_LABELS: Readonly<Record<string, string>> = {
  fire_rate: "Fire rate",
  automation_count: "Automations",
  scripts_scenes: "Scripts and scenes",
  helpers: "Helpers",
  notifications: "Notifications",
  advanced: "Advanced features",
  accounts: "Accounts",
  mobile_apps: "Mobile apps",
  activity_7d: "Active this week",
  activity_30d: "Active this month",
};

export class HausBreakdownCard extends HausCardBase {
  protected readonly cardName = BREAKDOWN_CARD_TYPE;

  protected override watchedEntityIds(): string[] {
    const score = this.getConfigEntity();
    return [score, ...PILLARS.filter((p) => p !== "hygiene").map((p) => pillarEntityId(score, p))];
  }

  getCardSize(): number {
    return 6;
  }

  static getStubConfig(): HausCardConfig {
    return { type: `custom:${BREAKDOWN_CARD_TYPE}` };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("haus-card-editor");
  }

  private _pillarEntity(pillar: string): Record<string, unknown> | undefined {
    const hass: HomeAssistant | undefined = this.hass;
    const state = hass?.states[pillarEntityId(this.getConfigEntity(), pillar)];
    return state?.attributes;
  }

  protected override render(): TemplateResult {
    if (this.entityState === undefined) {
      return html`
        <ha-card>
          <div class="pad missing">
            Entity <code>${this.getConfigEntity()}</code> was not found. Is the
            HAUS integration set up?
          </div>
        </ha-card>
      `;
    }

    const attributes = this.scoreAttributes;
    const score = Number(this.entityState.state);

    return html`
      <ha-card>
        <div class="pad">
          <div class="arithmetic">
            ${scoreArithmetic(
              Number.isFinite(score) ? score : 0,
              attributes.pillars,
              attributes.effective_weights ?? {},
            )}
          </div>
          <p class="explainer">
            Every pillar is a weighted mean of the signals below, and each
            signal is itself scored 0-100 rather than counted - four accounts
            score 86, they are not 86 accounts. Weights are the ones actually
            in force: with HAGHS absent, hygiene is dropped and the rest are
            renormalised over the full scale.
          </p>
          ${PILLARS.map((pillar) => this._pillarSection(pillar))}
        </div>
      </ha-card>
    `;
  }

  private _pillarSection(pillar: string): TemplateResult {
    const attributes = this.scoreAttributes;
    const raw = attributes.pillars[pillar as keyof typeof attributes.pillars];
    const weight = (attributes.effective_weights ?? {})[pillar];
    const absent = raw === null || raw === undefined;

    return html`
      <section class="pillar ${absent ? "ghost" : ""}">
        <header>
          <span class="swatch" style="background:${PILLAR_COLORS[pillar]}"></span>
          <span class="name">${PILLAR_LABELS[pillar]}</span>
          <span class="value">
            ${absent ? "unavailable" : Math.round(raw)}
          </span>
          <span class="weight">
            ${weight === undefined ? "—" : `${Math.round(weight * 100)}%`}
          </span>
        </header>
        ${absent ? nothing : this._signals(pillar)}
      </section>
    `;
  }

  private _signals(pillar: string): TemplateResult {
    if (pillar === "diversity") {
      return this._diversitySignals();
    }
    if (pillar === "hygiene") {
      return html`<div class="signal">
        <span>Consumed from HAGHS, never recomputed</span>
      </div>`;
    }
    const attributes = this._pillarEntity(pillar);
    const metrics = (attributes?.["metrics"] ?? {}) as Record<string, number>;
    const entries = Object.entries(metrics);
    if (entries.length === 0) {
      return html`<div class="signal muted">
        <span>Signals unavailable - is sensor.haus_${pillar} enabled?</span>
      </div>`;
    }
    return html`
      ${entries.map(
        ([key, value]) => html`
          <div class="signal">
            <span>${METRIC_LABELS[key] ?? key}</span>
            <span class="num">${Math.round(value)}</span>
          </div>
        `,
      )}
    `;
  }

  private _diversitySignals(): TemplateResult {
    const attributes = this._pillarEntity("diversity");
    if (attributes === undefined) {
      return html`<div class="signal muted">
        <span>Signals unavailable - is sensor.haus_diversity enabled?</span>
      </div>`;
    }
    const covered = (attributes["groups_covered"] ?? []) as string[];
    const missing = (attributes["groups_missing"] ?? []) as string[];
    const evenness = attributes["evenness"];
    return html`
      <div class="signal">
        <span>Groups covered</span>
        <span class="num">${covered.length} of ${covered.length + missing.length}</span>
      </div>
      <div class="signal">
        <span>Evenness</span>
        <span class="num">${evenness ?? "—"}</span>
      </div>
      ${missing.length > 0
        ? html`<div class="signal missing-groups">
            <span>Nothing in</span>
            <span class="num">${missing.join(", ")}</span>
          </div>`
        : nothing}
    `;
  }

  static override styles = css`
    :host {
      display: block;
    }
    .pad {
      padding: 16px;
    }
    .missing {
      color: var(--secondary-text-color);
    }
    .arithmetic {
      font-family: var(--code-font-family, ui-monospace, monospace);
      font-size: 15px;
      color: var(--primary-text-color);
    }
    .explainer {
      margin: 8px 0 16px;
      font-size: 12px;
      line-height: 1.5;
      color: var(--secondary-text-color);
    }
    .pillar {
      border-top: 1px solid var(--divider-color);
      padding: 10px 0 4px;
    }
    .pillar header {
      display: grid;
      grid-template-columns: 10px 1fr auto auto;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .swatch {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .weight,
    .ghost .value {
      color: var(--secondary-text-color);
    }
    .ghost .value {
      font-style: italic;
    }
    .ghost .swatch {
      opacity: 0.35;
    }
    .signal {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 3px 0 3px 18px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .signal .num {
      font-variant-numeric: tabular-nums;
      color: var(--primary-text-color);
    }
    .missing-groups .num {
      text-align: right;
      color: var(--secondary-text-color);
    }
    .muted {
      font-style: italic;
    }
  `;
}

if (!customElements.get(BREAKDOWN_CARD_TYPE)) {
  customElements.define(BREAKDOWN_CARD_TYPE, HausBreakdownCard);
}
