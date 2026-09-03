# HAUS — Home Assistant Usage Score

[![HACS custom](https://img.shields.io/badge/HACS-custom-41BDF5.svg)](https://hacs.xyz)
[![Release](https://img.shields.io/github/v/release/merlijntishauser/ha-usage-score)](https://github.com/merlijntishauser/ha-usage-score/releases)

Most dashboards tell you what your house is doing. HAUS tells you how much of
Home Assistant you are actually **using**, and what to do next.

![The HAUS hero card](docs/images/hero.png)

One sensor scored 0–100 across four pillars, six cards to draw it, and an event
to react to. Nothing leaves your instance.

HAGHS measures whether an instance is *healthy*. HAUS measures whether it is
being *used*, and consumes HAGHS for its hygiene pillar rather than competing
with it. It works with or without HAGHS installed.

## Install

Requires Home Assistant **2026.8.0** or newer.

HACS → three-dot menu → **Custom repositories** → add this repository with
category **Integration** → install → restart Home Assistant. Then
**Settings → Devices & services → Add integration → HAUS**.

The cards come with it. HAUS serves the bundled file and registers the Lovelace
resource itself, updating it in place on each version change rather than leaving
a second resource behind. If your Lovelace is in YAML mode it cannot be written
to, so HAUS logs the exact line to paste instead of failing.

Add `custom:haus-card` to a dashboard and you are done.

## Configuration

Two options, both under **Settings → Devices & services → HAUS → Configure**.
Neither is required; the defaults are right for a stock install.

| Option | Default | What it does |
| --- | --- | --- |
| HAGHS entity | `sensor.system_ha_global_health_score` | Where the hygiene pillar is read from. Change it if you have renamed the HAGHS sensor. |
| Expose per-user detail | off | Lets the household card ask for a per-account breakdown. Off by default, and even on it requires an administrator. |

The per-user option is the only one that changes what leaves the integration,
and only to an admin over a websocket command inside your own instance. See
[Privacy](#privacy).

## The score

```
score = floor(0.30·hygiene + 0.30·usage + 0.25·diversity + 0.15·users)
```

| Pillar | Weight | What it measures |
| --- | --- | --- |
| Hygiene | 30% | Read from [HAGHS](https://github.com/D-N91/home-assistant-global-health-score), never recomputed |
| Usage | 30% | Automations that fire, scripts, scenes, helpers, notifications |
| Diversity | 25% | Breadth of integration domain groups, and their evenness |
| Users | 15% | Accounts that can operate the house, and whether they do |

**Without HAGHS the hygiene pillar is dropped, not zeroed:** the other three
renormalise over their own weight sum, so the score stays on a 0–100 scale and
stays comparable to itself over time. An instance without HAGHS is not
permanently capped at 70.

The score bands into a tier, which is what the event reports on:

| Score | Tier |
| --- | --- |
| 0–39 | Starter |
| 40–59 | Tinkerer |
| 60–79 | Enthusiast |
| 80–92 | Power user |
| 93–100 | Overengineered |

The score is recomputed every five minutes; see [How it updates](#how-it-updates).

### Three rules that shape every number

**Absent is never zero.** A missing, `unknown`, `unavailable` or non-numeric
input means *absent* — the pillar is dropped and the rest renormalise. A
dependency that briefly restarts must never tank your score.

**Metrics are saturating curves, not counts.** Sixty-one automations score 99;
four accounts score 86. Early additions count for a great deal and hoarding
stops paying, so a small house is not punished forever. Every raw count is
published alongside its score, so a card can show the number without the score
being mistaken for one.

**A rolling window stays neutral until it is full.** A fresh install has no
history, and scoring "nobody did anything" as zero punishes a counter that has
not had time to run. Notifications wait 7 days; the 30-day activity metric waits
30.

### Usage

What counts is firing, not existing — the fire rate carries the most weight.

| Metric | What it reads |
| --- | --- |
| Fire rate | Share of automations whose `last_triggered` falls in the last 30 days |
| Automation count | How many exist, on a saturating curve |
| Scripts and scenes | Half presence, half whether they get run |
| Helpers | `input_*`, `counter`, `timer`, `schedule`, from the entity registry |
| Notifications | `notify` service calls, tallied by HAUS itself |
| Advanced features | Template entities, zones beyond `zone.home`, a voice assistant |

There is no history for notifications sent without the recorder, and the
recorder must not be queried on the event loop — so HAUS listens for
`EVENT_CALL_SERVICE` and keeps its own rolling 30-day tally. History runs from
when HAUS started watching rather than from the first notification, so a quiet
house still leaves the neutral start behind.

**Blueprints are deliberately not counted.** Whether an automation came from a
blueprint cannot be told from the entity registry or from state without reading
configuration off disk, which the collectors do not do.

### Diversity

Forty Hue bulbs is one integration, not forty. Config entries are reduced to
their domains and mapped onto 27 curated **domain groups** — lighting, climate,
energy, media, network, protocols, presence, security, alarm, camera, doorbell,
lock, covers, vacuum, irrigation, weather, air quality, calendar, voice, notify,
sensors, appliance, transport, health, printer, storage, tools. Anything
unmapped falls into `other`, which never crashes and never counts as breadth.

Half the score is **evenness** — the normalised Shannon entropy `H / ln(k)` over
the groups present, so one dominant group scores badly. Half is **coverage**, the
share of a 20-group target with anything in it. `sensor.haus_diversity` carries
`groups_missing`, which is the actionable half: it says what to go and add.

HAUS does not count itself, and entries you have ignored or disabled are not in
use.

### Users

A home only its builder can operate is a hobby. Four metrics: usable accounts
(system-generated and deactivated ones do not count), how many have a mobile app
registration, and how many people actually did something in the last seven and
thirty days.

Activity is attributed through the user id on each state change's context. A
change with nobody behind it is an automation firing, not a person, and does not
count.

### Hygiene

HAUS does not recompute hygiene — no zombie-entity counting, no database size,
no backup checks. That is HAGHS's job and it is settled. HAUS reads
`sensor.system_ha_global_health_score` and weights it at 30%.

Detection is by **loaded config entry**, re-evaluated on every refresh and
immediately when a `haghs` config entry appears or disappears — so installing
HAGHS later makes the pillar show up without touching HAUS's configuration.
There is deliberately no `dependencies` entry in the manifest: HAUS must set up
cleanly with HAGHS absent, and it does. The entity id is an option, because
people rename things.

## How it updates

Three mechanisms, because one would not do.

**A five-minute poll.** A `DataUpdateCoordinator` recollects every signal it can
read directly from `hass` — automations, scripts, scenes, helpers, config
entries, accounts. Nothing here needs to be faster: these are numbers that move
over weeks.

**Its own event tallies.** Notifications and per-user activity have no history
without the recorder, and the recorder may be absent, may exclude these
entities, and must never be queried on the event loop. So HAUS listens to
`EVENT_CALL_SERVICE` and `EVENT_STATE_CHANGED` and keeps rolling counters in its
own storage.

**A recollect once Home Assistant has started.** Setup runs before `automation`,
`script` and `scene` have loaded, so the first collection of a restart sees an
empty house. Without a second pass on `EVENT_HOMEASSISTANT_STARTED` the first
score after every restart would be badly wrong — and would be snapshotted into
the weekly history on its way past.

## The cards

One resource, six cards, all reading the same entity and following the same
palette, so a dashboard using several still reads as one system.

| Card | What it is for |
| --- | --- |
| `custom:haus-card` | The hero: segmented ring, pillar rows, sparkline, next action |
| `custom:haus-breakdown-card` | The printed arithmetic and every raw signal under it |
| `custom:haus-spread-card` | Coverage, evenness, a stacked bar, and the missing groups |
| `custom:haus-household-card` | Who can operate the house, and whether they do |
| `custom:haus-badge` | A 26px ring plus the score |
| `custom:haus-tile` | Score, tier and a contribution strip |

The hero ring's arc lengths are **the points each pillar actually contributed**,
not its raw score — so the gap to a full circle is the points still unearned,
colour-coded by which pillar to go and fix.

The pillar palette is fixed and deliberately not themed: the colours carry
meaning, and a theme that recoloured them would destroy it. Everything else —
surfaces, text, dividers, tracks — follows your theme.

| Hygiene | Usage | Diversity | Users |
| --- | --- | --- | --- |
| `#2f6fd0` | `#0e9384` | `#b5750a` | `#c2456e` |

Every card takes an optional `title`. The hero has none by default — the ring,
the score and the tier already say what it is — while the three detail cards
name themselves. `title: ""` hides a header where your dashboard already has a
heading above it.

### The breakdown card

![The breakdown card](docs/images/breakdown.png)

This card exists to answer one objection: that the score is a magic number. It
prints the arithmetic using the weights actually in force, so the number can
always be taken apart, and counts sit next to scores — 61 automations score 99,
and it says both.

Every signal carries a **`?` pill** that explains, in place, how that number is
arrived at. The copy quotes only values the integration publishes — the window,
the coverage target, the knee of each saturating curve — so an explanation
cannot drift away from the code when a constant is retuned.

### The detail cards

![The integration spread card](docs/images/spread.png)

![The household card](docs/images/household.png)

The household card is the only one that fetches anything. It calls an
admin-checked websocket command, and renders a refusal as a refusal: "off by
default" and "administrator only" are different states, and neither one is an
empty list.

### Compact variants

![The badge](docs/images/badge.png)

![The tile](docs/images/tile.png)

Both keep the four-colour composition, which is the whole reason the ring is
segmented rather than drawn as one arc — the shape has to be recognisable at
26px as well as at 176.

### In a narrow column

Below 448px the ring and the pillar rows stack, and the ring centres itself
rather than sitting against a void.

![The hero card in a narrow column](docs/images/hero-narrow.png)

### Without HAGHS

The hygiene row stays, drawn as a dashed ghost track reading `unavailable`, with
the renormalised weights shown and one line of explanation. A card that silently
drops a row teaches people the pillar never existed; a card that shouts about a
missing dependency gets deleted from the dashboard. One nag, maximum — and it is
a maximum, so on a fresh install the "building history" line gives way to it
rather than stacking.

![The hero card with HAGHS absent](docs/images/hero-degraded.png)

The sparkline is twelve weekly snapshots HAUS keeps itself, for the same reason
it tallies notifications itself: the recorder may be absent, may exclude these
entities, and must not be queried on the event loop. A fresh install says so
rather than drawing a flat line.

## The community comparison

The breakdown card puts two of your numbers beside the community average:
automations, and accounts. Home Assistant publishes those at
[analytics.home-assistant.io](https://analytics.home-assistant.io/data.json),
averaged over the installs that opt into statistics reporting.

**It is a comparison with a mean, not a percentile.** Home Assistant publishes
averages and no distribution of any kind, so there is no honest way to say what
share of installs you are ahead of, and the card does not pretend otherwise.

The figures ship with the release, stamped with the date they were taken, rather
than being downloaded — the analytics document is 1 MB gzipped, has no lighter
endpoint and ignores conditional requests, which is a poor trade for two
integers that change slowly. Nothing leaves your instance, so there is nothing
to opt into.

Integration counts are deliberately not compared: Home Assistant counts loaded
built-in integrations and excludes custom ones, while the diversity pillar counts
distinct config-entry domains and includes them. The two numbers do not measure
the same thing.

## Entities

`sensor.haus_score` — 0–100, carrying the per-pillar scores, the effective
weights, the contribution points per pillar, the tier, `haghs_available` and the
community averages.

One sensor per owned pillar — `sensor.haus_usage`, `sensor.haus_diversity`,
`sensor.haus_users` — each with its own metrics, the raw counts behind them, and
the knee of any saturating curve. Hygiene has no sensor of its own: it is read
from HAGHS and never recomputed here.

## Events

`haus_tier_changed` fires when the score crosses into a different tier, so an
automation can react without polling the sensor and banding it by hand.

| Field | |
| --- | --- |
| `previous_tier` | the tier being left |
| `tier` | the tier now |
| `score` | the score that crossed |
| `direction` | `up` or `down` |

```yaml
automation:
  - alias: "Say something when HAUS levels up"
    triggers:
      - trigger: event
        event_type: haus_tier_changed
        event_data:
          direction: up
    actions:
      - action: notify.persistent_notification
        data:
          message: "HAUS reached {{ trigger.event.data.tier }} at {{ trigger.event.data.score }}."
```

It deliberately stays quiet twice. Not on the first reading, because a tier has
not changed just because HAUS started watching it. And not for readings taken
before Home Assistant has finished starting, because setup runs before
`automation`, `script` and `scene` have loaded and that collection sees an empty
house — without the guard it would announce a drop to Starter and a climb back
on every restart.

The consequence, stated plainly: a tier change that happened while Home
Assistant was down is not reported. HAUS did not observe it.

## Privacy

No cloud service, no account, no telemetry. Nothing leaves your instance —
including the community comparison, which is bundled rather than fetched.

Per-user activity counts never reach a state attribute. Only aggregates reach
the sensors, and a test walks every entity HAUS publishes to assert it. The
per-account breakdown is served by a websocket command that requires
administrator rights **and** an opt-in that defaults to off.

## What HAUS does not do

- It does not recompute hygiene. That is HAGHS's job.
- It is not a config linter. `thewatchman` and `ha-config-auditor` do that.
- It does not tell you what share of installs you are ahead of. Nobody can.

## Known limitations

Things HAUS gets wrong, or cannot get right, stated so nobody has to discover
them:

- **Blueprints cannot be counted.** Whether an automation came from one is not
  visible in the entity registry or in state, and the collectors do not read
  configuration off disk. The advanced-features metric is a share of the other
  three signals instead.
- **The community comparison is a mean, not a rank.** Home Assistant publishes
  averages and no distribution, so "you are ahead of N% of installs" is not
  derivable. The figures also ship with the release rather than being fetched,
  so they are as fresh as your last upgrade.
- **A tier change while Home Assistant is down goes unreported.** The event
  fires on an observed crossing, and HAUS was not watching.
- **Diversity coverage caps at 20 groups.** Cover 20 of the 27 and that half of
  the pillar is already full marks; covering the remaining seven earns nothing.
  The target has been tuned against a small number of real instances.
- **The per-account breakdown needs an administrator and an opt-in.** The
  household card shows a refusal rather than data for anyone else, by design.
- **Removing HAUS leaves two things behind.** See below.

## Troubleshooting

**Hygiene reads `unavailable` although HAGHS is installed.** Check the entity id
first: **Settings → Devices & services → HAUS → Configure**, and set it to
`sensor.system_ha_global_health_score`. Releases up to 0.4.1 defaulted to an
entity HAGHS never creates, and if you have ever opened that dialog your saved
value survives the upgrade that fixed the default.

Worth understanding rather than just fixing: a wrong entity id looks exactly
like an uninstalled HAGHS, because absent is never zero. The behaviour that
stops a restarting dependency tanking your score is the same behaviour that
makes a misconfigured one silent.

**A card is missing from the picker, or looks out of date.** The Lovelace
resource url carries the version and is the cache key, so a hard refresh after
an upgrade settles it.

**HACS shows an old README.** HACS caches it and refreshes on its own only every
couple of days. Use **Update information** on the repository.

## Removing HAUS

Delete the entry under **Settings → Devices & services → HAUS**, then remove the
repository from HACS. The entities and their history go with the entry.

That is the whole of it. HAUS also cleans up the two things it put outside its
own config entry: the Lovelace resource it registered, and the rolling
notification and activity counters in `.storage/haus.counters`.

Removing therefore means removing. The one consequence worth knowing is that
**reinstalling starts the rolling windows over** — the notification and activity
metrics sit at their neutral value again until enough days have passed, rather
than picking up where they left off.

## Development

```sh
uv sync
uv run pytest          # the integration
uv run ruff check .
uv run mypy

npm ci
npm test               # the cards, in happy-dom
npm run typecheck
npm run build          # rollup → the committed www/ artifact
npm run test:e2e       # card layout, in a real browser
npm run capture        # regenerate the README screenshots
```

`npm run test:e2e` needs a browser once: `npx playwright install chromium`.

CI fails if the committed `www/` artifact does not match a fresh build, so the
file you install is always the file the source produces. The screenshots above
come from that same artifact through the layout-test harness, and the brand
images are generated from the same pillar colours and weights the ring is drawn
from — `uv run python scripts/make_brand_images.py` — so neither can drift away
from the card. The wordmark half of that script needs a macOS system font; the
icon half is pure geometry and runs anywhere.

## License

MIT. See [LICENSE](LICENSE).
