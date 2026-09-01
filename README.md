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
| M2 - diversity pillar and the missing-groups set | done |
| M3 - users pillar, aggregate only | done |
| M4 - hygiene pillar consumed from HAGHS | done |
| M5 - the bundled `haus-card`, hero and degraded states | done |
| M6 - breakdown, detail cards, badge and tile | next |
| M7 - community percentile, opt-in and off by default | |
| M8 - docs, HACS default submission, brands PR | |

All four pillars are live, and the card draws them.

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

**Blueprints are deliberately not counted.** Whether an automation was built
from a blueprint cannot be told from the entity registry or from state; it means
reading configuration off disk, which the collectors do not do. The metric is a
share of the other three.

## What it does not do

- It does not recompute hygiene. That is HAGHS's job.
- It is not a config linter. `thewatchman` and `ha-config-auditor` do that.
- No cloud service, no account, no telemetry. Nothing leaves the instance.

### The diversity pillar

Forty Hue bulbs is one integration, not forty. Config entries are reduced to
their domains and mapped onto 27 curated **domain groups** - lighting, climate,
energy, media, network, protocols, presence, security, alarm, camera, doorbell,
lock, covers, vacuum, irrigation, weather, air quality, calendar, voice, notify,
sensors, appliance, transport, health, printer, storage, tools. An integration
nobody has mapped falls into `other`, which never crashes and never counts as
breadth.

The score is half **evenness** - the normalised Shannon entropy `H / ln(k)` over
the groups present, so one dominant group scores badly - and half **coverage**,
the share of a twelve-group target that has anything in it. A single group has
nothing to spread across, so its evenness is zero rather than a division by
zero.

`sensor.haus_diversity` carries `groups_covered`, `groups_missing` and
`evenness`. The missing set is the useful half: it says what to go and add.

HAUS does not count itself, and entries the user has ignored or disabled do not
count as in use.

### The users pillar

A home only its builder can operate is a hobby. Four metrics: how many usable
accounts exist (system-generated and deactivated ones do not count), how many
have a mobile app registration, and how many people actually did something in
the last seven and thirty days.

Activity is tallied the same way notifications are - HAUS listens for state
changes and attributes each one to the user in its context. A change with no
user behind it is an automation firing, not a person, and does not count.

**Privacy.** Per-user counts stay in the `Store` and are never published as
entity attributes; only aggregates reach the sensors, and a test asserts that
across every entity HAUS publishes. The per-account breakdown is served by a
websocket command, `haus/user_activity`, which requires administrator rights
*and* the per-user detail option, which is off by default. With the option off
the command refuses rather than returning an empty list, so the refusal is
legible. Nothing leaves the instance either way.

### The hygiene pillar

HAUS does not recompute hygiene. No zombie-entity counting, no database size,
no backup checks - that is [HAGHS](https://github.com/D-N91/home-assistant-global-health-score)'s
job and it is settled. HAUS reads `sensor.haghs_global_score` and weights it at
30%.

Detection is by **loaded config entry** for the `haghs` domain, re-evaluated on
every refresh and immediately when a config entry for that domain is added or
removed - so installing HAGHS later makes the pillar appear without touching
HAUS's configuration. There is deliberately no `dependencies` or
`after_dependencies` entry in the manifest: HAUS must set up cleanly with HAGHS
absent, and it does.

Missing, `unknown`, `unavailable`, non-numeric, or pointed at the wrong entity
all mean **absent**, never zero. A dependency that briefly restarts must not
tank the score, so the pillar is dropped and the other three renormalise over
their own weight sum. The entity id is an option, because users rename things.

## The card

`haus-card` ships **inside** the integration rather than as a separate HACS
plugin: HACS treats a repository as a single category, so you install one thing.
The integration serves the built file and registers the Lovelace resource for
you, updating it in place when the version changes rather than leaving a second
resource behind. If your Lovelace is in YAML mode it cannot be written to, so
HAUS logs the exact line to paste instead of failing.

The hero card is a segmented ring whose arc lengths are **the points each pillar
actually contributed**, not their raw scores - so the gap to a full circle is
the unearned points, colour-coded by which pillar to go and fix.

The pillar palette is fixed, and deliberately not themed: the colours carry
meaning, and a theme that recoloured them would destroy it. Everything else -
surfaces, text, dividers, tracks - uses your theme's variables.

| Pillar | Colour |
| --- | --- |
| Hygiene | `#2f6fd0` |
| Usage | `#0e9384` |
| Diversity | `#b5750a` |
| Users | `#c2456e` |

**When HAGHS is absent** the hygiene row stays, drawn as a dashed ghost track
reading `unavailable`, with the renormalised weights shown and one single-line
explanation in the footer. A card that silently drops a row teaches people the
pillar never existed; a card that shouts about a missing dependency gets deleted
from the dashboard. One nag, maximum.

The footer's sparkline is twelve weekly snapshots that HAUS keeps itself, for
the same reason it tallies notifications itself: the recorder may be absent, may
exclude these entities, and must not be queried on the event loop. A fresh
install says so rather than drawing a flat line.

### Building the card

```sh
npm ci
npm test          # vitest, including the ring geometry and both card states
npm run build     # rollup -> dist/, copied into custom_components/haus/www/
```

The built artifact is committed. CI rebuilds it and fails if the committed copy
does not match, so the file users install is always the file the source
produces.

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
