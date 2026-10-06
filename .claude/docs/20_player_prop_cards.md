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

## 4. The arms, per position x market

Common frame, so the card reads the same everywhere:

1. **BASELINE** — the blended rate + % this season
2. **ROLE** — how much of the offence he is
3. **EFFICIENCY** — the position metric that drives *this* market
4. **MATCHUP** — defense allowance vs his position
5. **SCHEME** — his production vs the look this defense runs most
6. **SITUATION** — context (§5), or head-to-head history when a narrative is live

Sources: `P` = `nfl_prop_player_pages`, `G` = `nfl_player_game_logs`, `S` = `nfl_slate_props`,
`F` = FP warehouse (`data/fpdata`, see §6 — not yet wired).

### QB
| market | 1 BASELINE | 2 ROLE | 3 EFFICIENCY | 4 MATCHUP | 5 SCHEME | 6 SITUATION |
|---|---|---|---|---|---|---|
| pass yds | blended pass_yds/g (k=1.5) | `P.ngs.intended_air_yds` | `P.ngs.cpoe` | pass yds allowed to QBs | `P.scheme.player_splits.pressure` vs `look_focus` | §5 |
| pass TDs | blended pass_tds/g (k=4.25) | RZ pass share `F` | `P.ngs.aggressiveness` | pass TDs allowed | `player_splits.man` / `.zone` | §5 |
| pass attempts | blended attempts/g (k=1.0) | team pass rate over expected `F` | `P.ngs.time_to_throw` | plays allowed / pace | `player_splits.two_high` (shells invite throws) | §5 |
| rush yds | blended rush_yds/g (k=2.5) | designed-run share `F` | `P.ngs.time_to_throw` (scramble proxy) | rush yds allowed to QBs | `player_splits.blitz` | §5 |

### RB
| market | 1 BASELINE | 2 ROLE | 3 EFFICIENCY | 4 MATCHUP | 5 SCHEME | 6 SITUATION |
|---|---|---|---|---|---|---|
| rush yds | blended (k=2.5) | carry share `F` | `P.ngs.ryoe_per_att` | rush yds allowed to RBs | `P.scheme.rush_splits` vs `rush_look_focus` | §5 |
| rush attempts | blended (k=1.0) | carry share + `P.ngs.rz_carry_share` | `P.ngs.time_to_los` | rush attempts allowed | `scheme_game_splits.heavy_box` / `.light_box` | §5 |
| receptions | blended (k=2.75) | route share `F` | `P.ngs.efficiency` | receptions allowed to RBs | `player_splits.man` / `.zone` | §5 |
| anytime TD | blended total_td/g | `P.ngs.rz_carry_share` | goal-line share `F` | RZ TDs allowed | `scheme_game_splits.heavy_box` | §5 |

### WR / TE
| market | 1 BASELINE | 2 ROLE | 3 EFFICIENCY | 4 MATCHUP | 5 SCHEME | 6 SITUATION |
|---|---|---|---|---|---|---|
| receptions | blended (k=2.75) | `P.ngs.air_share` + route share `F` | `P.ngs.catch_pct`, `drop_rate` | receptions allowed to the position | `player_splits.man` vs `.zone` x `look_focus` | §5 |
| rec yds | blended (k=4.0) | target share `F` | `P.ngs.separation`, `yac_above_exp` | rec yds allowed | `player_splits` vs `look_focus` | §5 |
| targets | blended (k=2.25) | `P.ngs.air_share` | `P.ngs.cushion`, `adot` | targets allowed | `player_splits.two_high` | §5 |
| anytime TD | blended (k=4.25-ish) | `P.ngs.rz_tgt_share` | `P.ngs.created_rate` | RZ TDs allowed to position | `scheme_game_splits.single_high` | §5 |

⚠ `P.ngs` is populated for real contributors and EMPTY for deep bench players (verified: a WR4 has
`ngs: []`). An arm with no data **collapses** — it does not render a zero.

---

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

1. **Wire the FP research layer in.** `nfl_prop_player_pages.research` is NULL and the column that
   should carry FP (`fp_edge`) is carrying the projection model instead. Every `F` source above
   depends on this. The warehouse exists (`data/fpdata`, 2021+); it is not reaching the page.
2. **Extend the narratives engine to every prop** so each one carries its data, while the GRADED
   picks stay only those the regression report selects.
3. **Add the blend + weight** to the page payload (k table in §2), with the rookie flag.
4. **Add the situational splits** (home/away, primetime, divisional) and the three narrative
   triggers with their historical records.
5. **Keep head-to-head as history** with its n, styled apart from projections.
