/** Shapes HAUS publishes, and the card's own configuration. */

export interface HausPillars {
  /** null when HAGHS is absent: the pillar is dropped, not zeroed. */
  readonly hygiene: number | null;
  readonly usage: number;
  readonly diversity: number;
  readonly users: number;
}

export interface HausHistoryPoint {
  readonly week: string;
  readonly score: number;
}

export interface HausScoreAttributes {
  readonly tier: string;
  readonly haghs_available: boolean;
  readonly pillars: HausPillars;
  readonly effective_weights: Readonly<Record<string, number>>;
  readonly contributions: Readonly<Record<string, number>>;
  readonly score_history?: readonly HausHistoryPoint[];
}

export interface HassEntity {
  readonly entity_id: string;
  readonly state: string;
  readonly attributes: Record<string, unknown>;
}

export interface HausUserActivity {
  readonly user_id: string;
  readonly name: string | null;
  readonly actions_7d: number;
  readonly actions_30d: number;
  readonly last_active: string | null;
}

export interface HomeAssistant {
  readonly states: Record<string, HassEntity | undefined>;
  readonly themes?: unknown;
  /** Present in the real frontend; optional so tests and previews can omit it. */
  readonly callWS?: <T>(message: Record<string, unknown>) => Promise<T>;
}

export interface HausCardConfig {
  readonly type: string;
  /** The HAUS score entity. Defaults to `sensor.haus_score`. */
  readonly entity?: string;
  readonly name?: string;
}
