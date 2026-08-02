# 23 — NFL/CFB 2026 New-Model Data Map (for the web/native repoint)

**Purpose:** the 2026 NFL + CFB season now runs on a NEW model whose output lives in a different set of
tables than the old "dry-run test" (2025 Week 12) and the retired legacy model. This doc is the single
source of truth for *where every piece of NFL/CFB data lives now*, so any surface that's blank can be
pointed at the right table + key.

## 0. The one rule
Slate identity, model output, and true opening lines read from the **`*_dryrun_*` family** on the **CFB Supabase project
`jpxnjuwglavsjbgbasnl`** (web client: `collegeFootballSupabase` / `src/integrations/supabase/college-football-client.ts`,
env `VITE_CFB_SUPABASE_URL`). The name says "dryrun" but these are the **live current-week production
tables** — the name is just leftover from the 2025 test.

Current live spread/total consensus and its timeline are the explicit exception:
`nfl_line_movement` / `cfb_line_movement`, filtered by the same dryrun `game_id`.

**Resolve the current (season, week) DYNAMICALLY. Never hardcode `season=2025`, `week=12`, or `week=7`.**
Those were the dry-run pins and are the #1 cause of blank/stale surfaces.

### Current-week resolution (two patterns already used in the codebase)
- **Games feed** (`nflGames.ts` / `cfbGames.ts` → `resolveNflCurrentWeek` / `resolveCfbCurrentWeek`):
  the *soonest upcoming* game — `kickoff >= now() - 6h`, order by kickoff asc, limit 1 → that row's
  `(season, week)`. Fallback: latest `(season, week)` present. This is what rolls Week 1 → Week 2 on its own.
- **Everything else** (outliers, trends, live scores): the **latest slate present** — order by
  `season desc, week desc, limit 1`, then filter `.eq(season).eq(week)`. In-season the pipeline only
  writes the current week, so "latest" == "current."

## 1. RETIRED — do NOT read these for NFL/CFB anymore
| Sport | Retired table | Replaced by |
|---|---|---|
| NFL | `v_input_values_with_epa`, `nfl_predictions_epa` | `nfl_dryrun_games` |
| NFL | `nfl_betting_lines` (as a card/current-line source) | `nfl_dryrun_games.fg_*_open` + `nfl_line_movement` |
| CFB | `cfb_live_weekly_inputs`, `cfb_api_predictions`, `cfb_team_mapping` | `cfb_dryrun_games`, `cfb_teams` |

**Exception (keep):** `cfb_team_mapping` is still read by the `/cfb-analytics` trends workbench (a
separate page) — leave that path. Line Movement does **not** use a retired-table exception: it reads
`nfl_line_movement` / `cfb_line_movement` directly by the dryrun row's `game_id`.

## 2. The tables (project `jpxnjuwglavsjbgbasnl`), join key `game_id`

### Game cards — the slate
- **`nfl_dryrun_games`** — one row per NFL game. **✅ 16 rows for 2026 Wk1.**
- **`cfb_dryrun_games`** — one row per CFB game. **✅ 51 rows for 2026 Wk1.**
Both are keyed `(game_id, season, week)`. Columns (the important ones):
  - Identity/time: `game_id, season, week, kickoff, home_team, away_team` (display names), `home_ab/away_ab`
    (NFL) / `home_conf/away_conf, home_rank/away_rank, neutral_site` (CFB), `gameday`.
  - **Lines (Odds-API):** `fg_spread_open/close`, `fg_total_open/close`, `fg_ml_home_close/fg_ml_away_close`,
    `tt_home_close/tt_away_close` (team totals), `h1_spread_close/h1_total_close/h1_ml_home_close/h1_ml_away_close`.
  - **Model predictions:** `fg_pred_total`, `fg_pred_margin`, `fg_pred_spread`, `fg_pred_home_pts/fg_pred_away_pts`,
    `fg_home_win_prob`, `fg_home_cover_prob`, `fg_total_edge`, `fg_spread_edge`, `fg_total_pick`, `fg_spread_pick`,
    `fg_total_tier` (NFL), `fg_spread_confluence` (NFL), `tt_home_pred/tt_away_pred` + `tt_*_pick`,
    `h1_pred_total/h1_pred_margin/h1_home_win_prob`.
  - **Conviction / badges:** `conviction_tier`, `stake_units`, `mammoth`, `flags_active/flags_tracking`
    (NFL) / `n_flags_active/n_flags_tracking` (CFB), `conviction_summary` (jsonb).
  - **Weather:** `wx_temp_f, wx_wind_mph, wx_precip_mm, wx_indoors, wx_icon, wx_summary`.
  - **Actuals (VALIDATION ONLY — null pregame):** `final_home/final_away, h1_home/h1_away`.
  - NFL only: `assigned_referee`.

### Live consensus and movement
- **`nfl_line_movement`** — key/filter `game_id` (prefer `season` too), ordered by `snap_ts`.
  Columns: `n_books, fg_spread_home, fg_total, h1_spread_home, h1_total, tt_home, tt_away`.
- **`cfb_line_movement`** — same game-keyed read, currently FG only:
  `n_books, fg_spread_home, fg_total`.
- The latest row is the **current live consensus**. The full ordered series is the chart.
- `fg_spread_home` is home perspective; away spread is its negation.
- Always filter by `game_id`. In particular, broad reads of `cfb_line_movement` time out.
- `nfl_historical_odds` and `ncaaf_odds_history` are raw per-book archives, not consensus
  chart sources. They may be used for a deliberately selected-book or implied-probability ML path.

### Bet-signal badges (the flag layer on cards)
- **`nfl_dryrun_flags`** — **✅ 30 rows 2026 Wk1** (20 `tier='active'`). Key `game_id`. Cols:
  `game_id, season, week, source, rule, tier, market, side, line, price, edge, mammoth, signal_key,
  conviction, stake_units, grade_line`.
- **`cfb_dryrun_flags`** — **⚠ 0 rows** (correct: CFB betting spots are cold in Weeks 1–3; they populate
  from ~Week 4). Same shape (`signal_key`, `conviction`, `tier`, …). Empty is EXPECTED, not a bug.
- Signal metadata for both: **`nfl_signal_defs` / `cfb_signal_defs`** (`signal_key, display_name, market,
  one_liner, definition, why_it_works, bet_direction, typical_hit, default_conviction`) — join flags →
  defs on `signal_key` to render the human-readable card.

### CFB picks list
- **`cfb_dryrun_picks`** — **⚠ 0 rows** (cold Weeks 1–3, same as flags). Key `game_id`. Cols include
  `card_group, bet_type, pick_side, pick_team, pick_label, model_number, model_line, vegas_line,
  vegas_price, edge, best_book*, conviction, is_mammoth, stake_units, has_play, display_only,
  signal_keys, recommendation`. (NFL's equivalent bet list is derived from `nfl_dryrun_flags`.)

### Player props
- **`nfl_dryrun_props`** — **⚠ 0 rows for 2026** (player-prop ODDS are captured in-season, ~game week,
  not 6 weeks out). Key `(game_id, player_id, market)`. Rich cols: `close_line, over/under_price,
  open_line, line_delta, l3/l5/l10/szn_avg, over_rate_l5/l10, def_allowed_pos, def_matchup_idx, flags,
  headshot_url`, etc. Empty now = EXPECTED. (CFB has no props — no CFB prop data exists, ever.)

### Outliers tab — trend cards
- **`nfl_outliers_trend_cards`** — **✅ 192 rows 2026 Wk1.** **`cfb_outliers_trend_cards`** — **✅ 1200.**
  Key `(card_id, season, week)`, joined to games by `game_id`. Cols: `subject_kind` (team|coach|referee|player),
  `subject_name, team_abbr, player_id, market_key, bet_type_label, trend_value, trend_sample_n, sort_rank,
  trend_hit_side, rows (jsonb), betting_lines (jsonb), headshot_url`.

### Outliers/trends source tables (the streak data)
- **`nfl_team_trends`** (**✅ 32**) / **`cfb_team_trends`** (**✅ 137**) — per-team splits. Key
  `(team_name|team_abbr, season, through_week)`. Streaks are CROSS-SEASON (carry last year early). Cols:
  season-to-date records + `last5_su/ats/ou` (text[]) + `splits` (jsonb: market→dim→window) + `matchups`
  (jsonb, H2H) + `game_log` (jsonb).
- **`nfl_coach_trends`** (**✅ 173**) / **`cfb_coach_trends`** (**✅ 290**) — key `(coach, through_season,
  through_week)`; `current_team, career_games, splits, matchups, market_coverage, recent_game_log`.
- **`nfl_referee_trends`** (**✅ 91**) — key `(referee, through_season, through_week)`. **CFB has NO referee
  trends (no data — never will).**
- **`nfl_player_prop_trends`** (**✅ 681**) — key `(player_id, through_season, through_week)`; `markets,
  splits, matchups, recent_game_log`. **CFB has NO player-prop trends (no data — never will).**

### Team meta (logos/colors)
- **`nfl_teams`** — key `team_abbr`; `team_name, team_nick, team_color/2/3/4, logo_espn, logo_squared,
  wordmark, conference_logo`.
- **`cfb_teams`** — key `team_name`; `abbr, conference, classification, color, alt_color, logo, logo_dark`.

### Results (grading; in-season only)
- **`football_game_results`** — shared NFL+CFB finals view, keyed by `game_id`. Empty in the offseason;
  populates as games go final. Grading + the game_log actuals read from here.

## 3. Column cheat-sheet (old dry-run field → what to read now)
| The card wants… | Read from `*_dryrun_games` |
|---|---|
| opening home spread / total | `fg_spread_open` / `fg_total_open` |
| current home spread | latest `*_line_movement.fg_spread_home` (away = negated) |
| current total (O/U) | latest `*_line_movement.fg_total` |
| slate-time moneyline reference | `fg_ml_home_close` / `fg_ml_away_close` (not live current) |
| model total / spread | `fg_pred_total` / `fg_pred_spread` |
| predicted score | `fg_pred_home_pts` / `fg_pred_away_pts` |
| total edge / pick | `fg_total_edge` / `fg_total_pick` |
| spread edge / pick | `fg_spread_edge` / `fg_spread_pick` |
| win prob / cover prob | `fg_home_win_prob` / `fg_home_cover_prob` |
| team totals | `tt_home_close/tt_away_close` + `tt_home_pred/tt_away_pred` |
| 1H | `h1_spread_close/h1_total_close/h1_pred_total/h1_pred_margin/h1_home_win_prob` |
| weather | `wx_temp_f/wx_wind_mph/wx_icon/wx_summary` |
| conviction / play | `conviction_tier`, `stake_units`, `mammoth` |

## 4. What's LEGITIMATELY EMPTY right now (do NOT chase these — expected preseason)
- `nfl_dryrun_props`, `nfl_player_prop_trends` display cards → **player-prop odds are captured in-season**;
  the trend *table* has 681 historical rows but game-week prop lines don't exist 6 weeks out.
- `cfb_dryrun_flags`, `cfb_dryrun_picks` → CFB betting spots are **cold in Weeks 1–3** (the LEAN
  opponent-adjusted model needs games played); they fill from ~Week 4.
- Weather (`wx_*`) → forecasts only exist ~10–14 days out; null now.
- 1H (`h1_*`) → live 1H odds captured in-season; blank now.
- `football_game_results` → empty until games go final.
These are correct offseason states. A blank prop tab or CFB signal badge right now is NOT a bug.

## 5. What TO fix (the audit for Cursor)
Grep the web (`src/`) and native for these and repoint each to the `*_dryrun_*` tables + the dynamic
current-week resolver above:
1. Any hardcoded **`season=2025`**, **`week=12`**, or **`week=7`** on an NFL/CFB read → replace with the
   resolved current week.
2. Any read of the **retired tables** in §1 (except the two noted exceptions).
3. Any NFL/CFB surface that resolves "today" by DATE for the games — football uses the **week slate**, not a
   date window; use the anchor pattern.
4. Confirm each surface's column names match §2/§3 (the new table uses `fg_*`/`wx_*`/`tt_*`/`h1_*` prefixes,
   not the old `home_spread`/`pred_total`/etc.).

## 6. 2026 Week-1 population snapshot (as of the cutover)
✅ populated: nfl_dryrun_games 16 · nfl_dryrun_flags 30 · cfb_dryrun_games 51 · nfl_team_trends 32 ·
nfl_coach_trends 173 · nfl_referee_trends 91 · nfl_player_prop_trends 681 · nfl_outliers_trend_cards 192 ·
cfb_team_trends 137 · cfb_coach_trends 290 · cfb_outliers_trend_cards 1200 · nfl_teams · cfb_teams ·
nfl/cfb_signal_defs.
⚠ empty-by-design: nfl_dryrun_props · cfb_dryrun_flags · cfb_dryrun_picks · football_game_results.
