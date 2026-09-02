/**
 * Compact HAUS variants: a badge and a tile.
 *
 * Both keep the four-colour composition of the hero card. That consistency is
 * the whole reason the ring is segmented rather than a single arc: the same
 * shape has to be recognisable at 26 pixels as at 176.
 */

import { css, html, svg } from "lit";
import type { TemplateResult } from "lit";

import { HausCardBase, headerStyles } from "./base";
import {
  BADGE_GAP,
  BADGE_SIZE,
  BADGE_STROKE_WIDTH,
  BADGE_TYPE,
  PILLARS,
  PILLAR_COLORS,
  TILE_STRIP_HEIGHT,
  TILE_TYPE,
} from "./const";
import { ringGeometry } from "./ring";
import type { HausCardConfig } from "./types";

const BADGE_CENTRE = BADGE_SIZE / 2;

/** Contributions in canonical pillar order, skipping absent pillars. */
function orderedContributions(
  contributions: Readonly<Record<string, number>>,
): { key: string; points: number }[] {
  return PILLARS.filter((key) => contributions[key] !== undefined).map(
    (key) => ({ key, points: contributions[key] as number }),
  );
}

export class HausBadge extends HausCardBase {
  protected readonly cardName = BADGE_TYPE;

  getCardSize(): number {
    return 1;
  }

  static getStubConfig(): HausCardConfig {
    return { type: `custom:${BADGE_TYPE}` };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("haus-card-editor");
  }

  protected override render(): TemplateResult {
    const state = this.entityState;
    if (state === undefined) {
      return html`<div class="badge missing">
        <span class="label">HAUS</span>
        <span class="score">?</span>
      </div>`;
    }

    const ring = ringGeometry(
      orderedContributions(this.scoreAttributes.contributions ?? {}),
      { size: BADGE_SIZE, strokeWidth: BADGE_STROKE_WIDTH, gap: BADGE_GAP },
    );

    return html`
      <div class="badge">
        <svg
          class="ring"
          viewBox="0 0 ${BADGE_SIZE} ${BADGE_SIZE}"
          width="${BADGE_SIZE}"
          height="${BADGE_SIZE}"
          role="img"
          aria-label="HAUS score ${state.state} out of 100"
        >
          <g transform="rotate(-90 ${BADGE_CENTRE} ${BADGE_CENTRE})">
            <circle
              class="track"
              cx="${BADGE_CENTRE}"
              cy="${BADGE_CENTRE}"
              r="${ring.radius}"
              fill="none"
              stroke-width="${BADGE_STROKE_WIDTH}"
            />
            ${ring.segments.map(
              (segment) => svg`
                <circle
                  class="segment"
                  cx="${BADGE_CENTRE}"
                  cy="${BADGE_CENTRE}"
                  r="${ring.radius}"
                  fill="none"
                  stroke="${PILLAR_COLORS[segment.key]}"
                  stroke-width="${BADGE_STROKE_WIDTH}"
                  stroke-dasharray="${segment.dashArray}"
                  stroke-dashoffset="${segment.dashOffset}"
                />
              `,
            )}
          </g>
        </svg>
        <span class="label">HAUS</span>
        <span class="score">${state.state}</span>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: inline-block;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px 4px 6px;
      border-radius: 16px;
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      font-size: 13px;
      color: var(--primary-text-color);
    }
    .track {
      stroke: var(--divider-color);
      opacity: 0.5;
    }
    .label {
      letter-spacing: 0.04em;
      color: var(--secondary-text-color);
    }
    .score {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  `;
}

export class HausTile extends HausCardBase {
  protected readonly cardName = TILE_TYPE;

  getCardSize(): number {
    return 1;
  }

  static getStubConfig(): HausCardConfig {
    return { type: `custom:${TILE_TYPE}` };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("haus-card-editor");
  }

  protected override render(): TemplateResult {
    const state = this.entityState;
    if (state === undefined) {
      return html`
        <ha-card>
          <div class="tile missing">
            Entity <code>${this.getConfigEntity()}</code> was not found.
          </div>
        </ha-card>
      `;
    }

    const attributes = this.scoreAttributes;
    const contributions = orderedContributions(attributes.contributions ?? {});

    return html`
      <ha-card>
        <div class="tile">
          <div class="row">
            <span class="score">${state.state}</span>
            <span class="tier">${attributes.tier}</span>
          </div>
          <div
            class="strip"
            role="img"
            aria-label="Points contributed by each pillar"
          >
            ${contributions.map(
              (contribution) => html`
                <span
                  class="strip-segment"
                  title="${contribution.key}"
                  style="width:${contribution.points}%;background:${PILLAR_COLORS[
                    contribution.key
                  ]}"
                ></span>
              `,
            )}
          </div>
        </div>
      </ha-card>
    `;
  }

  static override styles = [
    headerStyles,
    css`
    :host {
      display: block;
    }
    .tile {
      padding: 12px 14px;
    }
    .missing {
      color: var(--secondary-text-color);
      font-size: 13px;
    }
    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .score {
      font-size: 28px;
      font-weight: 600;
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .tier {
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    /* The unearned points stay visible as track: the gap is the point. */
    .strip {
      display: flex;
      height: ${TILE_STRIP_HEIGHT}px;
      border-radius: ${TILE_STRIP_HEIGHT / 2}px;
      overflow: hidden;
      background: var(--divider-color);
    }
    .strip-segment {
      display: block;
      height: 100%;
    }
  `,
  ];
}

if (!customElements.get(BADGE_TYPE)) {
  customElements.define(BADGE_TYPE, HausBadge);
}
if (!customElements.get(TILE_TYPE)) {
  customElements.define(TILE_TYPE, HausTile);
}
