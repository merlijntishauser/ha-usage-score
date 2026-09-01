# HAUS - Home Assistant Usage Score

A score for how much of Home Assistant an instance is actually *using*, across
four pillars.

| Pillar | Weight | Source |
| --- | --- | --- |
| Hygiene | 30% | Consumed from [HAGHS](https://github.com/D-N91/home-assistant-global-health-score) - never recomputed |
| Usage | 30% | Automations that fire, scripts, scenes, helpers, notifications |
| Diversity | 25% | Breadth of integration domain groups, and their evenness |
| Users | 15% | Accounts that can operate the house, and their activity |

`score = floor(0.30*hygiene + 0.30*usage + 0.25*diversity + 0.15*users)`,
clamped to 0-100.

When HAGHS is not installed the hygiene pillar is **dropped, not zeroed**: the
remaining three are renormalised over their own weight sum (0.70), so the score
stays on a 0-100 scale and stays comparable to itself over time.

HAGHS measures whether an instance is *healthy*. HAUS measures whether it is
being *used*, and consumes HAGHS for the hygiene pillar rather than competing
with it. HAUS sets up cleanly whether or not HAGHS is installed.

## Status

Under construction, built in vertical slices.

| Milestone | State |
| --- | --- |
| M0 - walking skeleton: config flow, coordinator, `sensor.haus_score` | done |
| M1 - usage pillar, with the notify tally | done |
| M2 - diversity pillar and the missing-groups set | next |
| M3 - users pillar, aggregate only | |
| M4 - hygiene pillar consumed from HAGHS | |
| M5 - the bundled `haus-card`, hero and degraded states | |
| M6 - breakdown, detail cards, badge and tile | |
| M7 - community percentile, opt-in and off by default | |
| M8 - docs, HACS default submission, brands PR | |

Today `sensor.haus_score` and `sensor.haus_usage` are computed from the usage
pillar alone, through the same renormalised path an instance without HAGHS will
use for good.

### The usage pillar

What counts is firing, not existing. Six metrics, weighted, with the fire rate
carrying the most:

| Metric | What it reads |
| --- | --- |
| Fire rate | Share of automations whose `last_triggered` falls in the last 30 days |
| Automation count | How many are defined, on a saturating curve |
| Scripts and scenes | Half presence, half whether they get run |
| Helpers | `input_*`, `counter`, `timer`, `schedule`, from the entity registry |
| Notifications | `notify` service calls, tallied by HAUS itself |
| Advanced features | Template entities, zones beyond `zone.home`, a voice assistant |

There is no history for notifications sent without the recorder, and querying
the recorder on the event loop is not an option, so HAUS listens for
`EVENT_CALL_SERVICE` and keeps its own rolling 30-day tally in a `Store`. Until
seven days of that history exist the metric sits at a neutral value: a fresh
install is not punished for a counter that has not had time to run. History
runs from when HAUS started watching, not from the first notification, so a
quiet house still leaves the neutral start behind.

**Open question - blueprints.** The brief lists "blueprints in use" as an
advanced feature. Whether an automation was built from a blueprint cannot be
told from the entity registry or from state; it means reading configuration off
disk. The collectors deliberately do neither, so this signal is not currently
counted and the metric is a share of the other three.

## What it does not do

- It does not recompute hygiene. That is HAGHS's job.
- It is not a config linter. `thewatchman` and `ha-config-auditor` do that.
- No cloud service, no account, no telemetry. Nothing leaves the instance.

## Installation

HACS -> three-dot menu -> **Custom repositories** -> add this repository with
category **Integration**, then install and restart. Add the integration from
**Settings -> Devices & services -> Add integration -> HAUS**.

## Entity

`sensor.haus_score` - 0-100, with the per-pillar scores, the effective weights,
the contribution points per pillar, the tier and `haghs_available` as
attributes. The score is never the only thing on screen.

## Development

```sh
uv sync
uv run pytest
uv run ruff check .
uv run mypy
```

## License

MIT. See [LICENSE](LICENSE).
