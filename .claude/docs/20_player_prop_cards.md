# Player prop cards — data spec

**STATUS: SPEC, not built.** Owner-approved 2026-10-06. Cursor builds the visual; this document
decides what data each arm shows and where it comes from. Every number below is either a column
that exists today or a derivation defined here — nothing is aspirational.

The layout: player headshot + name in the centre, up to **SIX arms** radiating out. The arms change
with the market you select. Six is a hard cap: a seventh turns a card into a dashboard.

---

## 1. Picks vs data — the contract

**Only the props the regression report selects are PICKS, and only those get graded.** Everything
else on the page is data for the user to read. This is deliberate: it is the one prop logic with a
measured record (`nfl_prop_narratives`, 22-13 / 62.9%), and the only one carrying a `result`
column at all.

The three other logics are NOT picks and must never render as one:
* the projection model reaches the board in the column named `fp_edge` and grades **50.5%**
  (336-329) against the close — a coin flip
* `nfl_slate_props.model_edge` is NULL on every row ever written
* the P-flags barely fire (P8 n=52, P17 n=25, P18 n=11)

See `.claude/docs/` sibling note and the `nfl-prop-logics-audit` memory. A projection may be shown
as a number; it may not be shown as a recommendation.

---

## 2. The baseline number — fitted, not guessed

Every market's headline arm is a **blended per-game rate**:

```
blended = (n * this_season_mean + k * last_season_mean) / (n + k)
```

`n` = games already played this season. `k` is fitted per market by out-of-sample error
(`research/nfl-extreme-outcomes/prop_blend_fit.py`, 13,475 player-games 2024-26):

| market | k | weight on THIS season at 1g / 3g / 6g / 12g |
|---|---|---|
| pass attempts | 1.00 | 50% / 75% / 86% / 92% |
| rush attempts | 1.00 | 50% / 75% / 86% / 92% |
| pass yds | 1.50 | 40% / 67% / 80% / 89% |
| targets | 2.25 | 31% / 57% / 73% / 84% |
| rush yds | 2.50 | 29% / 55% / 71% / 83% |
| receptions | 2.75 | 27% / 52% / 69% / 81% |
| rec yds | 4.00 | 20% / 43% / 60% / 75% |
| pass TDs | 4.25 | 19% / 41% / 59% / 74% |

Volume stats flip to the current season almost immediately (role settles fast); yardage and TDs
lean on last year far longer (one game of yards is mostly noise). The blend beats season-to-date
alone by 3.2-7.7% RMSE and last-season alone by 4.0-15.4%.

**The arm must print the weight**, e.g. `58.4 yds/g · 43% this season`. The user sees how current
the number is instead of trusting a bare average.

### Rookies — mark them
No prior season means the blend degrades to a raw current-season mean over 1-4 games. **Any arm
whose baseline has no prior-season component renders with a `ROOKIE · n games` tag** and must be
visually lighter than a veteran's. This is where a confident-looking number is most wrong.

---

## 3. "Against this defense" is HISTORY, not a projection

Measured (`prop_vs_defense_fit.py`): a player's own prior meetings with a defense are the WORST of
three predictors in **every** market — 22-35% worse RMSE than simply using his baseline.

| market | baseline | baseline x defense | vs THAT defense |
|---|---|---|---|
| rec yds | 24.27 | 24.27 | **31.96** |
| receptions | 1.80 | 1.79 | **2.38** |
| pass yds | 85.08 | 84.85 | **103.40** |
| rush yds | 25.34 | 25.50 | **34.04** |

He faces them once or twice a year; that mean is noise. So:

* **Head-to-head renders as history with its sample size** — `vs DET: 6 rec, 71 yds (1 game, 2024)`
  — in a visually distinct style from any projection. Never a bare number that implies expectation.
* **The matchup arm uses the DEFENSE'S ALLOWANCE to the position**, shrunk toward the league mean
  (prior worth ~20 player-games). Roughly neutral in error terms, but honest and stable.
* If there is no prior meeting, the arm says **"First meeting"** rather than rendering empty.

---

## 4. The arms, per position x market — FANTASY POINTS FIRST

**Owner rule: almost everything comes from Fantasy Points.** A first draft of this spec leaned on
NFL Next Gen Stats (`cpoe`, `time_to_throw`, `separation`, `cushion`) because those are what
`nfl_prop_player_pages.ngs` already carries. That was wrong: FP is the charted data people care
about, and we hold **39 player-level FP tables, 2021-2026**, in `research/nfl-extreme-outcomes/data/fpdata`.
NGS is the FALLBACK when an FP field is thin, never the first choice.

### How the FP player tables are shaped
* One row per **player-game**, wide: splits live in column names
  (`playerStatsReceivingAlignmentSlotRoutesTotal`).
* The split tables carry a **`bucket` dict** keyed `bucketOverall`, `bucketMan`, `bucketZone`,
  `bucketSingleHigh`, `bucketTwoHigh`, and it goes down to PLAY level — `playDownNumber`,
  `playStartClockQuarter`, `playOffensePersonnelKey`, `playDefenseCoverageSchemeParent`,
  `playPlayerAlignmentSide`. Quarter/down/personnel splits are therefore available, not aspirational.
* `marketShare*` columns are already the player's share of his own team — use them directly rather
  than dividing by a team total.
* ⚠ Join on `playerPlayerId` (FP's own id) via `fpdata/player_crosswalk.parquet`. FP uses `BLT` for
  Baltimore and `LA`/`LAR` inconsistently — the crosswalk is the only safe path.

### Source tables (all `fpdata/`)
| short | file | what it gives |
|---|---|---|
| SNAP | `offenseSnaps__player` | `marketShareSnapsOffenseTotal/Pass/Rush`, team `Inside5/10/20SnapsOffenseTotal` |
| ROUTE | `receivingRoutesRun__player` | `marketShareReceivingAlignmentSlot/Wide/BackfieldRoutesTotal` — **where he lines up** |
| TGT | `receivingTargetShareReport__player` | `marketShareReceivingTargetsTotal` |
| RECADV | `receivingAdvanced__player` | `TargetsPerRoute`, `TargetsCatchablePercentage`, `TargetsContestedTotal` |
| MVZ | `receivingManVsZone__player` | per `bucket`: `TargetsPerRoute`, `AveragesPerRouteYardsTotal` |
| SEPC | `receivingSeparationByCoverage__player` | per `bucket`: `ReceivingSeparationRoutesTotal` |
| QBCOV | `qbCoverageMatchup__player` | `CoverageSchemeMan/Cover2/Cover3 FantasyPointsPprTotal` + `DropbacksPercentage` |
| PDEPTH | `passingDepth__player` | depth-of-target buckets, `PassingHeroThrowTotal`, `AttemptsCatchablePercentage` |
| RUSHC | `rushingConcepts__player` | `RushingAttemptsStuffsPercentage`, `SuccessPercentage`, `ScrimmageTouchdownsExpectedTotal`, `XfpPprTotal` |
| RUSHB | `rushingBasic__player` | `RunsOneOrMore/ThreeOrMore/FiveOrMore/TenOrMore/FifteenOrMorePercentage` — **consistency** |
| BELL | `rushingBellCow__player` | player share of team snaps / routes / targets / XFP |
| ALLOW | `fantasyPointsAllowed__player` | what the opponent allows **to that position** — the matchup arm |

### ★ DEF_ALIGN — the defense against WHERE HE LINES UP, not just his position
`player_receiving-routes-run` carries per-alignment **targets and yards** on every player-game
(`playerStatsReceivingAlignmentSlot/Wide/Inline/BackfieldTargetsTotal` and `…YardsTotal`) with
`opponentAbbreviation` on the row. Group by opponent and you get, per game, what that defense
surrenders to slot vs wide vs inline vs backfield receivers. `receivingSeparationByAlignment__player`
adds separation allowed per alignment via its `bucket` dict
(`bucketReceivingSeparationSlot/Wide/Inline/Backfield`).

**This is not a cosmetic split — it is a different matchup.** Measured on 2025:

| defense | slot yds/g allowed | wide yds/g allowed |
|---|---|---|
| GB | **48.5** | 108.9 |
| MIN | 50.1 | 88.0 |
| WAS | **98.4** | 98.4 |
| PIT | 89.8 | 111.0 |

League spread: slot 48-98, wide 76-127, and **corr(slot, wide) across defenses = +0.14**. A defense
that smothers the slot is close to uninformative about the boundary. So a slot receiver facing GB
and a boundary receiver facing GB are opposite bets, and a position-only allowance would call them
the same. ⚠ Weight the arm by HIS alignment share (ROUTE `marketShareReceivingAlignmentSlotRoutesTotal`
etc.) — a 70%-slot receiver reads the slot number; a balanced one reads a blend of both.

### ★ THE PLAYSHEET + ROUTE TREE (owner, 2026-10-06)
Two interactive pieces sit beside the arms, both straight out of FP.

**Where he lines up — a field diagram.** `player_receiving-routes-run` carries
`playPlayerAlignmentFamily` ∈ {**Backfield, Inline, Slot, Wide**} and `playPlayerAlignmentSide` ∈
{**Left, Right**} — eight renderable spots. Weight each spot by his route count there and the
diagram IS his alignment profile: a boundary X lights up Wide-Left, a movable slot lights up four.
Hover a spot -> his production from it (`playerStatsReceivingAlignment{Slot,Wide,Inline,Backfield}
{Routes,Targets,Yards}Total`) and what this defense allows there (DEF_ALIGN).

**What he runs — a route tree.** `playPassTargetedRouteFamily` has **18 families**: Go, Post,
Corner, Slant, Hitch, In, Out, Comeback, Flat, Wheel, Screen, Flare, Mid/Deep Cross,
Shallow Cross/Trick, End Zone Fade, Backfield Out, Backfield Screen, Circle/Texas. Size each branch
by his target share on it. `receivingSeparationByRoutes__player` gives separation per route through
its `bucket` dict (`bucketReceivingSeparationRouteGo`, `…Slant`, `…InDig`, `…Post`, `…Corner`,
`…Out`, `…Hitch`, `…Crossers`, `…Flat`, `…Screens`, `…Comeback`, `…Backfield`, `…Overall`).
Per-target separation is graded `playPassReceiverSeparationName` ∈ {Tight, Step, Closing, Open,
Wide Open} — colour the branch by how open he gets on it.

**⛔ DEFENSE-vs-ROUTE NEEDS A VALIDATED DENOMINATOR BEFORE IT SHIPS.**
`player_receiving-routes-run` is a LONG-FORMAT CUBE: alignment, route family, coverage scheme and
separation are all split dimensions **in the same file**, so one target appears in several rows.
Summing across it double-counts — a naive group-by produced "PIT allows 48 Go routes per game",
which is impossible. Build defense-vs-route from the dedicated bucket table
(`receivingSeparationByRoutes__player`) or by filtering the cube to ONE dimension at a time, and
sanity-check the league mean against a known total before it reaches a card.
⚠ FP team codes differ: **ARZ** not ARI, **BLT** not BAL, **CLV** not CLE, **HST** not HOU.
Go through `player_crosswalk.parquet`; a raw join silently drops those teams and reads as 0.0.

Common frame, so every card reads the same:
**1 BASELINE · 2 ROLE · 3 EFFICIENCY · 4 MATCHUP · 5 SCHEME · 6 SITUATION**
Arm 4 carries BOTH halves: *vs his position* (ALLOW) and *vs his alignment* (DEF_ALIGN).
The playsheet and route tree are the interactive centre, not arms — they do not count against six.

### QB
| market | 1 BASELINE | 2 ROLE | 3 EFFICIENCY | 4 MATCHUP | 5 SCHEME | 6 SITUATION |
|---|---|---|---|---|---|---|
| pass yds | blended (k=1.5) | SNAP `marketShareSnapsOffensePass` | PDEPTH `AttemptsCatchablePercentage` + aDOT | ALLOW pass yds to QB | QBCOV ppr vs the coverage this D runs most | §5 |
| pass TDs | blended (k=4.25) | SNAP team `Inside10SnapsOffenseTotal` | PDEPTH `PassingHeroThrowTotal` | ALLOW pass TDs to QB | QBCOV `CoverageSchemeMan…` vs `…DropbacksPercentage` | §5 |
| pass attempts | blended (k=1.0) | SNAP `marketShareSnapsOffensePass` | PDEPTH `PassingDropbacksTotal` per game | ALLOW dropbacks faced | QBCOV two-high share (shells invite throws) | §5 |
| rush yds | blended (k=2.5) | RUSHC `RushingAttemptsTotal` share | RUSHC `SuccessPercentage` | ALLOW QB rush yds | QBCOV pressure/blitz label split | §5 |

### RB
| market | 1 BASELINE | 2 ROLE | 3 EFFICIENCY | 4 MATCHUP | 5 SCHEME | 6 SITUATION |
|---|---|---|---|---|---|---|
| rush yds | blended (k=2.5) | BELL share of team rush attempts | RUSHB `RunsFiveOrMorePercentage` | ALLOW rush yds to RB | RUSHC `StuffsPercentage` vs this front | §5 |
| rush attempts | blended (k=1.0) | SNAP `marketShareSnapsOffenseRush` | RUSHC `SuccessPercentage` | ALLOW rush attempts | SNAP team `Inside5SnapsOffenseTotal` share | §5 |
| receptions | blended (k=2.75) | ROUTE `marketShareReceivingAlignmentBackfieldRoutesTotal` | RECADV `TargetsPerRoute` | ALLOW receptions to RB **+ DEF_ALIGN backfield** | MVZ `bucketMan` vs `bucketZone` TPR | §5 |
| anytime TD | blended | SNAP team `Inside5/10SnapsOffenseTotal` share | RUSHC `ScrimmageTouchdownsExpectedTotal` | ALLOW RZ TDs | RUSHC `StuffsPercentage` | §5 |

### WR / TE
| market | 1 BASELINE | 2 ROLE | 3 EFFICIENCY | 4 MATCHUP | 5 SCHEME | 6 SITUATION |
|---|---|---|---|---|---|---|
| receptions | blended (k=2.75) | TGT `marketShareReceivingTargetsTotal` | RECADV `TargetsPerRoute`, `TargetsCatchablePercentage` | ALLOW receptions to position **+ DEF_ALIGN targets allowed to his alignment** | MVZ `bucketMan`/`bucketZone` TPR vs this D's rate | §5 |
| rec yds | blended (k=4.0) | ROUTE slot / wide / backfield share — **where he lines up** | MVZ `AveragesPerRouteYardsTotal` | ALLOW rec yds to position **+ DEF_ALIGN yds allowed to his alignment** | SEPC separation vs this D's main coverage | §5 |
| targets | blended (k=2.25) | TGT share + ROUTE `marketShareReceivingRoutesTotal` | RECADV `TargetsContestedTotal` | ALLOW targets to position **+ DEF_ALIGN** | MVZ `bucketSingleHigh`/`bucketTwoHigh` | §5 |
| anytime TD | blended | SNAP team `Inside10/20SnapsOffenseTotal` share | RUSHC/`XfpPprTotal` expected TDs | ALLOW RZ TDs to position | SEPC separation inside 20 | §5 |

⚠ An arm with no FP data **collapses — it never renders a zero.** Deep-bench players have empty
rows, and a zero reads as data. Fall back to `nfl_prop_player_pages.ngs` only where noted.

## 5. Situation — context only, never an input

Owner call: situational facts are **displayed, not bet**. (Measured the same day: situational
features were net-NEGATIVE as model inputs for totals.) Arm 6 cycles through whichever applies,
most specific first:

1. **Special narrative live** (see below) — always wins the slot
2. **Home / away** split for this player, this market
3. **Primetime** (Thu/Sun night/Mon) vs normal window
4. **Divisional** vs non-divisional

Each renders as `split value · his record in that spot (n)`. Below ~4 games the arm shows the
count and greys the value: a 1-game "split" is not a split.

### Special narratives
These trigger per player-game and take the slot when live:
* **Birthday** — game falls on his birthday
* **Revenge game** — away at a former team's stadium
* **Homecoming** — away game in his hometown / college state

Each shows **how he has done in that spot historically** with the sample: `3 prior revenge games:
5.3 rec, 64 yds`. **If it is the first time, the arm says so explicitly** — "First trip back" —
rather than printing an empty or zero split. Half of the value here is that the user knows it is
the first time.

---

## 6. What has to be built before this ships

1. **Wire Fantasy Points into the page payload — this is the whole job.** Every arm in §4 reads an
   FP table. Today `nfl_prop_player_pages.research` is NULL and the column that should carry FP
   (`fp_edge`) is carrying the projection model instead, so NONE of it reaches the client. The
   warehouse exists (39 player tables, 2021-2026, `data/fpdata`) and is loaded weekly by
   `fp_pull.py` / `fp_load.py`. Build a per player-week FP payload keyed by `playerPlayerId`
   through `player_crosswalk.parquet`, entering-game (shift(1)) like every other feature here.
2. **Extend the narratives engine to every prop** so each one carries its data, while the GRADED
   picks stay only those the regression report selects.
3. **Add the blend + weight** to the page payload (k table in §2), with the rookie flag.
4. **Add the situational splits** (home/away, primetime, divisional) and the three narrative
   triggers with their historical records.
5. **Keep head-to-head as history** with its n, styled apart from projections.
6. **Build the playsheet + route tree payload**: alignment family x side route counts, his route
   mix by family, separation per route, and the defense's allowance on both — denominator
   validated per the cube warning above.
7. **Build DEF_ALIGN** as a derived weekly table: group `player_receiving-routes-run` by
   (season, week, opponent) summing alignment targets/yards, then take the entering-game mean per
   defense, shrunk toward the league mean like any other allowance. Join separation allowed from
   `receivingSeparationByAlignment__player`. Weight by the player's own alignment share.
