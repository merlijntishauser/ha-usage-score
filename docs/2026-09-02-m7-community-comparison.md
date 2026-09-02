# M7: what the community comparison can honestly be

Research written 2026-09-02, before any implementation. The brief rested on a
premise that does not hold.

**Outcome: option A, on the breakdown card.** The averages ship as dated
constants, published as a `community` attribute on the score sensor and drawn
as two rows on the breakdown card. One further change came out of
implementation and is recorded under "The integrations figure" below: only two
of the three figures survived the like-for-like check.

## The brief, and the premise that fails

Vikunja #192 reads:

> Compare against the three real distributions from HA public analytics.
> Weekly cache in the Store, graceful degradation, one-way direction stated
> on the card face.

Home Assistant publishes exactly one analytics document,
`https://analytics.home-assistant.io/data.json`. Fetched and inspected today,
`schema_version` 4. What it contains, in full:

**Per-install magnitudes - four scalars, no spread of any kind:**

| Key | Value |
| --- | --- |
| `avg_users` | 2 |
| `avg_automations` | 14 |
| `avg_integrations` | 29 |
| `avg_addons` | 6 |
| `avg_states` | 390 |

**Real distributions - all of them over categories, none over magnitudes:**
`countries` (212), `integrations` (1363 domains by install count),
`installation_types` (6), `operating_system.boards` (14), `versions` (660).

Searched the whole 6.9 MB payload for `percentile`, `histogram`,
`distribution`, `median`, `quantile`, `buckets`, `p50`, `p90`, `stddev`.
**None of them appear.** `history` (9416 entries) is a time series of install
counts and version splits only - it does not carry the averages, so not even
their drift can be recovered from it.

**A percentile cannot be computed from a mean.** There is no data here that
supports "you are in the top X% of installs", and no arithmetic that recovers
it. The three figures HAUS would want - automations, integrations, users - are
three real *numbers*, not three distributions.

What remains possible is a **ratio to the community average**: "61 automations;
the typical reporting install has 14." That is honest, uses real data, and is
a genuinely weaker claim than the ticket promised.

### The trap this is a new suit for

Trap 6 says never label a score as a count, because metrics are saturating
curves. The same error is available here in a new form: **never label a
ratio-to-the-mean as a percentile.** Automation counts are certainly long
tailed - a mean of 14 with most installs low and a thin tail of large estates -
so "4.4x the average" and "in the top N%" are not interchangeable, and no
amount of card copy makes them so. Assuming a distribution shape to recover a
percentile would be a guess dressed as a measurement, which is the thing this
project already refused when it made the notification metric wait 7 days.

### What the averages actually measure

`reports_statistics` is 526,665 against `active_installations` of 676,069, so
the averages cover about **78% of the fleet** - those opted into statistics
reporting. A self-selected and probably more engaged subset, but a large
majority, so the skew is real and modest. Worth one clause on the card face,
not a paragraph.

## The integrations figure, checked against Home Assistant's own source

The research above compared the payload's keys against what HAUS publishes.
That is not enough: what matters is what Home Assistant *counts* before it
sends. Read from `homeassistant/components/analytics/analytics.py` in the
pinned 2026.8.3:

| Figure | Home Assistant sends | HAUS has | Comparable |
| --- | --- | --- | --- |
| automations | `states.async_entity_ids_count(AUTOMATION_DOMAIN)` | `automations_defined`, the same count | yes |
| users | non-system users | `active_accounts`, non-system **and** active | nearly - theirs can read slightly high |
| integrations | loaded **built-in** integrations passing a reporting filter; custom integrations excluded entirely | distinct config-entry domains, custom included | **no** |

So the comparison ships with two rows, not three. Comparing the integration
counts would have flattered or punished an instance for reasons that have
nothing to do with it - and the mismatch is invisible from the published data
alone, which is why the check had to go to the source.

## The delivery cost, measured

| | |
| --- | --- |
| `data.json` uncompressed | 6,889,754 bytes |
| over the wire, gzip | 1,024,794 bytes |
| lighter endpoint | none - `current.json`, `summary.json`, `data-current.json`, `v1/data.json` all 404 |
| conditional GET | **does not work.** ETag is stable and weak; `If-None-Match` still returned 200 and the full body |

So the briefed design costs **1 MB on the wire and a 6.9 MB parse, weekly, per
install, to read four integers** - with no cheap revalidation available. The
parse must not happen on the event loop, for the same reason the recorder is
never queried there.

## The options

**A. Bundle the four averages as constants. (Recommended.)**
Ship them in `const.py`, stamped with the date they were taken, refreshed when
a release is cut. No network call, no opt-in, no Store cache, no degradation
path, no privacy surface, nothing to explain in the options flow. The card
shows exactly the same comparison as option B, because the same four numbers
drive it.

The opt-in in the brief exists to guard an outbound network call. Remove the
call and the opt-in has nothing left to protect.

Cost: the figures go stale between releases and must be labelled with their
date. Honest caveat - I could not measure how fast they drift, because
`history` does not carry the averages. They are aggregates over half a million
installs, so they should move slowly, but that is reasoning rather than
evidence.

**B. Weekly fetch, the brief reframed.**
Opt-in and default off as specified, fetch weekly, parse off the event loop,
cache **only the four scalars** in the Store and never the blob, degrade
gracefully to no comparison. Everything the brief asked for except the word
percentile.

Cost: 1 MB weekly per install against Home Assistant's own CDN, for four
integers that a release could have carried for free.

**C. Drop the community comparison.**
The percentile cannot be honest and the ratio-to-mean is a smaller thing than
M7 promised. Spend the budget on #198 (`haus_tier_changed`) instead, which is
specified, unbuilt, and wanted a meaningful score first - which now exists.

**Ruled out: HAUS building its own distribution.** A real percentile needs the
spread, and the only way to get it is to collect scores from opted-in installs
into something HAUS runs. That is a server, an endpoint, a retention policy and
a privacy surface, for a custom integration whose entire privacy story so far
is that per-user counts never leave the instance. Not proportionate, and not
in M7's budget.

## Recommendation

**A**, then reconsider B only if the figures turn out to drift enough to matter.
It delivers everything the comparison can honestly deliver, at no runtime cost
and no privacy surface, and it removes an option the user would otherwise have
to understand.

Under every option, the card must say "the typical reporting install" and never
"percentile" or "top N%".

## Open questions for the human

1. A, B or C.
2. If A or B: does the comparison earn a place on the **hero card**, or is it a
   row on the breakdown card? The hero footer is already down to one nag
   plus the next action.
3. If A or B: which figures - automations, integrations and users are the three
   that map onto HAUS pillars; `avg_states` and `avg_addons` are also there.
