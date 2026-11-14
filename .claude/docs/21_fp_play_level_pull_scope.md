# Scope: getting coverage × route × separation out of Fantasy Points

**STATUS: SCOPED, not started.** Written 2026-10-06 after probing the live API.

## The question this unblocks
"Is a two-high shell more susceptible to a post route, and does that grow when the receiver
creates separation?" Answering it needs **coverage, route family, separation and the play's
yardage on the same row**. Nothing we hold has all four with usable production.

## What we have, and why it is not enough
| source | rows | has | missing |
|---|---|---|---|
| `receivingManVsZone__player` | 73.7/game | Man / Zone / SingleHigh / TwoHigh × routes, TPR, YPR | route family |
| `receivingSeparationByRoutes__player` | 73.7/game | 12 route families × routes, TPR, separation-win % | coverage |
| `player_receiving-routes-run` | 158/game | coverage + route + separation on one row | **usable production** |

The third looks like the answer and is not. Across SIX seasons it holds **4,343 targeted
route-plays** (~700/yr); an n≥150 filter leaves **two** route families. And its
`AveragesPerRouteYardsTotal` is a player-level rate, not the play's yardage — it ranks
**Wide Open 1.60 BELOW Tight 1.73 and Closing 1.82**, which is impossible as a play outcome.
Any cross-tab built on it looks plausible and is fiction.

## What was probed, and what came back
Request shape (from `fp_pull.py`): `POST /v2/ds/nfl/tools/<scope>/<slug>/values` with a `context`
carrying `filterMatch`, **`filterPlay`**, `filterResult`, **`qualifiers`**, **`splits`** and
`requiresPlayByPlay`. We have only ever sent the play-level knobs EMPTY. Response path is
`content.rows.values` (not `data`).

Probe on `receivingSeparationByRoutes`, 2025 wk5, baseline = 1,028 rows / 4,474 routes:

| knob sent | result |
|---|---|
| `filterPlay: {play.defenseCoverageSchemeParent = "Cover 2"}` | **1,028 rows / 4,474 routes — identical.** Accepted, silently ignored |
| `filterPlay: {MOF pre = "Open"}` | identical |
| `filterPlay: {route family = "Post"}` | identical |
| `requiresPlayByPlay: true` | identical |
| `splits: {...}` | **0 rows**, no error |
| `qualifiers: {...}` | **0 rows**, no error |

⛔ So the server either ignores the play knobs at our role or rejects the key shape without
saying so. Guessing further body syntax is not a plan.

Our roles: `role_uJb30OfZpu4pFfS7VQEq` (+ anonymous/authenticated). **18 tools are gated behind
`role_oBzJymzDetdpkUr0gfXD`**, including `passingManVsZone`, `receivingTargets`,
`targetDistribution`, `pressureReport`, `personnel`, `gameLogs`.

## ⚠ AMENDED 2026-10-06 — most of this is reachable WITHOUT the pull
The owner pushed back: defensive tendencies should come from game-level data we already have. They
were right, and it narrows this scope sharply. Player-scope rows all carry `opponentAbbreviation`,
so grouping by it yields **defense vs route** (85,038 cells, 2023-25, all 32 defenses — HST allows
+7.69 ypr on posts, NE is stingiest on Go and leakiest on Slant), **defense vs alignment**, and
**defense vs coverage shell**, with no new pull and no tier upgrade. See
`22_defensive_tendencies_available.md`. What remains out of reach is only the INTERACTION
(coverage x route x separation on one row). The paths below apply to that alone.

## Three paths

**A — copy the request out of the FP web app (do this first).** Their site renders coverage and
route splits; open it, apply the split, read the network tab, copy the exact `context`. The
`FP_DATA_TOKEN` already came from the browser this way, so the path is proven. Cost: ~30 minutes,
no money. Settles whether the cross-tab is reachable at our tier or genuinely gated.
Deliverable: one captured body, then `fp_pull.py` gains a `--splits` mode.

**B — upgrade the subscription** to the role above. Unlocks 18 tools, several of which
(`passingManVsZone`, `receivingTargets`, `targetDistribution`) are likely to carry the cross
directly. Cost: unknown, owner decision. Only worth doing if A shows it is gated.

**C — ship without the cross.** Both main effects are already measured and usable:
man 2.54 yds/route vs zone 1.86 (RBs +46%), two-high the LEAST susceptible shell; and route-level
production + separation-win per route family. The prop card's route tree works on these — branches
from his top 3 routes, threat colour from the defense's season-long record against those routes.
Cost: zero. What is lost is only the interaction ("two-high specifically leaks posts").

## Recommendation
**A, then C while A is pending.** The card does not block on this: route tree and shell tailwind
both ship from data in hand. Do B only if A proves the gate is real AND the interaction is worth
paying for — and note the interaction is untested, so its value is unknown. Nothing here should be
built on `player_receiving-routes-run`'s yardage column.

## Validation gate for whichever path lands
Before any coverage × route number reaches a card: the filtered route totals must **sum back to
the unfiltered total** per player-week, and the league mean must match the known overall rate.
The first pass at this produced "PIT allows 48 Go routes per game" — the cube double-counts across
its split dimensions, and that is the number the gate exists to catch.
