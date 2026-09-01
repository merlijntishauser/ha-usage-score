/**
 * The HAUS hero card.
 *
 * A segmented ring whose arcs are the points each pillar actually contributed,
 * so the gap to a full circle is the unearned points, colour-coded by which
 * pillar to go and fix.
 */

import { LitElement, css, html, nothing, svg } from "lit";
import type { TemplateResult } from "lit";

import {
  CARD_TYPE,
  DEFAULT_ENTITY,
  PILLARS,
  PILLAR_COLORS,
  PILLAR_LABELS,
  RING_GAP,
  RING_SIZE,
  RING_STROKE_WIDTH,
  STUB_CONFIG,
} from "./const";
// Importing the editor here guarantees it is registered by the time
// getConfigElement asks for it: one bundle, one resource, one install.
import "./haus-card-editor";
import { nextAction } from "./insights";
import { ringGeometry } from "./ring";
import type {
  HausCardConfig,
  HausHistoryPoint,
  HausScoreAttributes,
  HassEntity,
  HomeAssistant,
} from "./types";

const CENTRE = RING_SIZE / 2;
const SPARKLINE_WIDTH = 168;
const SPARKLINE_HEIGHT = 28;

export class HausCard extends LitElement {
  private _entityId: string = DEFAULT_ENTITY;
  private _hass: HomeAssistant | undefined;
  private _entityState: HassEntity | undefined;

  /** Validate and store the card configuration. */
  setConfig(config: HausCardConfig): void {
    const entity: unknown = config?.entity;
    if (entity !== undefined) {
      if (typeof entity !== "string") {
        throw new Error(
          'haus-card: "entity" must be an entity id, for example sensor.haus_score',
        );
      }
      if (!entity.startsWith("sensor.")) {
        throw new Error(
          `haus-card: "${entity}" is not a sensor. Point "entity" at the HAUS ` +
            "score sensor, for example sensor.haus_score",
        );
      }
    }
    this._entityId = (entity as string | undefined) ?? DEFAULT_ENTITY;
  }

  /** The entity this card reads, after defaulting. */
  getConfigEntity(): string {
    return this._entityId;
  }

  /**
   * Only re-render when the entity this card depends on actually changed.
   *
   * `hass` is reassigned on every state change anywhere in the instance; a
   * card that re-renders on all of them is a card that makes dashboards feel
   * slow.
   */
  set hass(hass: HomeAssistant) {
    const next = hass.states[this._entityId];
    this._hass = hass;
    if (next === this._entityState) {
      return;
    }
    this._entityState = next;
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  getCardSize(): number {
    return 5;
  }

  static getStubConfig(): HausCardConfig {
    return STUB_CONFIG;
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(`${CARD_TYPE}-editor`);
  }

  protected override render(): TemplateResult {
    const state = this._entityState;
    if (state === undefined) {
      return html`
        <ha-card>
          <div class="pad missing">
            Entity <code>${this._entityId}</code> was not found. Is the HAUS
            integration set up?
          </div>
        </ha-card>
      `;
    }

    const attributes = state.attributes as unknown as HausScoreAttributes;
    const weights = attributes.effective_weights ?? {};
    const contributions = attributes.contributions ?? {};
    const pillars = attributes.pillars ?? {
      hygiene: null,
      usage: 0,
      diversity: 0,
      users: 0,
    };
    const degraded = attributes.haghs_available === false;

    const ring = ringGeometry(
      PILLARS.filter((key) => contributions[key] !== undefined).map((key) => ({
        key,
        points: contributions[key] as number,
      })),
      { size: RING_SIZE, strokeWidth: RING_STROKE_WIDTH, gap: RING_GAP },
    );

    return html`
      <ha-card>
        <div class="hero">
          <div class="ring-wrap">
            <svg
              class="ring"
              viewBox="0 0 ${RING_SIZE} ${RING_SIZE}"
              width="${RING_SIZE}"
              height="${RING_SIZE}"
              role="img"
              aria-label="HAUS score ${state.state} out of 100"
            >
              <g transform="rotate(-90 ${CENTRE} ${CENTRE})">
                <circle
                  class="track"
                  cx="${CENTRE}"
                  cy="${CENTRE}"
                  r="${ring.radius}"
                  fill="none"
                  stroke-width="${RING_STROKE_WIDTH}"
                />
                ${ring.segments.map(
                  (segment) => svg`
                    <circle
                      class="segment"
                      cx="${CENTRE}"
                      cy="${CENTRE}"
                      r="${ring.radius}"
                      fill="none"
                      stroke="${PILLAR_COLORS[segment.key]}"
                      stroke-width="${RING_STROKE_WIDTH}"
                      stroke-dasharray="${segment.dashArray}"
                      stroke-dashoffset="${segment.dashOffset}"
                      stroke-linecap="butt"
                    />
                  `,
                )}
              </g>
            </svg>
            <div class="centre">
              <div class="score">${state.state}</div>
              <div class="scale">/ 100</div>
              <div class="tier">${attributes.tier ?? ""}</div>
            </div>
          </div>
          <div class="pillars">
            ${PILLARS.map((key) => this._pillarRow(key, pillars[key], weights[key]))}
          </div>
        </div>
        <div class="footer">
          ${this._sparkline(attributes.score_history ?? [])}
          <div class="next-action">${nextAction(pillars, weights)}</div>
          ${degraded
            ? html`<div class="cta">
                HAGHS is not installed, so hygiene is dropped and the other three
                pillars are renormalised over the full scale.
              </div>`
            : nothing}
        </div>
      </ha-card>
    `;
  }

  private _pillarRow(
    key: string,
    score: number | null,
    weight: number | undefined,
  ): TemplateResult {
    const absent = score === null || score === undefined;
    const colour = PILLAR_COLORS[key];
    return html`
      <div class="pillar-row ${absent ? "ghost" : ""}">
        <span class="swatch" style="background:${colour}"></span>
        <span class="name">${PILLAR_LABELS[key]}</span>
        <span class="score">${absent ? "unavailable" : Math.round(score)}</span>
        <span class="weight">
          ${weight === undefined ? "—" : `${Math.round(weight * 100)}%`}
        </span>
        <span class="bar">
          ${absent
            ? nothing
            : html`<span
                class="bar-fill"
                style="width:${Math.max(0, Math.min(100, score))}%;background:${colour}"
              ></span>`}
        </span>
      </div>
    `;
  }

  private _sparkline(history: readonly HausHistoryPoint[]): TemplateResult {
    if (history.length < 2) {
      return html`<div class="sparkline empty">
        Building history: one point a week.
      </div>`;
    }
    const scores = history.map((point) => point.score);
    const lowest = Math.min(...scores);
    const highest = Math.max(...scores);
    const span = highest - lowest || 1;
    const step = SPARKLINE_WIDTH / (scores.length - 1);
    const points = scores
      .map((score, index) => {
        const x = index * step;
        const y = SPARKLINE_HEIGHT - ((score - lowest) / span) * SPARKLINE_HEIGHT;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return html`
      <svg
        class="sparkline"
        viewBox="0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}"
        preserveAspectRatio="none"
        role="img"
        aria-label="Score over the last ${history.length} weeks"
      >
        <polyline points="${points}" fill="none" stroke-width="2" />
      </svg>
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
    .hero {
      display: flex;
      gap: 20px;
      align-items: center;
      padding: 16px;
      flex-wrap: wrap;
    }
    .ring-wrap {
      position: relative;
      width: ${RING_SIZE}px;
      height: ${RING_SIZE}px;
      flex: 0 0 auto;
    }
    .track {
      stroke: var(--divider-color);
      opacity: 0.4;
    }
    .centre {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1.1;
    }
    .centre .score {
      font-size: 44px;
      font-weight: 600;
      color: var(--primary-text-color);
    }
    .centre .scale {
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    .centre .tier {
      margin-top: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .pillars {
      flex: 1 1 220px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 220px;
    }
    .pillar-row {
      display: grid;
      grid-template-columns: 10px 1fr auto auto;
      grid-template-areas: "swatch name score weight" "bar bar bar bar";
      gap: 4px 8px;
      align-items: center;
      font-size: 13px;
      color: var(--primary-text-color);
    }
    .swatch {
      grid-area: swatch;
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .name {
      grid-area: name;
    }
    .pillar-row .score {
      grid-area: score;
      font-variant-numeric: tabular-nums;
    }
    .weight {
      grid-area: weight;
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      grid-area: bar;
      display: block;
      height: 4px;
      border-radius: 2px;
      background: var(--divider-color);
      overflow: hidden;
    }
    .bar-fill {
      display: block;
      height: 100%;
    }
    .ghost .swatch,
    .ghost .bar-fill {
      opacity: 0.35;
    }
    .ghost .score {
      color: var(--secondary-text-color);
      font-style: italic;
    }
    .ghost .bar {
      background: transparent;
      border-top: 2px dashed var(--divider-color);
      height: 0;
    }
    .footer {
      border-top: 1px solid var(--divider-color);
      padding: 12px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sparkline {
      width: 100%;
      height: ${SPARKLINE_HEIGHT}px;
    }
    .sparkline polyline {
      stroke: var(--secondary-text-color);
    }
    .sparkline.empty {
      height: auto;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .next-action,
    .cta {
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    .cta {
      color: var(--primary-text-color);
      opacity: 0.85;
    }
  `;
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, HausCard);
}

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview: boolean;
}

const cardRegistry = window as unknown as { customCards?: CustomCardEntry[] };
cardRegistry.customCards = [
  ...(cardRegistry.customCards ?? []),
  {
    type: CARD_TYPE,
    name: "HAUS",
    description: "How much of Home Assistant this instance actually uses.",
    preview: true,
  },
];
