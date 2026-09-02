/**
 * The HAUS breakdown card.
 *
 * This card exists to answer one objection: that the score is a magic number.
 * It prints the arithmetic that produced it, and the raw signals behind every
 * pillar, so the score is never the only thing on screen.
 */

import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { HausCardBase, headerStyles, pillarEntityId } from "./base";
import { BREAKDOWN_CARD_TYPE, PILLARS, PILLAR_COLORS, PILLAR_LABELS } from "./const";
import type { ExplanationContext } from "./explanations";
import { explain } from "./explanations";
import { scoreArithmetic } from "./insights";
import type { HausCardConfig, HomeAssistant } from "./types";

/**
 * How to phrase the raw count behind a metric.
 *
 * The metrics are curves - 61 automations saturate to 99 - so the count is
 * spelled out next to the score rather than left to be misread as one.
 */
const COUNTS: Readonly<
  Record<string, (details: Record<string, unknown>) => string | undefined>
> = {
  fire_rate: (d) =>
    d["automations_defined"] === undefined
      ? undefined
      : `${d["automations_fired"]} of ${d["automations_defined"]} fired`,
  automation_count: (d) =>
    d["automations_defined"] === undefined
      ? undefined
      : `${d["automations_defined"]} defined`,
  scripts_scenes: (d) =>
    d["scripts_and_scenes_defined"] === undefined
      ? undefined
      : `${d["scripts_and_scenes_used"]} of ${d["scripts_and_scenes_defined"]} used`,
  helpers: (d) =>
    d["helper_count"] === undefined ? undefined : `${d["helper_count"]} helpers`,
  notifications: (d) =>
    d["notification_count"] === undefined
      ? undefined
      : `${d["notification_count"]} sent`,
  accounts: (d) =>
    d["active_accounts"] === undefined
      ? undefined
      : `${d["active_accounts"]} accounts`,
  mobile_apps: (d) =>
    d["mobile_app_devices"] === undefined
      ? undefined
      : `${d["mobile_app_devices"]} registered`,
  activity_7d: (d) =>
    d["users_active_7d"] === undefined
      ? undefined
      : `${d["users_active_7d"]} people`,
  activity_30d: (d) =>
    d["users_active_30d"] === undefined
      ? undefined
      : `${d["users_active_30d"]} people`,
};

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
  protected override readonly defaultTitle = "Score breakdown";

  /** Metric keys whose explanation is currently open. */
  private readonly _open = new Set<string>();
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

  private _explanationContext(): ExplanationContext {
    const usage = this._pillarEntity("usage") ?? {};
    const diversity = this._pillarEntity("diversity") ?? {};
    const users = this._pillarEntity("users") ?? {};
    const community = this.scoreAttributes.community;
    // Knees arrive on the pillar that owns each metric - accounts from users,
    // the rest from usage - and the explanations want one map.
    const curveKnees = {
      ...((usage["curve_knees"] ?? {}) as Record<string, number>),
      ...((users["curve_knees"] ?? {}) as Record<string, number>),
    };
    const context: ExplanationContext = {};
    return {
      ...context,
      ...(typeof usage["window_days"] === "number"
        ? { windowDays: usage["window_days"] }
        : {}),
      ...(typeof diversity["target_groups"] === "number"
        ? { targetGroups: diversity["target_groups"] }
        : {}),
      ...(Object.keys(curveKnees).length === 0 ? {} : { curveKnees }),
      ...(community === undefined
        ? {}
        : {
            communityAsOf: community.as_of,
            communityReportingInstalls: community.reporting_installs,
          }),
    };
  }

  private _toggle(key: string): void {
    if (this._open.has(key)) {
      this._open.delete(key);
    } else {
      this._open.add(key);
    }
    this.requestUpdate();
  }

  /** A "?" pill plus, when open, the explanation beneath its row. */
  private _help(key: string, label: string): TemplateResult | typeof nothing {
    if (explain(key, this._explanationContext()) === undefined) {
      return nothing;
    }
    return html`<button
      class="help"
      type="button"
      aria-label="How ${label} is calculated"
      aria-expanded="${this._open.has(key) ? "true" : "false"}"
      @click=${() => this._toggle(key)}
    >
      ?
    </button>`;
  }

  private _explanation(key: string): TemplateResult | typeof nothing {
    if (!this._open.has(key)) {
      return nothing;
    }
    return html`<p class="explanation">
      ${explain(key, this._explanationContext())}
    </p>`;
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
        ${this.renderHeader()}
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
          ${this._communitySection()}
        </div>
      </ha-card>
    `;
  }

  /**
   * How this house compares with the typical reporting install.
   *
   * Two rows, not three: Home Assistant's integration count is loaded
   * built-ins and ours is config entries, so that one is omitted rather than
   * drawn wrong. Renders nothing at all when the integration publishes no
   * figures, which is what an older version looks like.
   */
  private _communitySection(): TemplateResult | typeof nothing {
    const community = this.scoreAttributes.community;
    if (community === undefined) {
      return nothing;
    }
    const mine = (pillar: string, key: string): number | undefined => {
      const value = this._pillarEntity(pillar)?.[key];
      return typeof value === "number" ? value : undefined;
    };
    const rows: [string, number | undefined, number][] = [
      ["Automations", mine("usage", "automations_defined"), community.automations],
      ["Accounts", mine("users", "active_accounts"), community.users],
    ];
    const known = rows.filter(([, own]) => own !== undefined);
    if (known.length === 0) {
      return nothing;
    }
    return html`
      <section class="community">
        <header>
          <span class="name">
            Compared with the community
            ${this._help("community", "the community comparison")}
          </span>
        </header>
        ${this._explanation("community")}
        ${known.map(
          ([label, own, average]) => html`
            <div class="compare">
              <span>${label}</span>
              <span class="num"><i>typical ${average}</i> ${own}</span>
            </div>
          `,
        )}
        <div class="note-row muted">
          <span>
            Averages over
            ${community.reporting_installs.toLocaleString("en-US")} installs
            reporting statistics, ${community.as_of}
          </span>
        </div>
      </section>
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
          <span class="name">
            ${PILLAR_LABELS[pillar]} ${this._help(pillar, PILLAR_LABELS[pillar])}
          </span>
          <span class="value">
            ${absent ? "unavailable" : Math.round(raw)}
          </span>
          <span class="weight">
            ${weight === undefined ? "—" : `${Math.round(weight * 100)}%`}
          </span>
        </header>
        ${this._explanation(pillar)}
        ${absent ? nothing : this._signals(pillar)}
      </section>
    `;
  }

  private _signals(pillar: string): TemplateResult {
    if (pillar === "diversity") {
      return this._diversitySignals();
    }
    if (pillar === "hygiene") {
      return html`<div class="note-row">
        <span>Consumed from HAGHS, never recomputed</span>
      </div>`;
    }
    const attributes = this._pillarEntity(pillar);
    const metrics = (attributes?.["metrics"] ?? {}) as Record<string, number>;
    const entries = Object.entries(metrics);
    if (entries.length === 0) {
      return html`<div class="note-row muted">
        <span>Signals unavailable - is sensor.haus_${pillar} enabled?</span>
      </div>`;
    }
    const details = attributes ?? {};
    return html`
      ${entries.map(([key, value]) => {
        const label = METRIC_LABELS[key] ?? key;
        const count = COUNTS[key]?.(details);
        return html`
          <div class="signal">
            <span>${label} ${this._help(key, label)}</span>
            <span class="num">
              ${count === undefined ? nothing : html`<i>${count}</i>`}
              ${Math.round(value)}
            </span>
          </div>
          ${this._explanation(key)}
        `;
      })}
    `;
  }

  private _diversitySignals(): TemplateResult {
    const attributes = this._pillarEntity("diversity");
    if (attributes === undefined) {
      return html`<div class="note-row muted">
        <span>Signals unavailable - is sensor.haus_diversity enabled?</span>
      </div>`;
    }
    const covered = (attributes["groups_covered"] ?? []) as string[];
    const missing = (attributes["groups_missing"] ?? []) as string[];
    const evenness = attributes["evenness"];
    return html`
      <div class="signal">
        <span>Groups covered ${this._help("groups_covered", "groups covered")}</span>
        <span class="num">
          ${covered.length} of ${covered.length + missing.length}
        </span>
      </div>
      ${this._explanation("groups_covered")}
      <div class="signal">
        <span>Evenness ${this._help("evenness", "evenness")}</span>
        <span class="num">${evenness ?? "—"}</span>
      </div>
      ${this._explanation("evenness")}
      ${missing.length > 0
        ? html`<div class="note-row missing-groups">
            <span>Nothing in</span>
            <span class="num">${missing.join(", ")}</span>
          </div>`
        : nothing}
    `;
  }

  static override styles = [
    headerStyles,
    css`
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
    .community {
      border-top: 1px solid var(--divider-color);
      padding: 10px 0 4px;
    }
    .community header {
      display: grid;
      grid-template-columns: 1fr auto;
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
    .signal,
    .compare,
    .note-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 3px 0 3px 18px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .signal .num,
    .compare .num {
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
    .help {
      appearance: none;
      border: 1px solid var(--divider-color);
      background: transparent;
      color: var(--secondary-text-color);
      font: inherit;
      font-size: 10px;
      line-height: 1;
      width: 16px;
      height: 16px;
      padding: 0;
      border-radius: 8px;
      cursor: pointer;
      vertical-align: middle;
    }
    .help:hover,
    .help:focus-visible {
      color: var(--primary-text-color);
      border-color: var(--primary-text-color);
    }
    .signal .num i,
    .compare .num i {
      font-style: normal;
      color: var(--secondary-text-color);
      margin-right: 8px;
    }
    .explanation {
      margin: 2px 0 8px;
      padding: 8px 10px;
      border-left: 2px solid var(--divider-color);
      font-size: 12px;
      line-height: 1.5;
      color: var(--secondary-text-color);
    }
  `,
  ];
}

if (!customElements.get(BREAKDOWN_CARD_TYPE)) {
  customElements.define(BREAKDOWN_CARD_TYPE, HausBreakdownCard);
}
