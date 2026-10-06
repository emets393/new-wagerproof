# Defensive tendencies we can get per game — the inventory

**Written 2026-10-06.** The owner's instinct was right: almost everything useful about a defense is
reachable from GAME-LEVEL Fantasy Points data we already pull. Play-by-play is not required.

Two kinds of source:
* **Opponent scope** (`<tool>__opponent.parquet`) — the tool computed as "what this defense
  allowed", one row per defense-game. Already pulled weekly.
* **Player scope aggregated by `opponentAbbreviation`** — every player-scope row carries the
  opponent, so grouping by it yields a defensive view the API never exposes directly. This is how
  the route- and alignment-level tendencies are obtained. No new pull, no tier upgrade.

---

## 1. What the defense RUNS — `coverageMatrix__opponent` (20 metrics)
Per defense-game, share of dropbacks in each shell:
`CoverageSchemeMan/Zone…Percentage`, `Cover0/1/2/3/4/6`, `Cover2Man`, `SingleHigh`, `TwoHigh`,
plus the raw dropback counts behind each.
→ This is the "what do they play" half of every matchup read. Pair it with the production numbers
in §6: man-heavy defenses are the exploitable ones (2.54 yds/route allowed vs zone's 1.86).

## 2. Pass defense ALLOWED — `passingAdvanced__opponent` (48)
`CompletionsOverExpected`, `AttemptsCatchablePercentage`, `CompletionsAdjustedPercentage`,
`YardsPerAttempt`, `YardsAfterCatchPercentage`, `YardsAirTotal`, `AttemptsInEndzoneTotal`,
`SackedPercentage`, `SackedAvoidedTotal`, `DropsPercentage`, `InterceptionsTotal`.
→ Separates a defense that suppresses *accuracy* from one that suppresses *yards after*.

## 3. Run defense ALLOWED — `rushingAdvanced__opponent` (35)
`AttemptsStuffsPercentage`, `AttemptsSuccessPercentage`, `YardsBeforeContactPerAttempt`,
`YardsAfterContactPerAttempt`, `RunsExplosivePercentage`, `MissedTacklesForcedPerAttempt`,
`TouchdownsPercentage`, **and by run concept** — `ConceptZoneAttempts/Yards/Success` vs gap.
→ Before-contact vs after-contact splits the front from the tackling, which is the read that
matters for a rush-attempts prop vs a rush-yards prop.

## 4. Receiving ALLOWED — `receivingAdvanced__opponent` (44)
`TargetsPerRoute`, `TargetsCatchablePercentage`, `TargetsContestedTotal`, `TargetsInEndzone`,
`ReceptionsPercentage`, `YardsAfterCatchTotal`, `MissedTacklesForcedPerReception`,
**and allowed target share BY ALIGNMENT** —
`ReceivingAlignmentSlot/Inline/BackfieldTargetsPercentage`.

## 5. Pace, volume and trenches
`proeReport__opponent` — `SnapsOffenseTotal`, `PassingDropbacksTotal`, `PassingDropbacksExpected`
→ PROE *faced*, i.e. do offences pass more than expected against them.
`lineMatchups` — `PassingPressuredPercentage`, `PassingPressuredOverExpected`,
`RushingYardsBeforeContactTotal`.

## 6. ★ Derived by aggregating player rows on `opponentAbbreviation`
These are the ones that feel like they need play-by-play and do not.

**Defense vs ROUTE** — group `receivingSeparationByRoutes__player` by opponent and route bucket.
85,038 (defense, game, route) cells for 2023-25, all 32 defenses. Yards per route allowed against
that route's league average:

| route | league | stingiest | leakiest |
|---|---|---|---|
| Post | 11.60 | BLT −3.47 | **HST +7.69** |
| Go | 7.32 | NE −2.30 | CHI +2.16 |
| Slant | 5.78 | BLT −1.33 | **NE +2.03** |
| Crossers | 4.94 | DEN −0.89 | PIT +1.32 |
| Out | 4.32 | SEA −0.80 | CIN +2.15 |

★ New England is the **stingiest versus Go and the leakiest versus Slant**. And the weaknesses are
largely independent — corr across defenses: Go/Slant −0.03, Go/Crossers −0.06, Slant/Out +0.47. So
"this defense is bad against the pass" is far too coarse; the route is the read.

**Defense vs ALIGNMENT** — group `player_receiving-routes-run` by opponent on the alignment
columns. Slot yards allowed ranges 48-98/game, wide 76-127, and **corr(slot, wide) = +0.14**.

**Defense vs POSITION** — `fantasyPointsAllowed__player` by `playerPosition`.

**Defense vs COVERAGE SHELL (production)** — group `receivingManVsZone__player` by opponent on the
`bucketMan/Zone/SingleHigh/TwoHigh` dicts. League-wide, weighted by routes: man 2.536 yds/route,
single-high 2.075, two-high 1.866, zone 1.861.

---

## What is still genuinely out of reach
**The INTERACTION** — "is two-high specifically leaky to posts, and does that grow with
separation". §6 gives route-level and shell-level allowances *separately*; crossing them needs
coverage, route and separation on one row with real play yardage, which the API will not serve at
our role (see `21_fp_play_level_pull_scope.md`). Everything else above is available today.

⚠ Build every one of these as an ENTERING-GAME mean shrunk toward the league average, same as the
player baselines in `20_player_prop_cards.md` §2. A defense's "weakness" after two games is noise.
