# HAUS - Home Assistant Usage Score

A score for how much of Home Assistant an instance is actually *using*, across
four pillars.

| Pillar | Weight | Source |
| --- | --- | --- |
| Hygiene | 30% | Consumed from [HAGHS](https://github.com/) - never recomputed |
| Usage | 30% | Automations that fire, scripts, scenes, helpers, notifications |
| Diversity | 25% | Breadth of integration domain groups, and their evenness |
| Users | 15% | Accounts that can operate the house, and their activity |

`score = floor(0.30*hygiene + 0.30*usage + 0.25*diversity + 0.15*users)`,
clamped to 0-100.

When HAGHS is not installed the hygiene pillar is **dropped, not zeroed**: the
remaining three are renormalised over their own weight sum (0.70), so the score
stays on a 0-100 scale and stays comparable to itself over time.

## Status

Under construction. M0 (walking skeleton) is complete: config flow, a
five-minute coordinator, and `sensor.haus_score` computed from the automation
count. The remaining pillars, the bundled Lovelace card and the community
percentile land in later milestones.

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
