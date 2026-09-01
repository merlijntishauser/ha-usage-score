"""Constants for the HAUS integration.

Every tunable lives here with the reasoning behind its value, so retuning is a
one-line change that does not cascade into the tests. Tests assert on behaviour
(bounds, monotonicity, saturation), never on the specific numbers below.
"""

DOMAIN = "haus"

# Pillar weights. Hygiene is consumed from HAGHS rather than recomputed; the
# three owned pillars carry 70% between them so that HAUS remains meaningful,
# and comparable to itself, on an instance where HAGHS is not installed.
PILLAR_WEIGHTS: dict[str, float] = {
    "hygiene": 0.30,
    "usage": 0.30,
    "diversity": 0.25,
    "users": 0.15,
}

# The published score is always on a 0-100 scale, whatever the pillars do. A
# pillar that misbehaves must not be able to push the headline number off scale.
SCORE_MIN = 0
SCORE_MAX = 100

# Tier labels. This is the one place the playful framing belongs: the domain,
# entity ids and documentation stay neutral so the substantive claims the score
# makes are not dismissed along with the joke. Ordered by ascending threshold.
SCORE_TIERS: tuple[tuple[int, str], ...] = (
    (0, "Starter"),
    (40, "Tinkerer"),
    (60, "Enthusiast"),
    (80, "Power user"),
    (93, "Overengineered"),
)

# Knee of the saturating curve for the number of automations defined. Around a
# dozen automations is where an instance stops being a demo, so k=12 puts the
# 63% mark there and still gives the first few automations real weight. The
# usage pillar grows further in M1; this is the seed signal.
K_AUTOMATION_COUNT = 12.0

# Entity domain of automations. Spelled out rather than imported from
# homeassistant.components.automation, which would pull the whole component in
# for the sake of one string.
AUTOMATION_DOMAIN = "automation"

# Title of the single config entry, and the name of the service device the
# entities hang off.
INTEGRATION_TITLE = "HAUS"

# Coordinator refresh interval, in minutes. Everything collected is a registry
# or state read, so this is cheap; five minutes keeps the card feeling live
# without putting a pointless load on the event loop.
UPDATE_INTERVAL_MINUTES = 5

# Composition of the usage pillar. Firing is what this pillar claims to
# measure, so the fire rate carries the most weight and the raw count is only a
# supporting signal. The pillar is a weighted mean over whichever of these
# metrics is implemented, so the set grows without retuning the rest.
USAGE_METRIC_WEIGHTS: dict[str, float] = {
    "fire_rate": 0.30,
    "automation_count": 0.15,
    "scripts_scenes": 0.15,
}

# The window over which "did this actually get used" is judged, in days. Thirty
# days covers seasonal-ish routines without letting a rule that ran once in
# spring count as current use.
USAGE_WINDOW_DAYS = 30

# Attribute automations carry with the time they last ran.
ATTR_LAST_TRIGGERED = "last_triggered"

# Knee for the combined script and scene count. Ten between them is a house
# with a few one-touch routines, which is the behaviour this rewards.
K_SCRIPT_SCENE_COUNT = 10.0

# Entity domains for scripts and scenes.
SCRIPT_DOMAIN = "script"
SCENE_DOMAIN = "scene"
