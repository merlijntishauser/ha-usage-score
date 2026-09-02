/**
 * Integration spread: how broad the estate is, and where the gaps are.
 *
 * Forty Hue bulbs is one integration, not forty. This card shows the shape of
 * that: which kinds of thing are covered, how evenly, and - most usefully -
 * which have nothing in them at all.
 */

import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { HausCardBase, headerStyles, pillarEntityId } from "./base";
import { PILLAR_COLORS, SPREAD_CARD_TYPE } from "./const";
import type { HausCardConfig, HomeAssistant } from "./types";

/** Segments beyond this are folded into a single remainder. */
const MAX_SEGMENTS = 10;

export class HausSpreadCard extends HausCardBase {
  protected override readonly defaultTitle = "Integration spread";
  protected readonly cardName = SPREAD_CARD_TYPE;

  protected override watchedEntityIds(): string[] {
    const score = this.getConfigEntity();
    return [score, pillarEntityId(score, "diversity")];
  }

  getCardSize(): number {
    return 4;
  }

  static getStubConfig(): HausCardConfig {
    return { type: `custom:${SPREAD_CARD_TYPE}` };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("haus-card-editor");
  }

  protected override render(): TemplateResult {
    const hass: HomeAssistant | undefined = this.hass;
    const entityId = pillarEntityId(this.getConfigEntity(), "diversity");
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

    const covered = (attributes["groups_covered"] ?? []) as string[];
    const missing = (attributes["groups_missing"] ?? []) as string[];
    const evenness = attributes["evenness"];
    const counts = (attributes["group_counts"] ?? {}) as Record<string, number>;
    const target = attributes["target_groups"];

    return html`
      <ha-card>
        ${this.renderHeader()}
        <div class="pad">
          <div class="figures">
            <div class="figure">
              <div class="num">
                ${covered.length} of ${covered.length + missing.length}
              </div>
              <div class="label">groups covered</div>
              ${target === undefined
                ? nothing
                : html`<div class="caption">
                    ${covered.length >= Number(target)
                      ? `${target}-group target reached`
                      : `towards a ${target}-group target`}
                  </div>`}
            </div>
            <div class="figure">
              <div class="num">${evenness ?? "—"}</div>
              <div class="label">evenness</div>
            </div>
          </div>
          ${this._stack(counts)}
          <div class="section">
            <div class="heading">Nothing in</div>
            ${missing.length === 0
              ? html`<p class="note">Every recognised group has something in it.</p>`
              : html`<div class="chips">
                  ${missing.map((group) => html`<span class="chip">${group}</span>`)}
                </div>`}
          </div>
        </div>
      </ha-card>
    `;
  }

  private _stack(counts: Record<string, number>): TemplateResult {
    const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = ordered.reduce((sum, [, count]) => sum + count, 0);

    if (total === 0) {
      return html`<p class="note">
        No integrations are classified yet, so there is no spread to show.
      </p>`;
    }

    const drawn: { label: string; count: number; remainder: boolean }[] =
      ordered.slice(0, MAX_SEGMENTS).map(([label, count]) => ({
        label,
        count,
        remainder: false,
      }));
    const tail = ordered.slice(MAX_SEGMENTS);
    if (tail.length > 0) {
      drawn.push({
        label: `+${tail.length} more`,
        count: tail.reduce((sum, [, count]) => sum + count, 0),
        remainder: true,
      });
    }

    // The palette carries pillar meaning, so the stack stays in the diversity
    // colour and separates by shade. The inset shadow draws a boundary between
    // neighbours: with a dozen small groups the shades alone read as one block.
    const step = 0.6 / Math.max(1, drawn.length);
    return html`
      <div class="stack" role="img" aria-label="Config entries per group">
        ${drawn.map(
          (segment, index) => html`
            <span
              class="stack-segment"
              title="${segment.label}: ${segment.count}"
              style="width:${(segment.count / total) * 100}%;
                     background:${PILLAR_COLORS["diversity"]};
                     opacity:${1 - index * step};
                     box-shadow: inset -1px 0 0 var(--card-background-color)"
            ></span>
          `,
        )}
      </div>
      <div class="legend">
        ${drawn.map((segment) =>
          segment.remainder
            ? html`<span class="legend-item remainder">${segment.label}</span>`
            : html`<span class="legend-item"
                >${segment.label} <b>${segment.count}</b></span
              >`,
        )}
      </div>
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
    .missing,
    .note {
      color: var(--secondary-text-color);
      font-size: 13px;
    }
    .figures {
      display: flex;
      gap: 28px;
      margin-bottom: 14px;
    }
    .figure .num {
      font-size: 24px;
      font-weight: 600;
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
    }
    .figure .label {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .figure .caption {
      font-size: 11px;
      color: var(--secondary-text-color);
      opacity: 0.8;
    }
    .stack {
      display: flex;
      width: 100%;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
      background: var(--divider-color);
    }
    .stack-segment {
      display: block;
      height: 100%;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      margin-top: 8px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .legend-item b {
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
    }
    .section {
      margin-top: 16px;
    }
    .heading {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--secondary-text-color);
      margin-bottom: 6px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px dashed var(--divider-color);
      color: var(--secondary-text-color);
    }
  `,
  ];
}

if (!customElements.get(SPREAD_CARD_TYPE)) {
  customElements.define(SPREAD_CARD_TYPE, HausSpreadCard);
}
