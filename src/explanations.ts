/**
 * How each number on the cards is arrived at.
 *
 * The breakdown card exists to stop the score being a magic number, and a
 * signal nobody can interpret is a smaller magic number. Copy here describes
 * the *shape* of each calculation and quotes only values the integration
 * actually publishes - hard-coding a tunable would let the explanation drift
 * away from the code the moment anything is retuned.
 */

export interface ExplanationContext {
  /** Days the usage window covers, from the integration. */
  readonly windowDays?: number;
  /** Groups the coverage half is measured against, from the integration. */
  readonly targetGroups?: number;
  /** Date the bundled community averages were taken, from the integration. */
  readonly communityAsOf?: string;
  /** Installs those averages are drawn from, from the integration. */
  readonly communityReportingInstalls?: number;
  /** Knee of each saturating metric's curve, keyed by metric, from the
   * integration. Absent metrics are not curves, or are not published yet. */
  readonly curveKnees?: Readonly<Record<string, number>>;
}

/** Every key the cards can ask about. */
export const EXPLAINED_KEYS = [
  "hygiene",
  "usage",
  "diversity",
  "users",
  "fire_rate",
  "automation_count",
  "scripts_scenes",
  "helpers",
  "notifications",
  "advanced",
  "accounts",
  "mobile_apps",
  "activity_7d",
  "activity_30d",
  "groups_covered",
  "evenness",
  "community",
] as const;

/**
 * Name a metric's curve, quoting its knee when the integration published one.
 *
 * The copy used to say "whose knee is at two" with the two written out. Every
 * `k` is a tunable exactly as TARGET_GROUPS was, and prose is the one place a
 * retune fails silently instead of moving a number.
 */
const curve = (context: ExplanationContext, key: string): string => {
  const k = context.curveKnees?.[key];
  return k === undefined
    ? "a saturating curve"
    : `a saturating curve with its knee at ${k}`;
};

const installs = (context: ExplanationContext): string =>
  context.communityReportingInstalls === undefined
    ? "the installs that report statistics"
    : `the ${context.communityReportingInstalls.toLocaleString("en-US")} ` +
      "installs that report statistics";

const window_ = (context: ExplanationContext): string =>
  context.windowDays === undefined
    ? "the recent window"
    : `the last ${context.windowDays} days`;

function build(context: ExplanationContext): Record<string, string> {
  const w = window_(context);
  const target =
    context.targetGroups === undefined
      ? "a target number of groups"
      : `${context.targetGroups} groups`;

  return {
    hygiene:
      "Read from HAGHS and weighted at 30%. HAUS never recomputes it: no " +
      "zombie-entity counting, no database size, no backup checks. When HAGHS " +
      "is absent this pillar is dropped and the other three are renormalised " +
      "over the full scale, rather than scored zero.",
    usage:
      "A weighted mean of the six signals below. What counts is firing, not " +
      "existing, so the fire rate carries the most weight.",
    diversity:
      "Half how evenly the estate is spread over the groups it covers, half " +
      `how many of ${target} it covers at all.`,
    users:
      "A weighted mean of the four signals below. A home only its builder can " +
      "operate is a hobby, so the account count carries the most weight.",
    fire_rate:
      `The share of your automations that ran in ${w}, read from each ` +
      "automation's last_triggered. Weighted heaviest of the usage signals: " +
      "62 automations that never trigger is not usage.",
    automation_count:
      `How many automations exist, on ${curve(context, "automation_count")}: ` +
      "the first few count for a great deal and hoarding stops paying. A curve " +
      "rather than a ratio so a small house is not punished forever.",
    scripts_scenes:
      "Half whether one-touch routines exist at all, half whether they get " +
      `run - scripts by last_triggered, scenes by their state - in ${w}. The ` +
      `presence half is ${curve(context, "scripts_scenes")}.`,
    helpers:
      "input_* entities, counters, timers and schedules, counted from the " +
      "entity registry rather than from state so a helper that is currently " +
      `unavailable still counts as configured. Scored on ${curve(context, "helpers")}.`,
    notifications:
      `notify service calls HAUS tallied itself over ${w}, on ` +
      `${curve(context, "notifications")}. There is no ` +
      "history for this without the recorder, so HAUS counts the events as " +
      "they happen. Until the tally has enough days behind it the metric sits " +
      "at a neutral value rather than at zero.",
    advanced:
      "The share of recognised advanced features present: template entities, " +
      "zones beyond zone.home, and a configured voice assistant.",
    accounts:
      `Active accounts that are not system-generated, on ${curve(context, "accounts")} ` +
      "- a second person who can operate the house is the point of this pillar.",
    mobile_apps:
      "Mobile app registrations as a share of the accounts, capped at 100. " +
      "Someone with three phones is not three people.",
    activity_7d:
      "How many distinct people caused a state change in the last seven days, " +
      "as a share of the accounts. A change with no user behind it is an " +
      "automation firing, not a person, and does not count.",
    activity_30d:
      "The same over thirty days. Both windows sit at a neutral value until " +
      "the tally has been running long enough to cover them: a fresh install " +
      "has not earned a zero, it simply has no history yet.",
    groups_covered:
      "Config entries are reduced to their domains and mapped onto 27 curated " +
      "groups - forty Hue bulbs are one integration, not forty. Coverage is " +
      `measured against ${target}, so covering more than that is already full ` +
      "marks on this half.",
    community:
      "A comparison with the community average, not a percentile: Home " +
      "Assistant publishes means and no distribution at all, so there is no " +
      "way to say what share of installs you are ahead of. Drawn from " +
      `${installs(context)}${
        context.communityAsOf === undefined
          ? ""
          : `, taken on ${context.communityAsOf}`
      }, and bundled with the release rather than fetched. Home Assistant ` +
      "counts every account that is not system-generated where HAUS counts " +
      "only active ones, so its user figure can read slightly high.",
    evenness:
      "The normalised Shannon entropy of the groups present, H / ln(k). One " +
      "dominant group scores zero however large the estate is; an even spread " +
      "scores one.",
  };
}

/** Return the explanation for a metric, or undefined when there is none. */
export function explain(
  key: string,
  context: ExplanationContext,
): string | undefined {
  return build(context)[key];
}
