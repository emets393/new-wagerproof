# Spec — NFL + CFB As-Of-Game Aggregation

**Goal:** materialize the season-to-date "at the time of the game" features onto the existing
`nfl_analysis_base` / `cfb_analysis_base` tables so the Systems Bucket-C filters (Season Record, Cover
Profile, Total Profile, Prior Year, Head-to-Head, Season Stats) work — **using only data we already own**,
computed **leak-safe**. Scope: NFL + CFB (the two deepest-history sports). NBA/NCAAB reuse this module after
they're warehoused.

Inputs verified in `03_DATA_AVAILABILITY_AUDIT.md`. Architecture verified from
`15_mobile_historical_analysis.md`, the CFB RPC, and `load_nab_patch.py`.

---

## Architecture decision

**Compute offline in Python, merge into the base table, extend the RPC.** Do **not** compute these at query
time with SQL window functions — the base is team-per-game *exploded*, the RPC must stay fast, and the
existing `last_*` / `win_streak` / `cover_streak` columns are already precomputed offline in the model
parquet. We mirror that exact path:

```
game-level truth (scores, closing spread, total, kickoff, home/away, opponent —
   already in training_epa / model_games AND in the base itself)
      │  asof_features.py  (pandas, per sport)
      ▼
per-(team, game_id) as-of feature frame  ──► stage table  _nab_asof / _cab_asof  (PostgREST, service key)
      │  SQL UPDATE join on game_id+team
      ▼
ALTER TABLE *_analysis_base ADD COLUMN … (team_* + opp_* + h2h_*)   [Management API DDL]
      ▼
CREATE OR REPLACE *_analysis RPC  — add p_filters predicates       [Management API DDL]
```

Load path = the proven `load_nab_patch.py` pattern (delete-all + batched insert into a staging table, then a
merge UPDATE). DDL (ALTER + RPC replace) goes through the **Management API** with an `sbp_` PAT — the service
key is PostgREST-only (see memory `supabase-ddl-management-api`).

---

## The leak-safe method (the part that must be correct)

For every feature, at game *g* for team *t*, use **only games that kicked off strictly before g**.

1. **Season-to-date rates/counts** — within `(team, season)`, sort by `kickoff` ascending, compute the
   running aggregate, then **`.shift(1)`** so row *g* sees only games 1…g-1. First game of a season → NULL
   (with `games_played = 0`). Never include the current game.
2. **Streaks** — same shifted running logic. NFL already has `win_streak` / `cover_streak` in source; reuse.
   CFB has `win_streak`; compute `ats_streak` / over-under streaks the same way.
3. **Prior-year aggregates** — full aggregate of the team's `season-1` completed games (all of them; a prior
   completed season is inherently leak-safe). NULL for a team's first season in the data.
4. **Head-to-head** — the single most recent completed meeting of `(t, opponent)` with `kickoff < g.kickoff`,
   across all seasons. NULL if they've never met in-window.
5. **"vs league average" booleans** — compare the team's as-of value to the league mean of that stat computed
   **as-of the same date** (mean over all teams' shifted values), precomputed offline as a boolean. Keeps the
   RPC trivial.
6. **Ordering / ties** — order strictly by kickoff timestamp; stable tie-break on `game_id`. Guard against
   same-day double-counting.
7. **Small samples** — always emit `team_games_s2d` (int). Rate columns are real numbers but may rest on 1–2
   games early season; the RPC/UI guards with a `min_games` filter and thin-sample styling (the page already
   has the thin-sample pattern). Do **not** silently null them — expose the count and let the query decide.

**Mandatory test:** a unit check asserting, for a random sample of rows, that every as-of value recomputed
from `games where kickoff < g.kickoff` matches the stored value (proves no leakage). Ship it in `asof_features.py`.

**Completed vs upcoming (two surfaces, one feature set):**
- **Backtest (`*_analysis`)** counts **completed games only** — a bet can't be graded on an unfinished game.
  As-of features exclude the game's own result, so incomplete games never enter the hit-rate.
- **Today's matches (`*_analysis_upcoming`)** = scheduled games (`kickoff > now()`). These must ALSO carry the
  same as-of columns — computed from each team's games completed *before* kickoff — so the slate is filterable
  by season-to-date/streak/H2H stats (e.g. "today's games where a team on a 3-game win streak is laying 3–7").
  Their **outcome columns are NULL** (not yet played), which is precisely what keeps them out of the backtest.
  Build note: the upcoming pipeline runs the identical `asof_features.py` logic against the scheduled slate.

---

## Columns to ADD (per base table)

Grain: base is team-per-game exploded → each new stat gets a **`team_`** (subject) and **`opp_`** (opponent)
copy, except `h2h_*` which is matchup-specific (single value, subject's perspective). Types in parens.

### Season Record  → filters: win%, win%-gap, streaks, >.500, win% vs opp
- `team_win_pct` (float), `team_wins_s2d` (int), `team_losses_s2d` (int), `team_games_s2d` (int)
- `team_loss_streak` (int)  *(win_streak already exists; add loss streak)*
- `opp_win_pct`, `opp_wins_s2d`, `opp_losses_s2d`  *(opp copies)*
- Derived at query time (no column): win%-gap = team−opp; >.500 = win_pct>0.5; win% vs opp comparisons.

### Cover Profile  → ATS win%, avg cover margin, ATS streak
- `team_ats_win_pct` (float), `team_ats_wins_s2d` (int), `team_ats_losses_s2d` (int)
- `team_ats_streak` (int)  *(NFL: reuse `cover_streak`; CFB: compute)*
- `team_avg_cover_margin` (float)  *(mean of (result_margin + team_spread) over prior games)*
- `opp_ats_win_pct`, `opp_ats_streak`, `opp_avg_cover_margin`

### Total Profile  → over%/under%, over/under streaks
- `team_over_pct` (float), `team_over_count_s2d` (int), `team_ou_games_s2d` (int)
- `team_over_streak` (int), `team_under_streak` (int)
- `opp_over_pct`, `opp_over_streak`, `opp_under_streak`  *(under% = 1 − over% among decided)*

### Prior Year  → records, made playoffs, more/less wins than opp
- `team_prev_wins` (int), `team_prev_losses` (int), `team_prev_win_pct` (float),
  `team_prev_playoff_wins` (int), `team_made_playoffs_prev` (bool)
- `opp_prev_wins`, `opp_prev_win_pct`, `opp_made_playoffs_prev`
- Derived: more/less wins than opp = team_prev_wins vs opp_prev_wins.

### Head-to-Head (last meeting, subject's perspective)  → matchup toggles + spread comparison
- `h2h_last_win` (bool), `h2h_last_ats_win` (bool), `h2h_last_over` (bool), `h2h_last_home` (bool),
  `h2h_last_fav` (bool), `h2h_last_margin` (float), `h2h_last_spread` (float), `h2h_last_total` (float),
  `h2h_last_ml` (int), `h2h_same_season` (bool), `h2h_last_postseason` (bool)
- Spread lower/higher/≤/≥ vs current = compare `h2h_last_spread` to the row's `team_spread` at query time.

### Season Stats (as-of averages)  → per-game stat ranges + vs-league booleans
- **NFL:** `team_ppg`, `team_pa_pg`, `team_point_diff_pg`, `team_pass_yds_pg`, `team_rush_yds_pg`,
  `team_td_pg`, `team_pass_td_pg`, `team_rush_td_pg` + `team_ppg_gt_league` / `team_pa_lt_league` (bool). Source
  = scores + nfl_data_py box, aggregated as-of.
- **CFB:** REUSE existing `points_pg`, `pass_yds_pg`, `first_downs_pg`, `plays_pg` from `model_games`; ADD
  `team_pa_pg`, `team_rush_yds_pg`, `team_td_pg` from `teamgame_box_YYYY` (2016–2025) + vs-league booleans.
- `opp_*` copies for each.

> Naming follows the base's existing convention (`team_ml`, `team_rank`, `last_*`). The additive-rebuild rule
> in `cab_builder/README.md` (preserve `weather_condition, dome, team_ml, team_rank, last_*`) extends to these.

---

## Columns already present — just EXPOSE via the RPC (no recompute)

| Taxonomy filter | Existing column | New RPC key |
|---|---|---|
| Win streak | `win_streak` (both) | `win_streak_min/max` |
| ATS streak (NFL) | `cover_streak` | `ats_streak_min/max` |
| Consecutive home / road games | `consec_home` / `consec_away` (CFB), `consecutive_home_away` (NFL) | `consec_home` / `consec_away` (bool) |
| Off a bye | `off_bye` (CFB), `pre_bye` exists (NFL) | already keyed / `off_bye` (bool) |
| Days rest | `days_rest` / `days_between_games` | `rest_min/max` (NFL keyed; add CFB) |
| Last-game result/ATS/total/margin | `last_*` columns | `last_result`, `last_ats`, `last_ou`, `last_margin_min/max` |
| Self / opponent rank (CFB) | `self_rank`, `ranked_matchup` | `ranked_matchup` (already live) |

---

## New RPC filter keys (follow the existing `p_filters->>` pattern)

Ranges (min/max, both optional): `win_pct`, `ats_win_pct`, `over_pct`, `win_streak`, `loss_streak`,
`ats_streak`, `over_streak`, `under_streak`, `avg_cover_margin`, `ppg`, `pa_pg`, `pass_yds_pg`, `rush_yds_pg`,
`prev_wins`, `prev_win_pct`, plus `min_games` (guard). Predicate template:

```sql
AND (p_filters->>'win_pct_min' IS NULL OR b.team_win_pct >= (p_filters->>'win_pct_min')::numeric)
AND (p_filters->>'win_pct_max' IS NULL OR b.team_win_pct <= (p_filters->>'win_pct_max')::numeric)
```

Booleans/toggles: `above_500` (team_win_pct>0.5), `win_pct_gt_opp`, `win_pct_ge_opp`, `win_pct_lt_opp`,
`made_playoffs_prev`, `missed_playoffs_prev`, `more_wins_than_opp`, `consec_home`, `consec_away`,
`h2h_last_win`, `h2h_last_ats_win`, `h2h_last_over`, `h2h_last_home`, `h2h_last_fav`, `h2h_same_season`,
`h2h_spread_lower` (b.h2h_last_spread < b.team_spread), etc. Template:

```sql
AND (p_filters->>'above_500' IS NULL OR (b.team_win_pct > 0.5) = (p_filters->>'above_500')::boolean)
AND (p_filters->>'consec_home' IS NULL OR b.consec_home = (p_filters->>'consec_home')::boolean)
```

Opponent variants take an `opp_` prefix on both key and column.

---

## Build & deploy runbook

1. **`asof_features.py` (per sport)** — read the game-level truth (from the base table itself or the source
   parquet), build the per-(team, game_id) frame with the shifted leak-safe logic above, include the leakage
   unit test. Output a parquet + the merge frame.
2. **Stage** — batched insert into `_nab_asof` / `_cab_asof` (service key, delete-all + insert; the
   `load_nab_patch.py` idiom).
3. **ALTER** the base table (`ADD COLUMN IF NOT EXISTS`) for every column above — via Management API PAT.
4. **Merge** — `UPDATE *_analysis_base b SET team_win_pct = s.team_win_pct, … FROM _nab_asof s WHERE
   b.game_id = s.game_id AND b.team = s.team;` (and the opp join for `opp_*`).
5. **Replace the RPC** — add the new predicates; keep every existing predicate (weather/dome/last_*/etc.).
   Dump-first with `dump_cfb_analysis_rpc.py` so we edit the live body, not a stale copy.
6. **Probe** — the filter must move the numbers, e.g. `nfl_analysis('fg_spread', {"win_pct_min":0.6})` → n
   drops, hit% shifts; `{"h2h_last_win":true}` → smaller n; `{"above_500":true}` vs `false` partition the
   baseline. Add these to the RPC record file like the weather probe.
7. **Commit** the builder + RPC record + migration SQL to `research/*/…` (reproducibility, matching cab_builder).

---

## Coverage & correctness caveats

- Rate stats are only meaningful once a team has a few games — early-season rows have tiny `*_games_s2d`.
  Surface the count; guard headline claims with `min_games`.
- History depth unchanged: NFL 2018+, CFB 2016+. Prior-year features are NULL for each team's first in-window
  season (2018 NFL / 2016 CFB).
- CFB moneyline still 2021+ (existing caveat) — `h2h_last_ml` is NULL before 2021.
- This is additive and backward-compatible: existing bet types/filters/probe numbers must be unchanged after
  the merge (regression-check the `fg_spread` baseline ≈ 50%, favs cover ≈ 49%).
- Same module (compute → stage → merge → RPC) is the template for NBA/NCAAB once they're warehoused.
