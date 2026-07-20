# Systems — Data Availability Audit (can we power every filter?)

Verifies whether the raw data exists to compute each filter in `02_FILTER_TAXONOMY_OURS.md`. Ground truth =
actual column schemas of our source tables/parquet (read 2026-07-18), not memory.

## Headline finding

**Almost no filter needs new data purchased.** The work sorts into three kinds:
- ✅ **Materialized** — already a column in source / already handled by the current RPC. Just wire the filter.
- 🟨 **Computable** — the raw ingredients (scores, spreads, totals, box stats) already exist; the feature
  just isn't aggregated yet. A leak-safe feature-engineering pass, **no new data**.
- 🧱 **Infra-gated** — data exists in parquet but the sport isn't in Supabase yet (NBA, NCAAB). Needs a
  warehouse table + RPC before *any* of its filters work.
- ❓ **Verify** — depends on a source we couldn't inspect locally (MLB box stats; starter feeds).
- ⛔ **Not kept** — we deliberately don't hold this data (CFB officials).

The two flagship sports (NFL, CFB) are in the best shape: their model/training parquet already precompute a
large share of the "as-of-game" features leak-safe.

---

## What each sport already has (verified from schemas)

### CFB — `model_games.parquet` (191 cols) + `teamgame_box_YYYY` (2016–2025)
**Already materialized:** `days_rest`, `off_bye`, `short_week`, `win_streak`, `consec_home`, `consec_away`,
`last_margin`, `last_win`, `last_pts_for/against`, `last_total`, `last_blowout_win/loss`, `self_rank`,
`ranked_matchup`, `cur/next/last_opp_net`, `homeConference/awayConference`, `conferenceGame`,
`first_conf_game`, `neutralSite`, `elo/talent/net_rating (+diffs)`, and a full season-to-date efficiency set
(`points_pg`, `pass_yds_pg`, `first_downs_pg`, `plays_pg`, `pressure_pg`, `adj_epa`, `adj_passing/rushing_epa`
±allowed, pace).
**Computable (raw in hand):** season win %, ATS win %/streak, over %/under %/streak, points-allowed/g,
prior-season W-L/win%/made-playoffs, head-to-head history — all derivable from `model_games` game rows +
`teamgame_box` (points, pass/rush att+yds, plays, turnovers, first downs).

### NFL — `training_epa.parquet` (106 cols) + nfl_data_py box
**Already materialized:** `last_spread/ou/ml/points/allowed_points`, `cover_streak`, `win_streak`,
`consecutive_home_away`, `days_between_games` (rest), `favorite/underdog_covered`, `spread_cover`, `ou_result`,
`conference_game`, `league_game`, power ratings (`sos_pr`, `predictive_pr`, `last5_pr`, `consistency_pr`), and
season-to-date EPA (`pass_epa_s2d`, `rush_epa_s2d`, `def_*_epa_s2d`, `*_last3`).
**Computable:** season win %, ATS win %, over %/under % rates, raw PPG/PA averages, prior-season records,
head-to-head — from game rows (scores + spreads + totals all present) + nfl_data_py box for yards/TD splits.

### MLB — `mlb_analysis_base` + RPC (2023+ only)
**Already supported by RPC:** rest, win/loss streak (`streak_min/max`), series game #, trip index, switch
game, month, fav/dog, ML/total ranges, last margin, last result, **starting pitcher hand + xFIP** (team &
opp), bullpen xFIP/IP, park factor, temp/wind/dome, division, interleague, doubleheader.
**Computable / ❓verify:** season win %, over %/under % rates, prior-season, head-to-head → computable from
`mlb_game_log`. Batting avg / slugging / ERA season stats → **❓ need to confirm MLB box columns exist** (no
local parquet; lives in Supabase). If absent, ship MLB without the Season-Stats tab.
**Caveats (from coverage doc):** F5 ML/RL have no historical odds (proxy); everything 2023+ (shallow).

### NBA — `results` + `movement_games` (open/T24/T4/T60 odds) + `style_nba` + box; **parquet only**
Raw scores + H1 + full odds movement + advanced box (pace, 3PT, four factors) all exist 2022-23→2025-26.
**Every filter is Computable — but 🧱 infra-gated:** nothing is aggregated into an as-of-game table and none
of it is in Supabase. Needs a warehouse build (parquet → base table + RPC) before any NBA filter functions.

### NCAAB — `results` (+ neutral_site, game_type) + `movement_games` + `cbbd_team_box` (96 cols); **parquet only**
`cbbd_team_box` is rich: conference, tournament, seed, neutralSite, gameType, four factors, eFG%, 3PT, FT,
rebounds, possessions. Everything Computable, same 🧱 infra gate as NBA. Conference/tournament-round filters
map directly onto `conference` + `tournament`/`gameType`/`teamSeed` columns.

---

## Filter-group × sport availability matrix

Legend: ✅ materialized · 🟨 computable (aggregate, no new data) · 🧱 infra-gated (needs warehouse) ·
❓ verify · ⛔ not kept · — n/a

| Filter group | NFL | CFB | MLB | NBA | NCAAB |
|---|---|---|---|---|---|
| Game & Situation (season/week/home/away/reg) | ✅ | ✅ | ✅ | 🧱 | 🧱 |
| Neutral site | — | ✅ | — | 🧱 | 🧱 (✅col) |
| Schedule (date/time/primetime/day-of-week) | ✅ | ✅ | ✅ | 🧱 | 🧱 |
| The Line (spread/ML/total/RL, fav/dog) | ✅ | ✅ | ✅ | 🧱 | 🧱 |
| Postseason (rounds / series / tourney) | ✅ | 🟨 | ✅ | 🧱 | 🧱 |
| Team/Opp & Rest (rest, rest edge) | ✅ | ✅ | ✅ | 🧱 | 🧱 |
| Recent Form: last result/ATS/OU/role | ✅ | ✅ | ✅ | 🧱 | 🧱 |
| Recent Form: consec home/road (homestand) | ✅ | ✅ | 🟨 | 🧱 | 🧱 |
| Recent Form: last pts/margin/spread/total | ✅ | ✅ | 🟨 | 🧱 | 🧱 |
| Head-to-Head (last meeting chain) | 🟨 | 🟨 | 🟨 | 🧱 | 🧱 |
| Prior Year (records / made playoffs) | 🟨 | 🟨 | 🟨 | 🧱 | 🧱 |
| Season Record (win %, streaks, >.500) | 🟨¹ | 🟨¹ | ✅² | 🧱 | 🧱 |
| Cover Profile (ATS win %, ATS streak, margin) | 🟨¹ | 🟨 | — | 🧱 | 🧱 |
| Total Profile (over %/under %, streaks) | 🟨 | 🟨 | 🟨 | 🧱 | 🧱 |
| Season Stats (yds/g, FG%, batting, etc.) | 🟨 | ✅³ | ❓ | 🧱 | 🧱 |
| Conference & Division membership | ✅ | ✅ | ✅ | 🧱 | 🧱 |
| Ranked matchup | — | ✅ | — | — | 🧱 |
| Starters (QB / Pitcher) | ❓⁴ | ⁴ | ✅ | — | — |
| Officials (referee) | ❓ | ⛔ | — | — | — |

¹ Win/cover **streaks** already materialized; season-to-date **rates** (win %, ATS %) need aggregation.
² MLB RPC already exposes win/loss streak; win %/over % rates would still need adding.
³ CFB has many per-game stats precomputed (`points_pg`, `pass_yds_pg`, …); a few counting stats need box agg.
⁴ MLB pitcher = ✅ in RPC. NFL QB = ❓ (needs starter feed). CFB QB feed built but not live ([[cfb-qb-injury-trigger]]).

---

## Prioritized data work to unlock the full filter set

1. **As-of-game aggregation for NFL + CFB** (unlocks the most, data 100% in hand): materialize season-to-date
   win %, ATS win %/streak, over %/under %/streak, PPG/PA, prior-season records, and head-to-head history onto
   the existing base/model tables. Leak-safe (only games before kickoff). This turns almost every 🟨 → ✅ for
   the two deepest-history sports.
2. **Verify MLB box** (batting avg / slugging / ERA). If present → add Season-Stats + rate filters; if not →
   ship MLB with the rich situational set it already has, minus Season-Stats.
3. **Warehouse NBA + NCAAB** (the one true infra project): parquet → Supabase base table + RPC, *including* the
   same as-of-game aggregation. Gates both sports entirely; largest single lift.
4. **Starters:** wire MLB pitcher (done in RPC), NFL QB starter feed, CFB QB feed when live.
5. **Drop the Officials tab for CFB** (referee data not kept); confirm NFL referee availability before offering
   it there.

## Bottom line
Every filter in our taxonomy is powerable from data we **already own** — the gaps are *aggregation* and
*warehousing*, not acquisition. NFL & CFB can reach near-full parity with a feature-engineering pass on tables
that already exist; MLB is largely there for situational filters; NBA & NCAAB need the warehouse build first.
