/**
 * Shared plumbing for every HAUS card.
 *
 * All of them read the same score entity, validate the same config and need
 * the same guard against re-rendering on unrelated state changes. Keeping that
 * in one place is what stops five cards drifting apart.
 */

import { LitElement, css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { DEFAULT_ENTITY } from "./const";
import type {
  HausCardConfig,
  HausScoreAttributes,
  HassEntity,
  HomeAssistant,
} from "./types";

const EMPTY_ATTRIBUTES: HausScoreAttributes = {
  tier: "",
  haghs_available: false,
  pillars: { hygiene: null, usage: 0, diversity: 0, users: 0 },
  effective_weights: {},
  contributions: {},
};

export abstract class HausCardBase extends LitElement {
  private _entityId: string = DEFAULT_ENTITY;
  private _hass: HomeAssistant | undefined;
  private _entityState: HassEntity | undefined;
  private _watched: (HassEntity | undefined)[] | undefined;

  /** The element name used in error messages. */
  protected abstract readonly cardName: string;

  /** Header shown when the config does not set one. Empty means none. */
  protected readonly defaultTitle: string = "";

  private _title: string | undefined;

  /** Validate and store the card configuration. */
  setConfig(config: HausCardConfig): void {
    const entity: unknown = config?.entity;
    if (entity !== undefined) {
      if (typeof entity !== "string") {
        throw new Error(
          `${this.cardName}: "entity" must be an entity id, for example ` +
            DEFAULT_ENTITY,
        );
      }
      if (!entity.startsWith("sensor.")) {
        throw new Error(
          `${this.cardName}: "${entity}" is not a sensor. Point "entity" at ` +
            `the HAUS score sensor, for example ${DEFAULT_ENTITY}`,
        );
      }
    }
    this._title = typeof config?.title === "string" ? config.title : undefined;
    this._entityId = (entity as string | undefined) ?? DEFAULT_ENTITY;
    this._watched = undefined;
    this.requestUpdate();
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
    const next = this.watchedEntityIds().map((id) => hass.states[id]);
    this._hass = hass;
    if (
      this._watched !== undefined &&
      next.length === this._watched.length &&
      next.every((state, index) => state === this._watched?.[index])
    ) {
      return;
    }
    this._watched = next;
    this._entityState = next[0];
    this.requestUpdate();
  }

  /**
   * Entity ids this card re-renders for. The score entity comes first; cards
   * that read the pillar sensors too widen this.
   */
  protected watchedEntityIds(): string[] {
    return [this._entityId];
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  /**
   * Render the card header.
   *
   * A detail card that opens straight into numbers gives the reader nothing to
   * anchor on, so each one names itself. An explicit empty title hides it, for
   * dashboards that already have a heading above the card.
   */
  protected renderHeader(): TemplateResult | typeof nothing {
    const title = this._title ?? this.defaultTitle;
    return title === "" ? nothing : html`<h2 class="card-header">${title}</h2>`;
  }

  /** The score entity's state object, or undefined when it is missing. */
  protected get entityState(): HassEntity | undefined {
    return this._entityState;
  }

  /**
   * The score entity's attributes, defaulted so render never guards twice.
   *
   * Named `scoreAttributes` rather than `attributes` because `Element`
   * already owns that name and returns a NamedNodeMap.
   */
  protected get scoreAttributes(): HausScoreAttributes {
    const raw = this._entityState?.attributes;
    return raw === undefined
      ? EMPTY_ATTRIBUTES
      : (raw as unknown as HausScoreAttributes);
  }
}

/**
 * Derive a pillar sensor's entity id from the score sensor's.
 *
 * `sensor.haus_score` -> `sensor.haus_usage`. Users rename things, so this
 * follows whatever the score entity was configured as rather than assuming the
 * default prefix.
 */
export function pillarEntityId(scoreEntityId: string, pillar: string): string {
  return scoreEntityId.endsWith("_score")
    ? `${scoreEntityId.slice(0, -"_score".length)}_${pillar}`
    : `sensor.haus_${pillar}`;
}

/** Header styling shared by every card that shows one. */
export const headerStyles = css`
  .card-header {
    margin: 0;
    padding: 16px 16px 0;
    font-family: var(--ha-card-header-font-family, inherit);
    font-size: var(--ha-card-header-font-size, 20px);
    font-weight: 400;
    line-height: 1.2;
    color: var(--ha-card-header-color, var(--primary-text-color));
  }
  .card-header + .pad {
    padding-top: 12px;
  }
`;
