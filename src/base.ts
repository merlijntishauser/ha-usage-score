/**
 * Shared plumbing for every HAUS card.
 *
 * All of them read the same score entity, validate the same config and need
 * the same guard against re-rendering on unrelated state changes. Keeping that
 * in one place is what stops five cards drifting apart.
 */

import { LitElement } from "lit";

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

  /** The element name used in error messages. */
  protected abstract readonly cardName: string;

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
    this._entityId = (entity as string | undefined) ?? DEFAULT_ENTITY;
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
