/**
 * Household detail: who can operate this house, and whether they do.
 *
 * The aggregate signals come from the users sensor. The per-account breakdown
 * is never a state attribute - it is fetched over an admin-checked websocket
 * command, and only when the instance has opted in. A refusal is shown as a
 * refusal, because an empty list would read as "nobody did anything".
 */

import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { HausCardBase, headerStyles, pillarEntityId } from "./base";
import { HOUSEHOLD_CARD_TYPE, PILLAR_COLORS } from "./const";
import type { HausCardConfig, HausUserActivity, HomeAssistant } from "./types";

/**
 * Each metric, with the attribute holding its real count.
 *
 * The metric itself is a curve - four accounts saturate to 86 - so the count
 * is what gets printed and the score is left to draw the bar.
 */
const METRICS: readonly {
  key: string;
  label: string;
  countAttribute: string;
}[] = [
  { key: "accounts", label: "Accounts", countAttribute: "active_accounts" },
  {
    key: "mobile_apps",
    label: "Mobile apps",
    countAttribute: "mobile_app_devices",
  },
  {
    key: "activity_7d",
    label: "Active this week",
    countAttribute: "users_active_7d",
  },
  {
    key: "activity_30d",
    label: "Active this month",
    countAttribute: "users_active_30d",
  },
];

/** Both activity windows are covered once the tally is this old. */
const SUSTAINED_WINDOW_DAYS = 30;

type DetailState =
  | { kind: "idle" }
  | { kind: "users"; users: readonly HausUserActivity[] }
  | { kind: "off" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

export class HausHouseholdCard extends HausCardBase {
  protected override readonly defaultTitle = "Household";
  protected readonly cardName = HOUSEHOLD_CARD_TYPE;

  private _detail: DetailState = { kind: "idle" };
  private _asked = false;

  protected override watchedEntityIds(): string[] {
    const score = this.getConfigEntity();
    return [score, pillarEntityId(score, "users")];
  }

  getCardSize(): number {
    return 4;
  }

  static getStubConfig(): HausCardConfig {
    return { type: `custom:${HOUSEHOLD_CARD_TYPE}` };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("haus-card-editor");
  }

  override set hass(hass: HomeAssistant) {
    super.hass = hass;
    void this._askForDetail();
  }

  override get hass(): HomeAssistant | undefined {
    return super.hass;
  }

  /**
   * Ask once per card for the per-user breakdown.
   *
   * Asking on every hass assignment would be a websocket round trip per state
   * change anywhere in the instance.
   */
  private async _askForDetail(): Promise<void> {
    const hass: HomeAssistant | undefined = this.hass;
    if (this._asked || hass?.callWS === undefined) {
      return;
    }
    this._asked = true;
    try {
      const result = await hass.callWS<{ users: HausUserActivity[] }>({
        type: "haus/user_activity",
      });
      this._detail = { kind: "users", users: result.users ?? [] };
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      this._detail =
        code === "not_allowed"
          ? { kind: "off" }
          : code === "unauthorized"
            ? { kind: "forbidden" }
            : {
                kind: "error",
                message: String(
                  (error as { message?: string } | undefined)?.message ?? error,
                ),
              };
    }
    this.requestUpdate();
  }

  protected override render(): TemplateResult {
    const hass: HomeAssistant | undefined = this.hass;
    const entityId = pillarEntityId(this.getConfigEntity(), "users");
    const attributes = hass?.states[entityId]?.attributes;

    if (attributes === undefined) {
      return html`
        <ha-card>
          <div class="pad missing">
            Entity <code>${entityId}</code> was not found. Is the HAUS
            integration set up?
          </div>
        </ha-card>
      `;
    }

    const metrics = (attributes["metrics"] ?? {}) as Record<string, number>;
    const watching = Number(attributes["activity_history_days"] ?? 0);

    return html`
      <ha-card>
        ${this.renderHeader()}
        <div class="pad">
          <div class="metrics">
            ${METRICS.map((metric) => {
              const score = metrics[metric.key] ?? 0;
              const count = attributes[metric.countAttribute];
              return html`
                <div class="metric">
                  <div class="num">${count ?? "—"}</div>
                  <div class="label">${metric.label}</div>
                  <div class="bar">
                    <span
                      style="width:${Math.max(0, Math.min(100, score))}%;
                             background:${PILLAR_COLORS["users"]}"
                    ></span>
                  </div>
                </div>
              `;
            })}
          </div>
          ${watching < SUSTAINED_WINDOW_DAYS
            ? html`<p class="note">
                Activity has only been counted for ${watching} days, since HAUS
                started watching. The bars sit at a neutral value until each
                window has filled.
              </p>`
            : nothing}
          ${this._detailSection()}
        </div>
      </ha-card>
    `;
  }

  private _detailSection(): TemplateResult {
    switch (this._detail.kind) {
      case "users":
        return this._detail.users.length === 0
          ? html`<p class="note">
              No account has done anything HAUS could attribute yet.
            </p>`
          : html`
              <div class="heading">Per account</div>
              ${this._detail.users.map(
                (user) => html`
                  <div class="user-row">
                    <span class="who">${user.name ?? user.user_id}</span>
                    <span class="last">${user.last_active ?? "never"}</span>
                    <span class="count">${user.actions_7d}</span>
                    <span class="count">${user.actions_30d}</span>
                  </div>
                `,
              )}
              <div class="user-row legend">
                <span class="who"></span>
                <span class="last">last active</span>
                <span class="count">7d</span>
                <span class="count">30d</span>
              </div>
            `;
      case "off":
        return html`<p class="note">
          Per-account detail is turned off by default. Turn it on in the HAUS
          options if you want it; the counts never leave this instance either
          way.
        </p>`;
      case "forbidden":
        return html`<p class="note">
          Per-account detail is only shown to an administrator.
        </p>`;
      case "error":
        return html`<p class="note">
          Could not read per-account detail: ${this._detail.message}
        </p>`;
      default:
        return nothing as unknown as TemplateResult;
    }
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
    .missing,
    .note {
      color: var(--secondary-text-color);
      font-size: 13px;
      line-height: 1.5;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }
    .metric .num {
      font-size: 22px;
      font-weight: 600;
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
    }
    .metric .label {
      font-size: 12px;
      color: var(--secondary-text-color);
      margin-bottom: 4px;
    }
    .bar {
      display: block;
      height: 4px;
      border-radius: 2px;
      background: var(--divider-color);
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
    }
    .heading {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--secondary-text-color);
      border-top: 1px solid var(--divider-color);
      padding-top: 10px;
      margin-bottom: 4px;
    }
    .user-row {
      display: grid;
      grid-template-columns: 1fr auto 40px 40px;
      gap: 10px;
      font-size: 13px;
      padding: 3px 0;
      color: var(--primary-text-color);
    }
    .user-row .last,
    .user-row .count {
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .legend {
      font-size: 11px;
      color: var(--secondary-text-color);
      border-top: 1px solid var(--divider-color);
      margin-top: 4px;
      padding-top: 4px;
    }
  `,
  ];
}

if (!customElements.get(HOUSEHOLD_CARD_TYPE)) {
  customElements.define(HOUSEHOLD_CARD_TYPE, HausHouseholdCard);
}
